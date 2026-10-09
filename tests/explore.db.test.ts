import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { describe, it } from 'vitest';

/*
 * Runs the real SQL migrations on an in-process Postgres (PGlite) with stand-ins for
 * Supabase's auth schema and roles, then exercises sharing, subscribing, syncing and the
 * row level security rules as different users.
 */
const dir = 'supabase/migrations/';

describe('Explore migration (real Postgres)', () => {
  it('enforces sharing, subscription and security rules', async () => {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);

    for (const file of [
      '20261008144108_vocabmaster_schema.sql',
      '20261008144143_index_foreign_keys.sql',
      '20261008144349_restrict_table_grants.sql',
      '20261009030000_explore_collections.sql',
    ]) {
      try {
        await db.exec(readFileSync(dir + file, 'utf8'));
          } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }

    const A = '00000000-0000-0000-0000-00000000000a';
    const B = '00000000-0000-0000-0000-00000000000b';
    const C = '00000000-0000-0000-0000-00000000000c';
    await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${C}')`);

    // Run SQL as a signed-in user (RLS applies) and return rows.
    async function as(user: string, sql: string, params: unknown[] = []): Promise<any[]> {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false)`);
      try {
        return (await db.query<any>(sql, params)).rows;
      } finally {
        await db.exec(`reset role`);
      }
    }
    const fails = async (user: string, sql: string, params: unknown[], pattern: RegExp) => {
      await assert.rejects(() => as(user, sql, params), pattern);
    };

    // --- Author A builds a folder tree with words ---
    const [folder] = await as(A, `insert into public.folders (user_id, name) values ('${A}', 'Environment') returning id`);
    const [sub] = await as(A, `insert into public.folders (user_id, name, parent_id) values ('${A}', 'Energy', '${folder.id}') returning id`);
    const words = ['mitigate', 'sustainable', 'emission', 'renewable', 'biodiversity'];
    for (const [i, w] of words.entries()) {
      await as(A, `insert into public.vocabularies (user_id, folder_id, word, meaning, example) values ('${A}', $1, $2, $3, $4)`,
        [i < 4 ? folder.id : sub.id, w, 'meaning of ' + w, 'Example with ' + w]);
    }
    // A duplicate (different case) and progress that must never be shared.
    await as(A, `insert into public.vocabularies (user_id, folder_id, word, meaning, status, repetitions, ease_factor) values ('${A}', $1, 'Mitigate', 'dup', 'mastered', 9, 1.5)`, [folder.id]);

    // --- Publishing rules ---
    await fails(A, `select public.publish_collection($1, 'Env words', '', 'All levels', '{}', 'public', 'Alice', null)`, ['00000000-0000-0000-0000-000000000099'], /Folder not found/);
    await fails(B, `select public.publish_collection($1, 'Env words', '', 'All levels', '{}', 'public', 'Bob', null)`, [folder.id], /Folder not found/);
    const [published] = await as(A, `select * from public.publish_collection($1, 'Environment essentials', 'Core words', 'Band 6.0-7.0', array['Climate','climate',' IELTS ','','a','b','c','d'], 'public', 'Alice', null)`, [folder.id]);
    assert.equal(published.word_count, 5, 'duplicates collapsed, subfolder flattened');
    assert.equal(published.version, 1);
    assert.equal(published.visibility, 'public');
    assert.ok(published.tags.length <= 5 && published.tags.includes('climate'), 'tags cleaned: ' + published.tags);
    const snapshot = await db.query<any>(`select word from public.collection_words where collection_id = $1 order by position`, [published.id]);
    assert.equal(snapshot.rows.length, 5);

    // Editing only the description must not bump the version; changing words must.
    const [meta] = await as(A, `select * from public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'public', 'Alice', null)`, [folder.id]);
    assert.equal(meta.version, 1, 'metadata edit keeps version');
    await as(A, `insert into public.vocabularies (user_id, folder_id, word, meaning) values ('${A}', $1, 'pollutant', 'chat o nhiem')`, [folder.id]);
    const [bumped] = await as(A, `select * from public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'public', 'Alice', null)`, [folder.id]);
    assert.equal(bumped.version, 2, 'new word bumps version');
    assert.equal(bumped.word_count, 6);

    // Too few words cannot be shared; private can.
    const [small] = await as(A, `insert into public.folders (user_id, name) values ('${A}', 'Tiny') returning id`);
    await fails(A, `select public.publish_collection($1, 'Tiny collection', '', 'All levels', '{}', 'public', 'Alice', null)`, [small.id], /at least 5 words/);
    await as(A, `select public.publish_collection($1, 'Tiny collection', '', 'All levels', '{}', 'private', 'Alice', null)`, [small.id]);

    // --- Visibility ---
    let list = await as(B, `select * from public.list_collections()`);
    assert.equal(list.length, 1);
    assert.equal(list[0].author_name, 'Alice');
    assert.equal(list[0].is_subscribed, false);
    assert.equal((await as(B, `select * from public.list_collections('ENVIRON')`)).length, 1, 'search is case-insensitive');
    assert.equal((await as(B, `select * from public.list_collections('climate')`)).length, 0, 'tags were reset by the later publish');
    assert.equal((await as(B, `select * from public.list_collections(null, 'Band 7.0+')`)).length, 0, 'level filter');
    assert.equal((await as(B, `select * from public.list_collections('%')`)).length, 0, 'wildcards are literal');
    assert.equal((await as(B, `select * from public.collections`)).length, 1, 'B sees public rows only');
    assert.equal((await as(B, `select * from public.collection_words`)).length, 0, 'raw words are not readable by others');
    assert.equal((await as(A, `select * from public.collection_words`)).length, 6, 'owner reads own words');
    assert.equal((await as(B, `select * from public.get_collection_words($1, 3)`, [published.id])).length, 3);
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);

    // --- Subscribe ---
    await as(B, `insert into public.vocabularies (user_id, word, meaning) values ('${B}', 'Emission', 'already have it')`);
    const [sub1] = await as(B, `select public.subscribe_to_collection($1) as r`, [published.id]);
    assert.equal(sub1.r.added, 5, '6 words minus the one B already had');
    assert.equal(sub1.r.skipped, 1);
    const bWords = await as(B, `select word, status, folder_id from public.vocabularies where folder_id = $1`, [sub1.r.folder_id]);
    assert.equal(bWords.length, 5);
    assert.ok(bWords.every((w) => w.status === 'new'), 'fresh progress, nothing inherited');
    await fails(B, `select public.subscribe_to_collection($1)`, [published.id], /already subscribed/);
    await fails(A, `select public.subscribe_to_collection($1)`, [published.id], /your own collection/);
    assert.equal((await db.query<any>(`select subscriber_count from public.collections where id = $1`, [published.id])).rows[0].subscriber_count, 1);
    list = await as(B, `select * from public.list_collections()`);
    assert.equal(list[0].is_subscribed, true);

    // --- Sync only brings new words ---
    await as(A, `insert into public.vocabularies (user_id, folder_id, word, meaning) values ('${A}', $1, 'deforestation', 'pha rung'), ('${A}', $1, 'conserve', 'bao ton')`, [folder.id]);
    await as(A, `select public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'public', 'Alice', null)`, [folder.id]);
    let [mine] = await as(B, `select * from public.list_my_subscriptions()`);
    assert.equal(mine.synced_version, 2);
    assert.equal(mine.version, 3);
    const [synced] = await as(B, `select public.sync_subscription($1) as r`, [published.id]);
    assert.equal(synced.r.added, 2);
    const [again] = await as(B, `select public.sync_subscription($1) as r`, [published.id]);
    assert.equal(again.r.added, 0, 'second sync adds nothing');
    [mine] = await as(B, `select * from public.list_my_subscriptions()`);
    assert.equal(mine.synced_version, 3);
    await fails(C, `select public.sync_subscription($1)`, [published.id], /not subscribed/);

    // Deleting the local folder: sync recreates it.
    await as(B, `delete from public.folders where id = $1`, [sub1.r.folder_id]);
    await as(A, `insert into public.vocabularies (user_id, folder_id, word, meaning) values ('${A}', $1, 'habitat', 'moi truong song')`, [folder.id]);
    await as(A, `select public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'public', 'Alice', null)`, [folder.id]);
    const [recreated] = await as(B, `select public.sync_subscription($1) as r`, [published.id]);
    assert.ok(recreated.r.folder_id && recreated.r.folder_id !== sub1.r.folder_id, 'folder recreated');

    // --- Unlisted: not enumerable, reachable by id ---
    await as(A, `select public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'unlisted', 'Alice', null)`, [folder.id]);
    assert.equal((await as(C, `select * from public.list_collections()`)).length, 0, 'unlisted is not listed');
    assert.equal((await as(C, `select * from public.collections`)).length, 0, 'unlisted is not selectable');
    assert.equal((await as(C, `select * from public.get_collection($1)`, [published.id])).length, 1, 'but reachable by id');
    const [cSub] = await as(C, `select public.subscribe_to_collection($1) as r`, [published.id]);
    assert.ok(cSub.r.added >= 7);

    // --- Private hides it from everyone but the owner; sync reports it ---
    await as(A, `select public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'private', 'Alice', null)`, [folder.id]);
    assert.equal((await as(C, `select * from public.get_collection($1)`, [published.id])).length, 0);
    assert.equal((await as(A, `select * from public.get_collection($1)`, [published.id])).length, 1, 'owner still sees it');
    await fails(B, `select public.sync_subscription($1)`, [published.id], /no longer sharing/);
    await fails(C, `select public.subscribe_to_collection($1)`, [published.id], /not found/);
    const subs = await as(B, `select * from public.list_my_subscriptions()`);
    assert.equal(subs[0].is_available, false);

    // --- Reports ---
    await as(A, `select public.publish_collection($1, 'Environment essentials', 'New description', 'Band 6.0-7.0', '{}', 'public', 'Alice', null)`, [folder.id]);
    await as(B, `select public.report_collection($1, 'spam', 'looks like spam')`, [published.id]);
    await as(B, `select public.report_collection($1, 'copyright', '')`, [published.id]);
    assert.equal((await db.query<any>(`select reason from public.collection_reports`)).rows.length, 1, 'one report per user, updated');
    await fails(A, `select public.report_collection($1, 'spam', '')`, [published.id], /not found/);
    await fails(B, `select public.report_collection($1, 'bogus', '')`, [published.id], /check constraint/);
    assert.equal((await as(A, `select * from public.collection_reports`)).length, 0, 'owners cannot read reports about them');

    // --- Unsubscribe and counters ---
    await as(B, `delete from public.collection_subscriptions where collection_id = $1`, [published.id]);
    assert.equal((await db.query<any>(`select subscriber_count from public.collections where id = $1`, [published.id])).rows[0].subscriber_count, 1);
    assert.equal((await as(B, `select * from public.collection_subscriptions`)).length, 0);

    // --- Security: clients cannot write shared tables directly ---
    await fails(B, `insert into public.collections (owner_id, title) values ('${B}', 'Forged')`, [], /permission denied/);
    await fails(B, `update public.collections set subscriber_count = 999`, [], /permission denied/);
    await fails(B, `insert into public.collection_subscriptions (collection_id, subscriber_id, synced_version) values ($1, '${B}', 1)`, [published.id], /permission denied/);
    await fails(B, `delete from public.collections where id = $1`, [published.id], /./).catch(() => undefined);
    assert.equal((await db.query<any>(`select count(*)::int as n from public.collections where id = $1`, [published.id])).rows[0].n, 1, 'B cannot delete the collection');

    // --- Deleting the source folder keeps the collection (snapshot) ---
    await as(A, `delete from public.folders where id = $1`, [folder.id]);
    const [orphan] = await db.query<any>(`select source_folder_id, word_count from public.collections where id = $1`, [published.id]).then((r) => r.rows);
    assert.equal(orphan.source_folder_id, null);
    assert.equal(orphan.word_count, 9);

    // --- Anonymous users get nothing ---
    await db.exec(`set role anon`);
    await assert.rejects(() => db.query<any>(`select * from public.list_collections()`), /permission denied/);
    await db.exec(`reset role`);
  }, 120_000);
});
