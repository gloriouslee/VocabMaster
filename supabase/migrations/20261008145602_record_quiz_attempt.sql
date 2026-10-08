-- Save a quiz result, its folder scope, and its missed answers atomically.
create function public.record_quiz_attempt(
  p_score_percent integer,
  p_total_questions integer,
  p_correct_count integer,
  p_wrong_count integer,
  p_folder_ids uuid[] default '{}'::uuid[],
  p_mistakes jsonb default '[]'::jsonb
)
returns public.quiz_results
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result public.quiz_results%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
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

  return v_result;
end;
$$;

revoke all on function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb)
  from public, anon;
grant execute on function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb)
  to authenticated;
