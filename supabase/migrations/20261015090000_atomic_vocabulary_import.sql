-- Create import-owned folders and vocabulary in one transaction. The RPC is
-- invoker-security so all inserted rows remain subject to the caller's RLS.
drop function public.create_vocabulary_import_batch(text, jsonb, uuid[]);

create function public.create_vocabulary_import_batch(
  p_file_name text,
  p_vocabulary_rows jsonb,
  p_created_folders jsonb default '[]'::jsonb
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
  v_folder_ids uuid[] := '{}'::uuid[];
  v_folder record;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_vocabulary_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_created_folders, '[]'::jsonb)) <> 'array' then
    raise exception 'Created folders must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_created_folders, '[]'::jsonb)) > 10000 then
    raise exception 'An import may create at most 10000 folders' using errcode = '22023';
  end if;
  v_row_count := jsonb_array_length(p_vocabulary_rows);
  if v_row_count < 1 or v_row_count > 10000 then
    raise exception 'An import batch must contain between 1 and 10000 words' using errcode = '22023';
  end if;

  insert into public.vocabulary_import_batches (user_id, file_name, word_count)
  values (
    v_user_id,
    left(coalesce(nullif(trim(p_file_name), ''), 'Vocabulary import'), 255),
    v_row_count
  ) returning * into v_batch;

  for v_folder in
    select item.id, left(trim(item.name), 120) as name
    from jsonb_to_recordset(coalesce(p_created_folders, '[]'::jsonb)) as item(id uuid, name text)
  loop
    if v_folder.name <> '' then
      insert into public.folders (id, user_id, name, parent_id)
      values (v_folder.id, v_user_id, v_folder.name, null);
      v_folder_ids := array_append(v_folder_ids, v_folder.id);
    end if;
  end loop;

  update public.vocabulary_import_batches
  set created_folder_ids = v_folder_ids
  where id = v_batch.id and user_id = v_user_id
  returning * into v_batch;

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

revoke all on function public.create_vocabulary_import_batch(text, jsonb, jsonb) from public, anon;
grant execute on function public.create_vocabulary_import_batch(text, jsonb, jsonb) to authenticated;
