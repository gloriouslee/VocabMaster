-- Keep a per-user history for file imports and let users remove only words
-- created by a particular successful import.
create table public.vocabulary_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  word_count integer not null check (word_count > 0),
  created_folder_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vocabulary_import_batches_id_user_id_unique unique (id, user_id)
);

create index vocabulary_import_batches_user_created_idx
  on public.vocabulary_import_batches (user_id, created_at desc);

alter table public.vocabulary_import_batches enable row level security;
create policy "Users manage their import batches"
  on public.vocabulary_import_batches for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.vocabulary_import_batches from anon, authenticated;
grant select, insert, update on public.vocabulary_import_batches to authenticated;

alter table public.vocabularies add column import_batch_id uuid;
alter table public.vocabularies
  add constraint vocabularies_import_batch_same_owner_fk
  foreign key (import_batch_id, user_id)
  references public.vocabulary_import_batches (id, user_id)
  on delete set null (import_batch_id);
create index vocabularies_import_batch_owner_idx
  on public.vocabularies (import_batch_id, user_id)
  where import_batch_id is not null;

create function public.create_vocabulary_import_batch(
  p_file_name text,
  p_vocabulary_rows jsonb,
  p_created_folder_ids uuid[] default '{}'::uuid[]
)
returns public.vocabulary_import_batches
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_batch public.vocabulary_import_batches%rowtype;
  v_row_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_vocabulary_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array' using errcode = '22023';
  end if;
  v_row_count := jsonb_array_length(p_vocabulary_rows);
  if v_row_count < 1 or v_row_count > 10000 then
    raise exception 'An import batch must contain between 1 and 10000 words' using errcode = '22023';
  end if;

  insert into public.vocabulary_import_batches (user_id, file_name, word_count, created_folder_ids)
  values (
    v_user_id,
    left(coalesce(nullif(trim(p_file_name), ''), 'Vocabulary import'), 255),
    v_row_count,
    coalesce(p_created_folder_ids, '{}'::uuid[])
  ) returning * into v_batch;

  insert into public.vocabularies (
    user_id, folder_id, word, meaning, word_type, phonetic, level, example,
    status, next_review_at, interval_days, repetitions, ease_factor,
    last_reviewed_at, import_batch_id
  )
  select
    v_user_id,
    rows.folder_id,
    rows.word,
    rows.meaning,
    coalesce(rows.word_type, 'other'::public.word_type),
    coalesce(rows.phonetic, ''),
    coalesce(rows.level, 'Band 6.5'),
    coalesce(rows.example, ''),
    coalesce(rows.status, 'new'::public.vocab_status),
    coalesce(rows.next_review_at, now()),
    coalesce(rows.interval_days, 0),
    coalesce(rows.repetitions, 0),
    coalesce(rows.ease_factor, 2.5),
    rows.last_reviewed_at,
    v_batch.id
  from jsonb_to_recordset(p_vocabulary_rows) as rows (
    folder_id uuid,
    word text,
    meaning text,
    word_type public.word_type,
    phonetic text,
    level text,
    example text,
    status public.vocab_status,
    next_review_at timestamptz,
    interval_days integer,
    repetitions integer,
    ease_factor numeric,
    last_reviewed_at timestamptz
  );

  return v_batch;
end;
$$;

revoke all on function public.create_vocabulary_import_batch(text, jsonb, uuid[]) from public, anon;
grant execute on function public.create_vocabulary_import_batch(text, jsonb, uuid[]) to authenticated;

create function public.delete_vocabulary_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_batch public.vocabulary_import_batches%rowtype;
  v_words_deleted integer := 0;
  v_folders_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_batch
  from public.vocabulary_import_batches
  where id = p_batch_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Import batch not found' using errcode = 'P0002';
  end if;
  if v_batch.deleted_at is not null then
    return jsonb_build_object('deleted', true, 'words_deleted', 0, 'words_preserved', 0, 'folders_deleted', 0);
  end if;

  -- Imported words remain removable as a batch only while they have never
  -- been edited or studied. Preserve learner progress and later edits.
  delete from public.vocabularies
  where import_batch_id = v_batch.id
    and user_id = v_user_id
    and status = 'new'
    and repetitions = 0
    and last_reviewed_at is null
    and updated_at = created_at;
  get diagnostics v_words_deleted = row_count;

  delete from public.folders folder
  where folder.id = any(v_batch.created_folder_ids)
    and folder.user_id = v_user_id
    and not exists (
      select 1 from public.vocabularies word
      where word.folder_id = folder.id and word.user_id = v_user_id
    )
    and not exists (
      select 1 from public.folders child
      where child.parent_id = folder.id and child.user_id = v_user_id
    );
  get diagnostics v_folders_deleted = row_count;

  update public.vocabulary_import_batches
  set deleted_at = now()
  where id = v_batch.id and user_id = v_user_id;

  return jsonb_build_object(
    'deleted', true,
    'words_deleted', v_words_deleted,
    'words_preserved', greatest(
      (select count(*)::integer from public.vocabularies where import_batch_id = v_batch.id and user_id = v_user_id),
      0
    ),
    'folders_deleted', v_folders_deleted
  );
end;
$$;

revoke all on function public.delete_vocabulary_import_batch(uuid) from public, anon;
grant execute on function public.delete_vocabulary_import_batch(uuid) to authenticated;
