-- Cover the referencing side of composite foreign keys for efficient deletes
-- and joins. The owner-first indexes in the initial schema serve RLS queries.
create index folders_parent_owner_fk_idx
  on public.folders (parent_id, user_id);
create index vocabularies_folder_owner_fk_idx
  on public.vocabularies (folder_id, user_id);
create index review_logs_vocabulary_owner_fk_idx
  on public.review_logs (vocabulary_id, user_id);
create index quiz_result_folders_folder_owner_fk_idx
  on public.quiz_result_folders (folder_id, user_id);
create index quiz_result_folders_result_owner_fk_idx
  on public.quiz_result_folders (quiz_result_id, user_id);
create index quiz_result_folders_user_fk_idx
  on public.quiz_result_folders (user_id);
create index mistake_logs_vocabulary_owner_fk_idx
  on public.mistake_logs (vocabulary_id, user_id);
