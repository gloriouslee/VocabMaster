-- Fixes publish_collection: keep the first five tags in the order the author typed them
-- (the first version of the function picked five arbitrary tags).
-- Only needed if 20261009030000_explore_collections.sql was applied before this fix.

create or replace function public.publish_collection(
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
