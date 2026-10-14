-- Treat every saved quiz answer as a review so quiz and flashcard practice
-- share the same SM-2 schedule, review log, and daily activity counters.
-- Retry rounds stay client-only and therefore do not call this function.
drop function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb);
alter table public.review_logs
  add column source text not null default 'study' check (source in ('study', 'quiz'));

drop function public.record_vocabulary_review(uuid, public.review_rating);
create function public.record_vocabulary_review(
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
        v_interval_days := 3;
      else
        v_interval_days := greatest(v_vocabulary.interval_days + 1, round(v_vocabulary.interval_days * v_ease)::integer);
      end if;
      v_repetitions := v_vocabulary.repetitions + 1;
    when 'easy' then
      if v_vocabulary.repetitions = 0 then
        v_interval_days := 4;
      elsif v_vocabulary.repetitions = 1 then
        v_interval_days := 7;
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

revoke all on function public.record_vocabulary_review(uuid, public.review_rating, text) from public, anon;
grant execute on function public.record_vocabulary_review(uuid, public.review_rating, text) to authenticated;

create function public.record_quiz_attempt(
  p_score_percent integer,
  p_total_questions integer,
  p_correct_count integer,
  p_wrong_count integer,
  p_folder_ids uuid[] default '{}'::uuid[],
  p_mistakes jsonb default '[]'::jsonb,
  p_reviews jsonb default '[]'::jsonb
)
returns public.quiz_results
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result public.quiz_results%rowtype;
  v_review record;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_reviews, '[]'::jsonb)) as item(vocabulary_id uuid, rating text)
    where item.rating is null or item.rating not in ('forgot', 'good')
  ) then
    raise exception 'Quiz review ratings must be forgot or good' using errcode = '22023';
  end if;

  insert into public.quiz_results (
    user_id, score_percent, total_questions, correct_count, wrong_count
  ) values (
    v_user_id, p_score_percent, p_total_questions, p_correct_count, p_wrong_count
  ) returning * into v_result;

  insert into public.quiz_result_folders (quiz_result_id, folder_id, user_id)
  select v_result.id, scopes.folder_id, v_user_id
  from unnest(coalesce(p_folder_ids, '{}'::uuid[])) as scopes(folder_id)
  on conflict do nothing;

  insert into public.mistake_logs (
    user_id, vocabulary_id, word, meaning, user_answer, correct_answer
  )
  select v_user_id, mistake.vocabulary_id, mistake.word, mistake.meaning,
         mistake.user_answer, mistake.correct_answer
  from jsonb_to_recordset(coalesce(p_mistakes, '[]'::jsonb)) as mistake(
    vocabulary_id uuid,
    word text,
    meaning text,
    user_answer text,
    correct_answer text
  );

  -- One outcome per word is sent by the app. If malformed input repeats a word,
  -- prefer the lapse rating so the more conservative schedule is applied.
  for v_review in
    select item.vocabulary_id,
           case when bool_or(item.rating = 'forgot') then 'forgot' else 'good' end as rating
    from jsonb_to_recordset(coalesce(p_reviews, '[]'::jsonb)) as item(vocabulary_id uuid, rating text)
    group by item.vocabulary_id
  loop
    perform public.record_vocabulary_review(v_review.vocabulary_id, v_review.rating::public.review_rating, 'quiz');
  end loop;

  return v_result;
end;
$$;

revoke all on function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb, jsonb)
  from public, anon;
grant execute on function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb, jsonb)
  to authenticated;
