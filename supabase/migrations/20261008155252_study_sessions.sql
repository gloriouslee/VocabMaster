-- Persist one resumable flashcard session per signed-in user.
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_ids uuid[] not null check (cardinality(vocabulary_ids) > 0),
  current_index integer not null default 0,
  rating_counts jsonb not null default '{"forgot":0,"hard":0,"good":0,"easy":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_progress_in_range check (
    current_index >= 0 and current_index <= cardinality(vocabulary_ids)
  )
);

create unique index study_sessions_one_active_per_user_idx
  on public.study_sessions (user_id)
  where current_index < cardinality(vocabulary_ids);
create index study_sessions_user_updated_idx
  on public.study_sessions (user_id, updated_at desc);

create trigger study_sessions_set_updated_at
  before update on public.study_sessions
  for each row execute function public.set_updated_at();

alter table public.study_sessions enable row level security;
create policy "Users manage their study sessions"
  on public.study_sessions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.study_sessions from anon, authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;

create function public.start_study_session(p_vocabulary_ids uuid[])
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
  insert into public.study_sessions (user_id, vocabulary_ids)
  values (v_user_id, p_vocabulary_ids)
  returning * into v_session;
  return v_session;
end;
$$;

create function public.record_study_session_review(
  p_session_id uuid,
  p_vocabulary_id uuid,
  p_rating public.review_rating
)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.study_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_session
  from public.study_sessions
  where id = p_session_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Study session not found' using errcode = 'P0002';
  end if;
  if v_session.current_index >= cardinality(v_session.vocabulary_ids)
    or v_session.vocabulary_ids[v_session.current_index + 1] <> p_vocabulary_id then
    raise exception 'Study session is out of date' using errcode = '40001';
  end if;

  perform public.record_vocabulary_review(p_vocabulary_id, p_rating);

  update public.study_sessions
  set current_index = current_index + 1,
      rating_counts = jsonb_set(
        rating_counts,
        array[p_rating::text],
        to_jsonb(coalesce((rating_counts ->> p_rating::text)::integer, 0) + 1),
        true
      )
  where id = p_session_id and user_id = v_user_id
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.start_study_session(uuid[]) from public, anon;
grant execute on function public.start_study_session(uuid[]) to authenticated;
revoke all on function public.record_study_session_review(uuid, uuid, public.review_rating) from public, anon;
grant execute on function public.record_study_session_review(uuid, uuid, public.review_rating) to authenticated;
