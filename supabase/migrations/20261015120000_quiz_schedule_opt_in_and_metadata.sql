alter table public.quiz_results
  add column quiz_source text check (quiz_source in ('random', 'weak', 'due', 'mastered')),
  add column quiz_format text check (quiz_format in ('mixed', 'mcq', 'reverse', 'cloze', 'typing', 'listening'));

drop function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb, jsonb);

create function public.record_quiz_attempt(
  p_score_percent integer,
  p_total_questions integer,
  p_correct_count integer,
  p_wrong_count integer,
  p_folder_ids uuid[],
  p_mistakes jsonb,
  p_reviews jsonb,
  p_quiz_source text,
  p_quiz_format text,
  p_apply_reviews boolean
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
  if p_quiz_source not in ('random', 'weak', 'due', 'mastered') then
    raise exception 'Invalid quiz source' using errcode = '22023';
  end if;
  if p_quiz_format not in ('mixed', 'mcq', 'reverse', 'cloze', 'typing', 'listening') then
    raise exception 'Invalid quiz format' using errcode = '22023';
  end if;

  if p_apply_reviews and exists (
    select 1
    from jsonb_to_recordset(coalesce(p_reviews, '[]'::jsonb)) as item(vocabulary_id uuid, rating text)
    where item.rating is null or item.rating not in ('forgot', 'good')
  ) then
    raise exception 'Quiz review ratings must be forgot or good' using errcode = '22023';
  end if;

  insert into public.quiz_results (
    user_id, score_percent, total_questions, correct_count, wrong_count, quiz_source, quiz_format
  ) values (
    v_user_id, p_score_percent, p_total_questions, p_correct_count, p_wrong_count, p_quiz_source, p_quiz_format
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

  if p_apply_reviews then
    -- One outcome per word; if repeated, prefer the conservative lapse rating.
    for v_review in
      select item.vocabulary_id,
             case when bool_or(item.rating = 'forgot') then 'forgot' else 'good' end as rating
      from jsonb_to_recordset(coalesce(p_reviews, '[]'::jsonb)) as item(vocabulary_id uuid, rating text)
      group by item.vocabulary_id
    loop
      perform public.record_vocabulary_review(v_review.vocabulary_id, v_review.rating::public.review_rating, 'quiz');
    end loop;
  end if;

  return v_result;
end;
$$;

revoke all on function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb, jsonb, text, text, boolean)
  from public, anon;
grant execute on function public.record_quiz_attempt(integer, integer, integer, integer, uuid[], jsonb, jsonb, text, text, boolean)
  to authenticated;
