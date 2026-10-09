-- Explore: learners publish a folder as a shared "collection" and others subscribe to study it.
--
-- * Publishing takes a snapshot of the words (no learning progress is ever shared).
-- * Subscribing copies the words into the subscriber's own library (with fresh progress)
--   and remembers the link, so they can pull words the author adds later.
-- * Everything crosses user boundaries only through the SECURITY DEFINER functions below;
--   the tables themselves expose just what each role may read.

create type public.collection_visibility as enum ('private', 'unlisted', 'public');

-- Name and picture shown next to a collection. Rows exist only for people who publish.
create table public.public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_folder_id uuid,
  title text not null check (char_length(trim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  level text not null default 'All levels'
    check (level in ('All levels', 'Band 5.0-6.0', 'Band 6.0-7.0', 'Band 7.0+')),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  visibility public.collection_visibility not null default 'private',
  word_count integer not null default 0 check (word_count between 0 and 2000),
  subscriber_count integer not null default 0 check (subscriber_count >= 0),
  -- Bumped only when the words themselves change, so subscribers see "updates" only for real ones.
  version integer not null default 1,
  content_hash text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_source_folder_fk
    foreign key (source_folder_id, owner_id)
    references public.folders (id, user_id)
    on delete set null (source_folder_id),
  constraint collections_source_folder_unique unique (source_folder_id)
);

create table public.collection_words (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  position integer not null,
  word text not null,
  meaning text not null,
  word_type public.word_type not null default 'noun',
  phonetic text not null default '',
  level text not null default '',
  example text not null default ''
);

create table public.collection_subscriptions (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  subscriber_id uuid not null references auth.users (id) on delete cascade,
  local_folder_id uuid,
  synced_version integer not null,
  created_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  constraint collection_subscriptions_folder_fk
    foreign key (local_folder_id, subscriber_id)
    references public.folders (id, user_id)
    on delete set null (local_folder_id),
  constraint collection_subscriptions_unique unique (collection_id, subscriber_id)
);

create table public.collection_reports (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'copyright', 'inaccurate', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  constraint collection_reports_unique unique (collection_id, reporter_id)
);

create index collections_public_popular_idx on public.collections (subscriber_count desc, published_at desc)
  where visibility = 'public';
create index collections_public_new_idx on public.collections (published_at desc)
  where visibility = 'public';
create index collections_owner_idx on public.collections (owner_id);
create index collection_words_collection_idx on public.collection_words (collection_id, position);
create index collection_subscriptions_subscriber_idx on public.collection_subscriptions (subscriber_id);
create index collection_reports_collection_idx on public.collection_reports (collection_id);

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- Keep the subscriber counter honest no matter how a subscription is added or removed.
create function public.refresh_subscriber_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection_id uuid := case when tg_op = 'DELETE' then old.collection_id else new.collection_id end;
begin
  update public.collections
  set subscriber_count = (
    select count(*) from public.collection_subscriptions where collection_id = v_collection_id
  )
  where id = v_collection_id;
  return null;
end;
$$;

create trigger collection_subscriptions_count
  after insert or delete on public.collection_subscriptions
  for each row execute function public.refresh_subscriber_count();

revoke all on function public.refresh_subscriber_count() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.public_profiles enable row level security;
alter table public.collections enable row level security;
alter table public.collection_words enable row level security;
alter table public.collection_subscriptions enable row level security;
alter table public.collection_reports enable row level security;

create policy "Signed-in users read profiles"
  on public.public_profiles for select to authenticated using (true);
create policy "Users create their profile"
  on public.public_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their profile"
  on public.public_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Unlisted collections are deliberately not readable here, so they cannot be enumerated.
create policy "Read public collections and your own"
  on public.collections for select to authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy "Owners delete their collections"
  on public.collections for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners read their collection words"
  on public.collection_words for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_words.collection_id and c.owner_id = (select auth.uid())
  ));

create policy "Subscribers read their subscriptions"
  on public.collection_subscriptions for select to authenticated
  using (subscriber_id = (select auth.uid()));
create policy "Subscribers remove their subscriptions"
  on public.collection_subscriptions for delete to authenticated
  using (subscriber_id = (select auth.uid()));

create policy "Reporters read their reports"
  on public.collection_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

revoke all on
  public.public_profiles, public.collections, public.collection_words,
  public.collection_subscriptions, public.collection_reports
  from anon, authenticated;
grant select, insert, update on public.public_profiles to authenticated;
grant select, delete on public.collections to authenticated;
grant select on public.collection_words to authenticated;
grant select, delete on public.collection_subscriptions to authenticated;
grant select on public.collection_reports to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- All folder ids at or below a folder (cycle safe thanks to UNION).
create function public.folder_tree_ids(p_user_id uuid, p_folder_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive tree as (
    select id from public.folders where id = p_folder_id and user_id = p_user_id
    union
    select f.id from public.folders f join tree t on f.parent_id = t.id where f.user_id = p_user_id
  )
  select id from tree;
$$;

revoke all on function public.folder_tree_ids(uuid, uuid) from public, anon, authenticated;

-- Publish (or update) a folder as a collection. Words in subfolders are flattened in.
create function public.publish_collection(
  p_folder_id uuid,
  p_title text,
  p_description text,
  p_level text,
  p_tags text[],
  p_visibility public.collection_visibility,
  p_author_name text,
  p_author_avatar text
)
returns public.collections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_collection public.collections%rowtype;
  v_count integer;
  v_hash text;
  v_tags text[];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.folders where id = p_folder_id and user_id = v_user_id) then
    raise exception 'Folder not found' using errcode = 'P0002';
  end if;

  with distinct_words as (
    select distinct on (lower(v.word)) v.word, v.meaning, v.word_type, v.phonetic, v.example
    from public.vocabularies v
    where v.user_id = v_user_id
      and v.folder_id in (select public.folder_tree_ids(v_user_id, p_folder_id))
    order by lower(v.word), v.created_at, v.id
  )
  select count(*),
         md5(coalesce(string_agg(lower(word) || '|' || meaning || '|' || word_type::text || '|' || phonetic || '|' || example,
                                 E'\n' order by lower(word)), ''))
  into v_count, v_hash
  from distinct_words;

  if p_visibility <> 'private' and v_count < 5 then
    raise exception 'A shared collection needs at least 5 words';
  end if;
  if v_count > 2000 then
    raise exception 'A collection can hold at most 2000 words';
  end if;

  -- Keep the first five distinct tags in the order the author typed them.
  select coalesce(array_agg(cleaned.tag order by cleaned.first_position), '{}') into v_tags
  from (
    select left(lower(trim(u.t)), 24) as tag, min(u.ord) as first_position
    from unnest(coalesce(p_tags, '{}')) with ordinality as u(t, ord)
    where trim(u.t) <> ''
    group by 1
    order by min(u.ord)
    limit 5
  ) cleaned;

  insert into public.public_profiles (user_id, display_name, avatar_url)
  values (v_user_id, left(coalesce(nullif(trim(p_author_name), ''), 'Learner'), 40), left(nullif(trim(p_author_avatar), ''), 500))
  on conflict (user_id) do update
    set display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = now();

  insert into public.collections (
    owner_id, source_folder_id, title, description, level, tags, visibility,
    word_count, content_hash, published_at
  ) values (
    v_user_id, p_folder_id, trim(p_title), coalesce(p_description, ''), coalesce(p_level, 'All levels'), v_tags,
    p_visibility, v_count, v_hash, case when p_visibility = 'private' then null else now() end
  )
  on conflict (source_folder_id) do update set
    title = excluded.title,
    description = excluded.description,
    level = excluded.level,
    tags = excluded.tags,
    visibility = excluded.visibility,
    word_count = excluded.word_count,
    version = case when public.collections.content_hash is distinct from excluded.content_hash
                   then public.collections.version + 1 else public.collections.version end,
    content_hash = excluded.content_hash,
    published_at = case when excluded.visibility = 'private' then null
                        else coalesce(public.collections.published_at, now()) end
  returning * into v_collection;

  delete from public.collection_words where collection_id = v_collection.id;
  insert into public.collection_words (collection_id, position, word, meaning, word_type, phonetic, level, example)
  select v_collection.id, row_number() over (order by d.created_at, d.id), d.word, d.meaning, d.word_type,
         d.phonetic, d.level, d.example
  from (
    select distinct on (lower(v.word)) v.*
    from public.vocabularies v
    where v.user_id = v_user_id
      and v.folder_id in (select public.folder_tree_ids(v_user_id, p_folder_id))
    order by lower(v.word), v.created_at, v.id
  ) d;

  return v_collection;
end;
$$;

-- Copy a collection into the caller's library as a new folder and remember the link.
create function public.subscribe_to_collection(p_collection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_collection public.collections%rowtype;
  v_folder_id uuid;
  v_added integer;
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_collection
  from public.collections
  where id = p_collection_id and visibility in ('public', 'unlisted');
  if not found then
    raise exception 'Collection not found' using errcode = 'P0002';
  end if;
  if v_collection.owner_id = v_user_id then
    raise exception 'This is your own collection';
  end if;
  if exists (
    select 1 from public.collection_subscriptions
    where collection_id = p_collection_id and subscriber_id = v_user_id
  ) then
    raise exception 'You are already subscribed to this collection';
  end if;

  insert into public.folders (user_id, name)
  values (v_user_id, left(v_collection.title, 120))
  returning id into v_folder_id;

  -- Words the learner already has (in any folder) are skipped so nothing is studied twice.
  insert into public.vocabularies (user_id, folder_id, word, meaning, word_type, phonetic, level, example)
  select v_user_id, v_folder_id, w.word, w.meaning, w.word_type, w.phonetic,
         case when w.level = '' then 'Band 6.5' else w.level end, w.example
  from public.collection_words w
  where w.collection_id = v_collection.id
    and not exists (
      select 1 from public.vocabularies v where v.user_id = v_user_id and lower(v.word) = lower(w.word)
    )
  order by w.position;
  get diagnostics v_added = row_count;

  select count(*) into v_total from public.collection_words where collection_id = v_collection.id;

  insert into public.collection_subscriptions (collection_id, subscriber_id, local_folder_id, synced_version)
  values (v_collection.id, v_user_id, v_folder_id, v_collection.version);

  return jsonb_build_object('folder_id', v_folder_id, 'added', v_added, 'skipped', v_total - v_added);
end;
$$;

-- Pull words the author added since the subscriber last synced.
create function public.sync_subscription(p_collection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_subscription public.collection_subscriptions%rowtype;
  v_collection public.collections%rowtype;
  v_folder_id uuid;
  v_added integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_subscription
  from public.collection_subscriptions
  where collection_id = p_collection_id and subscriber_id = v_user_id
  for update;
  if not found then
    raise exception 'You are not subscribed to this collection' using errcode = 'P0002';
  end if;

  select * into v_collection
  from public.collections
  where id = p_collection_id and visibility in ('public', 'unlisted');
  if not found then
    raise exception 'The author is no longer sharing this collection' using errcode = 'P0002';
  end if;

  v_folder_id := v_subscription.local_folder_id;
  if v_folder_id is null or not exists (
    select 1 from public.folders where id = v_folder_id and user_id = v_user_id
  ) then
    insert into public.folders (user_id, name)
    values (v_user_id, left(v_collection.title, 120))
    returning id into v_folder_id;
  end if;

  insert into public.vocabularies (user_id, folder_id, word, meaning, word_type, phonetic, level, example)
  select v_user_id, v_folder_id, w.word, w.meaning, w.word_type, w.phonetic,
         case when w.level = '' then 'Band 6.5' else w.level end, w.example
  from public.collection_words w
  where w.collection_id = v_collection.id
    and not exists (
      select 1 from public.vocabularies v where v.user_id = v_user_id and lower(v.word) = lower(w.word)
    )
  order by w.position;
  get diagnostics v_added = row_count;

  update public.collection_subscriptions
  set synced_version = v_collection.version, last_synced_at = now(), local_folder_id = v_folder_id
  where id = v_subscription.id;

  return jsonb_build_object('folder_id', v_folder_id, 'added', v_added);
end;
$$;

-- Browse public collections.
create function public.list_collections(
  p_search text default null,
  p_level text default null,
  p_sort text default 'popular',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  level text,
  tags text[],
  word_count integer,
  subscriber_count integer,
  version integer,
  published_at timestamptz,
  author_name text,
  author_avatar text,
  is_owner boolean,
  is_subscribed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.owner_id, c.title, c.description, c.level, c.tags, c.word_count, c.subscriber_count,
         c.version, c.published_at, p.display_name, p.avatar_url,
         c.owner_id = (select auth.uid()),
         exists (select 1 from public.collection_subscriptions s
                 where s.collection_id = c.id and s.subscriber_id = (select auth.uid()))
  from public.collections c
  left join public.public_profiles p on p.user_id = c.owner_id
  where (select auth.uid()) is not null
    and c.visibility = 'public'
    and c.word_count > 0
    and (p_level is null or p_level = '' or c.level = p_level)
    and (
      coalesce(trim(p_search), '') = ''
      or position(lower(trim(p_search)) in lower(c.title)) > 0
      or position(lower(trim(p_search)) in lower(c.description)) > 0
      or exists (select 1 from unnest(c.tags) t where position(lower(trim(p_search)) in t) > 0)
    )
  order by
    case when p_sort = 'new' then extract(epoch from c.published_at) else c.subscriber_count end desc,
    c.published_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- One collection by id (public, unlisted via link, or your own).
create function public.get_collection(p_collection_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  level text,
  tags text[],
  visibility public.collection_visibility,
  word_count integer,
  subscriber_count integer,
  version integer,
  published_at timestamptz,
  author_name text,
  author_avatar text,
  is_owner boolean,
  is_subscribed boolean,
  synced_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.owner_id, c.title, c.description, c.level, c.tags, c.visibility, c.word_count,
         c.subscriber_count, c.version, c.published_at, p.display_name, p.avatar_url,
         c.owner_id = (select auth.uid()),
         s.id is not null,
         s.synced_version
  from public.collections c
  left join public.public_profiles p on p.user_id = c.owner_id
  left join public.collection_subscriptions s
    on s.collection_id = c.id and s.subscriber_id = (select auth.uid())
  where (select auth.uid()) is not null
    and c.id = p_collection_id
    and (c.visibility in ('public', 'unlisted') or c.owner_id = (select auth.uid()));
$$;

create function public.get_collection_words(p_collection_id uuid, p_limit integer default 20)
returns table (
  "position" integer,
  word text,
  meaning text,
  word_type public.word_type,
  phonetic text,
  level text,
  example text
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.position, w.word, w.meaning, w.word_type, w.phonetic, w.level, w.example
  from public.collection_words w
  join public.collections c on c.id = w.collection_id
  where (select auth.uid()) is not null
    and w.collection_id = p_collection_id
    and (c.visibility in ('public', 'unlisted') or c.owner_id = (select auth.uid()))
  order by w.position
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
$$;

create function public.list_my_subscriptions()
returns table (
  collection_id uuid,
  local_folder_id uuid,
  synced_version integer,
  last_synced_at timestamptz,
  title text,
  author_name text,
  author_avatar text,
  version integer,
  word_count integer,
  is_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.collection_id, s.local_folder_id, s.synced_version, s.last_synced_at, c.title,
         p.display_name, p.avatar_url, c.version, c.word_count, c.visibility <> 'private'
  from public.collection_subscriptions s
  join public.collections c on c.id = s.collection_id
  left join public.public_profiles p on p.user_id = c.owner_id
  where s.subscriber_id = (select auth.uid());
$$;

create function public.report_collection(p_collection_id uuid, p_reason text, p_details text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.collections
    where id = p_collection_id and visibility in ('public', 'unlisted') and owner_id <> v_user_id
  ) then
    raise exception 'Collection not found' using errcode = 'P0002';
  end if;
  insert into public.collection_reports (collection_id, reporter_id, reason, details)
  values (p_collection_id, v_user_id, p_reason, left(coalesce(p_details, ''), 500))
  on conflict (collection_id, reporter_id) do update set reason = excluded.reason, details = excluded.details;
end;
$$;

revoke all on function
  public.publish_collection(uuid, text, text, text, text[], public.collection_visibility, text, text),
  public.subscribe_to_collection(uuid),
  public.sync_subscription(uuid),
  public.list_collections(text, text, text, integer, integer),
  public.get_collection(uuid),
  public.get_collection_words(uuid, integer),
  public.list_my_subscriptions(),
  public.report_collection(uuid, text, text)
  from public, anon;
grant execute on function
  public.publish_collection(uuid, text, text, text, text[], public.collection_visibility, text, text),
  public.subscribe_to_collection(uuid),
  public.sync_subscription(uuid),
  public.list_collections(text, text, text, integer, integer),
  public.get_collection(uuid),
  public.get_collection_words(uuid, integer),
  public.list_my_subscriptions(),
  public.report_collection(uuid, text, text)
  to authenticated;
