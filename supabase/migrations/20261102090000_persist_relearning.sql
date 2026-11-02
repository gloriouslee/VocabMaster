-- Persist every relearning step and keep extra practice separate from scheduling.
alter table public.study_sessions
  add column relearn_flags boolean[] not null default '{}',
  add column practice_only boolean not null default false;
update public.study_sessions set relearn_flags = array_fill(false, array[cardinality(vocabulary_ids)]);
alter table public.study_sessions add constraint study_session_flags_match
  check (cardinality(relearn_flags) = cardinality(vocabulary_ids));
drop function public.start_study_session(uuid[]);
create function public.start_study_session(p_vocabulary_ids uuid[], p_practice_only boolean default false)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.study_sessions%rowtype;
  v_owned_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if coalesce(cardinality(p_vocabulary_ids), 0) = 0 then
    raise exception 'A study session must contain at least one vocabulary card';
  end if;
  if cardinality(p_vocabulary_ids) <> (select count(distinct id) from unnest(p_vocabulary_ids) as ids(id)) then
    raise exception 'A study session cannot contain duplicate cards';
  end if;

  select count(*) into v_owned_count
  from public.vocabularies
  where user_id = v_user_id and id = any(p_vocabulary_ids);
  if v_owned_count <> cardinality(p_vocabulary_ids) then
    raise exception 'Some vocabulary cards are unavailable';
  end if;

  delete from public.study_sessions where user_id = v_user_id;
  insert into public.study_sessions (user_id, vocabulary_ids, relearn_flags, practice_only)
  values (v_user_id, p_vocabulary_ids, array_fill(false, array[cardinality(p_vocabulary_ids)]), p_practice_only)
  returning * into v_session;
  return v_session;
end;
$$;


drop function public.record_study_session_review(uuid, uuid, public.review_rating);
create function public.record_study_session_review(
  p_session_id uuid, p_vocabulary_id uuid, p_rating public.review_rating,
  p_expected_index integer default null
) returns public.study_sessions
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  s public.study_sessions%rowtype;
  w public.vocabularies%rowtype;
  v_relearn boolean;
  v_insert integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into s from public.study_sessions where id = p_session_id and user_id = v_user for update;
  if not found then raise exception 'Study session not found' using errcode = 'P0002'; end if;
  if p_rating is null or s.current_index >= cardinality(s.vocabulary_ids)
    or s.vocabulary_ids[s.current_index + 1] <> p_vocabulary_id
    or (p_expected_index is not null and p_expected_index <> s.current_index) then
    raise exception 'Study session is out of date' using errcode = '40001';
  end if;
  v_relearn := s.relearn_flags[s.current_index + 1];
  select * into w from public.vocabularies where id = p_vocabulary_id and user_id = v_user for update;
  if not found then raise exception 'Vocabulary not found' using errcode = 'P0002'; end if;
  if not s.practice_only then
    if not v_relearn then
      -- Another tab may already have reviewed this word. Do not advance it early.
      if w.status = 'new' or w.next_review_at <= now() then
        perform public.record_vocabulary_review(p_vocabulary_id, p_rating);
      end if;
    elsif p_rating = 'forgot' then
      -- Repeated attempts belong to the same review; do not inflate daily counts.
      update public.vocabularies set interval_days = 0, repetitions = 0,
        status = 'learning', next_review_at = now()
      where id = p_vocabulary_id and user_id = v_user;
    elsif p_rating in ('good', 'easy') and w.interval_days = 0 then
      -- Completing a lapse earns a one-day check, not another long-term success.
      update public.vocabularies set interval_days = 1, repetitions = 1,
        status = 'learning', next_review_at = now() + interval '1 day'
      where id = p_vocabulary_id and user_id = v_user;
    end if;
  end if;
  if p_rating in ('forgot', 'hard') then
    v_insert := least(cardinality(s.vocabulary_ids), s.current_index + 1 + case when p_rating = 'forgot' then 4 else 7 end);
    s.vocabulary_ids := s.vocabulary_ids[1:v_insert] || array[p_vocabulary_id] || s.vocabulary_ids[v_insert+1:cardinality(s.vocabulary_ids)];
    s.relearn_flags := s.relearn_flags[1:v_insert] || array[true] || s.relearn_flags[v_insert+1:cardinality(s.relearn_flags)];
  end if;
  if not v_relearn then
    s.rating_counts := jsonb_set(s.rating_counts, array[p_rating::text],
      to_jsonb(coalesce((s.rating_counts ->> p_rating::text)::integer, 0) + 1));
  end if;
  update public.study_sessions set vocabulary_ids = s.vocabulary_ids,
    relearn_flags = s.relearn_flags, current_index = s.current_index + 1, rating_counts = s.rating_counts
  where id = p_session_id and user_id = v_user returning * into s;
  return s;
end;
$$;
revoke all on function public.start_study_session(uuid[], boolean) from public, anon;
grant execute on function public.start_study_session(uuid[], boolean) to authenticated;
revoke all on function public.record_study_session_review(uuid, uuid, public.review_rating, integer) from public, anon;
grant execute on function public.record_study_session_review(uuid, uuid, public.review_rating, integer) to authenticated;

create or replace function public.record_vocabulary_review(
  p_vocabulary_id uuid,
  p_rating public.review_rating,
  p_source text default 'study'
)
returns public.vocabularies
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_vocabulary public.vocabularies%rowtype;
  v_interval_days integer;
  v_repetitions integer;
  v_ease numeric(4, 2);
  v_status public.vocab_status;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_source not in ('study', 'quiz') then
    raise exception 'Invalid review source' using errcode = '22023';
  end if;

  select * into v_vocabulary
  from public.vocabularies
  where id = p_vocabulary_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Vocabulary not found' using errcode = 'P0002';
  end if;

  if p_source = 'quiz' and p_rating <> 'forgot' and v_vocabulary.status <> 'new'
    and v_vocabulary.next_review_at > now() then
    return v_vocabulary;
  end if;

  v_ease := v_vocabulary.ease_factor;
  case p_rating
    when 'forgot' then
      v_interval_days := 0;
      v_repetitions := 0;
      v_ease := greatest(1.3, v_ease - 0.2);
    when 'hard' then
      if v_vocabulary.repetitions = 0 or v_vocabulary.interval_days < 1 then
        v_interval_days := 1;
      else
        v_interval_days := greatest(v_vocabulary.interval_days + 1, round(v_vocabulary.interval_days * 1.2)::integer);
      end if;
      v_repetitions := v_vocabulary.repetitions + 1;
      v_ease := greatest(1.3, v_ease - 0.15);
    when 'good' then
      if v_vocabulary.repetitions = 0 then
        v_interval_days := 1;
      elsif v_vocabulary.repetitions = 1 then
        v_interval_days := greatest(3, v_vocabulary.interval_days + 1);
      else
        v_interval_days := greatest(v_vocabulary.interval_days + 1, round(v_vocabulary.interval_days * v_ease)::integer);
      end if;
      v_repetitions := v_vocabulary.repetitions + 1;
    when 'easy' then
      if v_vocabulary.repetitions = 0 then
        v_interval_days := 4;
      elsif v_vocabulary.repetitions = 1 then
        v_interval_days := greatest(7, v_vocabulary.interval_days + 1);
      else
        v_interval_days := greatest(v_vocabulary.interval_days + 1, round(v_vocabulary.interval_days * v_ease * 1.3)::integer);
      end if;
      v_repetitions := v_vocabulary.repetitions + 1;
      v_ease := least(3, v_ease + 0.15);
  end case;

  v_interval_days := least(365, v_interval_days);
  v_status := case when v_interval_days >= 21 then 'mastered' else 'learning' end;
  update public.vocabularies
  set status = v_status,
      next_review_at = now() + make_interval(days => v_interval_days),
      interval_days = v_interval_days,
      repetitions = v_repetitions,
      ease_factor = v_ease,
      last_reviewed_at = now()
  where id = p_vocabulary_id and user_id = v_user_id
  returning * into v_vocabulary;

  insert into public.review_logs (user_id, vocabulary_id, rating, source)
  values (v_user_id, p_vocabulary_id, p_rating, p_source);
  return v_vocabulary;
end;
$$;

