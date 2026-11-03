import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('persists relearning, schedules recovery once, isolates practice and rejects stale progress', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    for (const file of [
      '20261008144108_vocabmaster_schema.sql',
      '20261008144349_restrict_table_grants.sql',
      '20261008145602_record_quiz_attempt.sql',
      '20261008155252_study_sessions.sql',
      '20261009000000_sm2_scheduling.sql',
      '20261014162648_quiz_reviews_share_study_schedule.sql',
      '20261015120000_quiz_schedule_opt_in_and_metadata.sql',
      '20261103143035_persist_relearning.sql',
    ]) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    const user = '00000000-0000-0000-0000-000000000001';
    await db.exec(`insert into auth.users values ('${user}'); set role authenticated;
      select set_config('request.jwt.claim.sub', '${user}', false);`);
    const query = async (sql: string, args: unknown[] = []) => (await db.query<any>(sql, args)).rows;
    const [word] = await query(`insert into public.vocabularies(user_id,word,meaning) values ($1,'remember','nho') returning *`, [user]);
    const start = async (practice = false) => (await query('select * from public.start_study_session($1,$2)', [[word.id], practice]))[0];
    const rate = async (id: string, rating: string, index: number) => (await query('select * from public.record_study_session_review($1,$2,$3,$4)', [id,word.id,rating,index]))[0];
    const currentWord = async () => (await query('select * from public.vocabularies where id=$1',[word.id]))[0];
    let session = await start();
    session = await rate(session.id,'forgot',0);
    expect(session.vocabulary_ids).toEqual([word.id,word.id]);
    expect(session.relearn_flags).toEqual([false,true]);
    expect(session.current_index).toBe(1);
    // Read it afresh, as when returning after Pause or a page reload.
    expect((await query('select * from public.study_sessions where id=$1',[session.id]))[0]).toEqual(session);
    await expect(rate(session.id,'good',0)).rejects.toThrow(/out of date/);
    session = await rate(session.id,'hard',1);
    expect(session.relearn_flags).toEqual([false,true,true]);
    session = await rate(session.id,'good',2);
    expect(session.current_index).toBe(3);
    expect(session.rating_counts).toEqual({forgot:1,hard:0,good:0,easy:0});
    const recovered = await currentWord();
    expect(recovered.interval_days).toBe(1);
    expect(recovered.repetitions).toBe(1);
    expect(new Date(recovered.next_review_at).getTime()).toBeGreaterThan(Date.now()+23*60*60*1000);
    expect((await query('select * from public.review_logs')).length).toBe(1);
    session = await start(true);
    session = await rate(session.id,'forgot',0);
    await rate(session.id,'easy',1);
    expect(await currentWord()).toEqual(recovered);
    expect((await query('select * from public.review_logs')).length).toBe(1);
    session = await start();
    await rate(session.id,'easy',0);
    expect(await currentWord()).toEqual(recovered);
    await query("select public.record_vocabulary_review($1,'good','quiz')", [word.id]);
    expect(await currentWord()).toEqual(recovered);
    // A new quiz failure still returns the word for review.
    await query("select public.record_vocabulary_review($1,'forgot','quiz')", [word.id]);
    expect((await currentWord()).interval_days).toBe(0);
    // Hard on the first attempt followed by forgetting during relearning must recover too.
    session = await start();
    session = await rate(session.id,'hard',0);
    session = await rate(session.id,'forgot',1);
    expect((await currentWord()).interval_days).toBe(0);
    await rate(session.id,'easy',2);
    expect((await currentWord()).interval_days).toBe(1);
  } finally { await db.close(); }
}, 20000);
