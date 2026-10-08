-- VocabMaster's initial Supabase schema.
-- All user data is owned by Supabase Auth users and protected by RLS.

create type public.vocab_status as enum ('new', 'learning', 'mastered');
create type public.word_type as enum (
  'noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other'
);
create type public.review_rating as enum ('forgot', 'hard', 'good', 'easy');

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_parent_same_owner_fk
    foreign key (parent_id, user_id)
    references public.folders (id, user_id)
    on delete cascade,
  constraint folders_id_user_id_unique unique (id, user_id),
  constraint folders_not_own_parent check (parent_id is distinct from id)
);

create table public.vocabularies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid,
  word text not null check (char_length(trim(word)) between 1 and 300),
  meaning text not null check (char_length(trim(meaning)) between 1 and 2000),
  word_type public.word_type not null default 'noun',
  phonetic text not null default '',
  level text not null default 'Band 6.5',
  example text not null default '',
  status public.vocab_status not null default 'new',
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  ease_factor numeric(4, 2) not null default 2.50 check (ease_factor between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  constraint vocabularies_folder_same_owner_fk
    foreign key (folder_id, user_id)
    references public.folders (id, user_id)
    on delete set null (folder_id),
  constraint vocabularies_id_user_id_unique unique (id, user_id)
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_id uuid not null,
  rating public.review_rating not null,
  reviewed_at timestamptz not null default now(),
  constraint review_logs_vocabulary_same_owner_fk
    foreign key (vocabulary_id, user_id)
    references public.vocabularies (id, user_id)
    on delete cascade
);

create table public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score_percent integer not null check (score_percent between 0 and 100),
  total_questions integer not null check (total_questions > 0),
  correct_count integer not null check (correct_count >= 0),
  wrong_count integer not null check (wrong_count >= 0),
  created_at timestamptz not null default now(),
  constraint quiz_results_counts_match check (
    correct_count + wrong_count = total_questions
  ),
  constraint quiz_results_score_matches_counts check (
    score_percent = round(correct_count * 100.0 / total_questions)::integer
  ),
  constraint quiz_results_id_user_id_unique unique (id, user_id)
);

create table public.quiz_result_folders (
  quiz_result_id uuid not null,
  folder_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (quiz_result_id, folder_id),
  constraint quiz_result_folders_result_same_owner_fk
    foreign key (quiz_result_id, user_id)
    references public.quiz_results (id, user_id)
    on delete cascade,
  constraint quiz_result_folders_folder_same_owner_fk
    foreign key (folder_id, user_id)
    references public.folders (id, user_id)
    on delete cascade
);

create table public.mistake_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_id uuid,
  word text not null,
  meaning text not null,
  user_answer text not null,
  correct_answer text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  constraint mistake_logs_vocabulary_same_owner_fk
    foreign key (vocabulary_id, user_id)
    references public.vocabularies (id, user_id)
    on delete set null (vocabulary_id),
  constraint mistake_logs_resolution_time check (
    (resolved and resolved_at is not null) or (not resolved and resolved_at is null)
  )
);

create index folders_user_parent_idx on public.folders (user_id, parent_id);
create index vocabularies_user_folder_idx on public.vocabularies (user_id, folder_id);
create index vocabularies_user_review_idx on public.vocabularies (user_id, next_review_at);
create index vocabularies_user_word_idx on public.vocabularies (user_id, lower(word));
create index review_logs_user_reviewed_idx on public.review_logs (user_id, reviewed_at desc);
create index review_logs_vocabulary_reviewed_idx
  on public.review_logs (vocabulary_id, reviewed_at desc);
create index quiz_results_user_created_idx on public.quiz_results (user_id, created_at desc);
create index mistake_logs_user_unresolved_idx
  on public.mistake_logs (user_id, created_at desc) where not resolved;

-- Keep folder and vocabulary edit timestamps consistent without trusting clients.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.set_mistake_resolution_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.resolved then
    if tg_op = 'INSERT' or not old.resolved or new.resolved_at is null then
      new.resolved_at = now();
    end if;
  else
    new.resolved_at = null;
  end if;
  return new;
end;
$$;

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();
create trigger vocabularies_set_updated_at
  before update on public.vocabularies
  for each row execute function public.set_updated_at();
create trigger mistake_logs_set_resolution_time
  before insert or update of resolved on public.mistake_logs
  for each row execute function public.set_mistake_resolution_time();

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_mistake_resolution_time() from public, anon, authenticated;

-- Apply an SRS review and append its audit log atomically. The caller never
-- supplies a user_id; ownership always comes from the verified Auth JWT.
create function public.record_vocabulary_review(
  p_vocabulary_id uuid,
  p_rating public.review_rating
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
  v_status public.vocab_status;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_vocabulary
  from public.vocabularies
  where id = p_vocabulary_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary not found' using errcode = 'P0002';
  end if;

  case p_rating
    when 'forgot' then
      v_interval_days := 0;
      v_repetitions := 0;
      v_status := 'learning';
    when 'hard' then
      v_interval_days := 1;
      v_repetitions := greatest(1, v_vocabulary.repetitions + 1);
      v_status := 'learning';
    when 'good' then
      v_interval_days := 3;
      v_repetitions := v_vocabulary.repetitions + 1;
      v_status := case when v_repetitions >= 2 then 'mastered' else 'learning' end;
    when 'easy' then
      v_interval_days := 7;
      v_repetitions := v_vocabulary.repetitions + 1;
      v_status := 'mastered';
  end case;

  update public.vocabularies
  set status = v_status,
      next_review_at = now() + make_interval(days => v_interval_days),
      interval_days = v_interval_days,
      repetitions = v_repetitions,
      last_reviewed_at = now()
  where id = p_vocabulary_id and user_id = v_user_id
  returning * into v_vocabulary;

  insert into public.review_logs (user_id, vocabulary_id, rating)
  values (v_user_id, p_vocabulary_id, p_rating);

  return v_vocabulary;
end;
$$;

revoke all on function public.record_vocabulary_review(uuid, public.review_rating)
  from public, anon;
grant execute on function public.record_vocabulary_review(uuid, public.review_rating)
  to authenticated;

alter table public.folders enable row level security;
alter table public.vocabularies enable row level security;
alter table public.review_logs enable row level security;
alter table public.quiz_results enable row level security;
alter table public.quiz_result_folders enable row level security;
alter table public.mistake_logs enable row level security;

create policy "Users manage their folders"
  on public.folders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their vocabularies"
  on public.vocabularies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read their review logs"
  on public.review_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users record their review logs"
  on public.review_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users read their quiz results"
  on public.quiz_results for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their quiz results"
  on public.quiz_results for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users read their quiz result folders"
  on public.quiz_result_folders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users assign their own folders to quiz results"
  on public.quiz_result_folders for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users manage their mistake logs"
  on public.mistake_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Supabase projects may preconfigure broad default table grants. Remove them
-- explicitly, then grant only the operations used by the application.
revoke all on
  public.folders, public.vocabularies, public.review_logs,
  public.quiz_results, public.quiz_result_folders, public.mistake_logs
  from anon, authenticated;

grant select, insert, update, delete on
  public.folders, public.vocabularies, public.mistake_logs
  to authenticated;
grant select, insert on
  public.review_logs, public.quiz_results, public.quiz_result_folders
  to authenticated;
