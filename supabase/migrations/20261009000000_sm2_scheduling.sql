-- Replace the fixed 1/3/7 day review intervals with SM-2 style scheduling:
-- intervals grow by the card's ease factor, lapses lower the ease factor, and a
-- word is only "mastered" once it is scheduled at least 21 days ahead.
-- Keep in sync with src/lib/spacedRepetition.ts (scheduleReview).
create or replace function public.record_vocabulary_review(
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
  v_ease numeric(4, 2);
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
        v_interval_days := greatest(
          v_vocabulary.interval_days + 1,
          round(v_vocabulary.interval_days * 1.2)::integer
        );
      end if;
      v_repetitions := v_vocabulary.repetitions + 1;
      v_ease := greatest(1.3, v_ease - 0.15);
    when 'good' then
      if v_vocabulary.repetitions = 0 then
        v_interval_days := 1;
      elsif v_vocabulary.repetitions = 1 then
        v_interval_days := 3;
      else
        v_interval_days := greatest(
          v_vocabulary.interval_days + 1,
          round(v_vocabulary.interval_days * v_ease)::integer
        );
      end if;
      v_repetitions := v_vocabulary.repetitions + 1;
    when 'easy' then
      if v_vocabulary.repetitions = 0 then
        v_interval_days := 4;
      elsif v_vocabulary.repetitions = 1 then
        v_interval_days := 7;
      else
        v_interval_days := greatest(
          v_vocabulary.interval_days + 1,
          round(v_vocabulary.interval_days * v_ease * 1.3)::integer
        );
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

  insert into public.review_logs (user_id, vocabulary_id, rating)
  values (v_user_id, p_vocabulary_id, p_rating);

  return v_vocabulary;
end;
$$;

-- Words marked mastered under the old fixed intervals (2 good ratings, ~6 days)
-- are re-evaluated against the new rule so mastery reflects long-term recall.
update public.vocabularies
set status = 'learning'
where status = 'mastered' and interval_days < 21;
