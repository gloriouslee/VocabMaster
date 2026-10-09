import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { WordType } from '@/types';
import { profileFromUser } from '@/lib/profile';

export type CollectionVisibility = Database['public']['Enums']['collection_visibility'];
export type CollectionSort = 'popular' | 'new';

export const COLLECTION_LEVELS = ['All levels', 'Band 5.0-6.0', 'Band 6.0-7.0', 'Band 7.0+'] as const;
export type CollectionLevel = (typeof COLLECTION_LEVELS)[number];

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'copyright', label: 'Copied from a copyrighted source' },
  { value: 'inaccurate', label: 'Wrong or misleading words' },
  { value: 'other', label: 'Something else' },
] as const;

export const MIN_WORDS_TO_SHARE = 5;
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;
export const TITLE_RANGE = { min: 3, max: 80 } as const;
export const DESCRIPTION_MAX = 500;

export interface CollectionCard {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  level: string;
  tags: string[];
  wordCount: number;
  subscriberCount: number;
  version: number;
  publishedAt: string | null;
  authorName: string;
  authorAvatar: string | null;
  isOwner: boolean;
  isSubscribed: boolean;
}

export interface CollectionDetail extends CollectionCard {
  visibility: CollectionVisibility;
  /** Version the learner last pulled, or null when they are not subscribed. */
  syncedVersion: number | null;
}

export interface CollectionWord {
  position: number;
  word: string;
  meaning: string;
  wordType: WordType;
  phonetic: string;
  level: string;
  example: string;
}

export interface MySubscription {
  collectionId: string;
  localFolderId: string | null;
  syncedVersion: number;
  version: number;
  title: string;
  authorName: string;
  authorAvatar: string | null;
  wordCount: number;
  lastSyncedAt: string;
  /** False when the author stopped sharing it. */
  isAvailable: boolean;
  hasUpdate: boolean;
}

export interface MyCollection {
  id: string;
  folderId: string | null;
  title: string;
  description: string;
  level: string;
  tags: string[];
  visibility: CollectionVisibility;
  wordCount: number;
  subscriberCount: number;
  version: number;
}

export interface PublishInput {
  folderId: string;
  title: string;
  description: string;
  level: CollectionLevel;
  tags: string[];
  visibility: CollectionVisibility;
}

/** "Climate, IELTS , climate" -> ["climate", "ielts"]; at most five short, lowercase, distinct tags. */
export function parseTags(input: string): string[] {
  const tags: string[] = [];
  for (const part of input.split(/[,\n]/)) {
    const tag = part.trim().toLocaleLowerCase().slice(0, MAX_TAG_LENGTH).trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

/** Returns an error message for the share form, or null when it can be submitted. */
export function validateShareForm(input: { title: string; description: string; visibility: CollectionVisibility; wordCount: number; acknowledged: boolean }): string | null {
  const title = input.title.trim();
  if (title.length < TITLE_RANGE.min || title.length > TITLE_RANGE.max) {
    return `Give your collection a title of ${TITLE_RANGE.min} to ${TITLE_RANGE.max} characters.`;
  }
  if (input.description.length > DESCRIPTION_MAX) return `The description can be at most ${DESCRIPTION_MAX} characters.`;
  if (input.visibility !== 'private') {
    if (input.wordCount < MIN_WORDS_TO_SHARE) return `Add at least ${MIN_WORDS_TO_SHARE} words to this folder before sharing it.`;
    if (!input.acknowledged) return 'Please confirm that you have the right to share these words.';
  }
  return null;
}

export function collectionLink(origin: string, collectionId: string): string {
  return `${origin}/explore/collection?id=${encodeURIComponent(collectionId)}`;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Set the public URL and publishable key.');
  return supabase;
}

type CardRow = Database['public']['Functions']['list_collections']['Returns'][number];
type DetailRow = Database['public']['Functions']['get_collection']['Returns'][number];

function mapCard(row: CardRow): CollectionCard {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    level: row.level,
    tags: row.tags,
    wordCount: row.word_count,
    subscriberCount: row.subscriber_count,
    version: row.version,
    publishedAt: row.published_at,
    authorName: row.author_name || 'A learner',
    authorAvatar: row.author_avatar,
    isOwner: row.is_owner,
    isSubscribed: row.is_subscribed,
  };
}

function mapDetail(row: DetailRow): CollectionDetail {
  return { ...mapCard(row), visibility: row.visibility, syncedVersion: row.synced_version };
}

export const ExploreService = {
  async list(options: { search?: string; level?: string; sort?: CollectionSort; offset?: number; limit?: number } = {}): Promise<CollectionCard[]> {
    const { data, error } = await client().rpc('list_collections', {
      p_search: options.search?.trim() || null,
      p_level: options.level || null,
      p_sort: options.sort ?? 'popular',
      p_limit: options.limit ?? 24,
      p_offset: options.offset ?? 0,
    });
    if (error) throw error;
    return data.map(mapCard);
  },

  async get(id: string): Promise<CollectionDetail | null> {
    const { data, error } = await client().rpc('get_collection', { p_collection_id: id });
    if (error) throw error;
    return data[0] ? mapDetail(data[0]) : null;
  },

  async words(id: string, limit = 20): Promise<CollectionWord[]> {
    const { data, error } = await client().rpc('get_collection_words', { p_collection_id: id, p_limit: limit });
    if (error) throw error;
    return data.map((row) => ({
      position: row.position,
      word: row.word,
      meaning: row.meaning,
      wordType: row.word_type,
      phonetic: row.phonetic,
      level: row.level,
      example: row.example,
    }));
  },

  /** Copies the collection into the learner's library as a new folder. */
  async subscribe(id: string): Promise<{ folderId: string; added: number; skipped: number }> {
    const { data, error } = await client().rpc('subscribe_to_collection', { p_collection_id: id });
    if (error) throw error;
    const result = data as { folder_id: string; added: number; skipped: number };
    return { folderId: result.folder_id, added: result.added, skipped: result.skipped };
  },

  /** Pulls words the author added since the last sync. */
  async sync(id: string): Promise<{ folderId: string; added: number }> {
    const { data, error } = await client().rpc('sync_subscription', { p_collection_id: id });
    if (error) throw error;
    const result = data as { folder_id: string; added: number };
    return { folderId: result.folder_id, added: result.added };
  },

  /** Stops following; the words already in the library stay there. */
  async unsubscribe(id: string): Promise<void> {
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError || !userData.user) throw userError || new Error('Please sign in again.');
    const { error } = await client().from('collection_subscriptions').delete().eq('collection_id', id).eq('subscriber_id', userData.user.id);
    if (error) throw error;
  },

  async mySubscriptions(): Promise<MySubscription[]> {
    const { data, error } = await client().rpc('list_my_subscriptions');
    if (error) throw error;
    return data.map((row) => ({
      collectionId: row.collection_id,
      localFolderId: row.local_folder_id,
      syncedVersion: row.synced_version,
      version: row.version,
      title: row.title,
      authorName: row.author_name || 'A learner',
      authorAvatar: row.author_avatar,
      wordCount: row.word_count,
      lastSyncedAt: row.last_synced_at,
      isAvailable: row.is_available,
      hasUpdate: row.is_available && row.version > row.synced_version,
    }));
  },

  async myCollections(): Promise<MyCollection[]> {
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError || !userData.user) throw userError || new Error('Please sign in again.');
    const { data, error } = await client()
      .from('collections')
      .select('*')
      .eq('owner_id', userData.user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      folderId: row.source_folder_id,
      title: row.title,
      description: row.description,
      level: row.level,
      tags: row.tags,
      visibility: row.visibility,
      wordCount: row.word_count,
      subscriberCount: row.subscriber_count,
      version: row.version,
    }));
  },

  /** Creates the collection for a folder, or refreshes it with the folder's current words. */
  async publish(input: PublishInput): Promise<MyCollection> {
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError || !userData.user) throw userError || new Error('Please sign in again.');
    const profile = profileFromUser(userData.user);
    const { data, error } = await client().rpc('publish_collection', {
      p_folder_id: input.folderId,
      p_title: input.title.trim(),
      p_description: input.description.trim(),
      p_level: input.level,
      p_tags: input.tags,
      p_visibility: input.visibility,
      p_author_name: profile.name,
      p_author_avatar: profile.avatarUrl,
    });
    if (error) throw error;
    return {
      id: data.id,
      folderId: data.source_folder_id,
      title: data.title,
      description: data.description,
      level: data.level,
      tags: data.tags,
      visibility: data.visibility,
      wordCount: data.word_count,
      subscriberCount: data.subscriber_count,
      version: data.version,
    };
  },

  async deleteCollection(id: string): Promise<void> {
    const { error } = await client().from('collections').delete().eq('id', id);
    if (error) throw error;
  },

  async report(id: string, reason: string, details: string): Promise<void> {
    const { error } = await client().rpc('report_collection', { p_collection_id: id, p_reason: reason, p_details: details.trim() });
    if (error) throw error;
  },
};
