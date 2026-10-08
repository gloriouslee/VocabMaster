import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Profile {
  /** Name shown in the app. */
  name: string;
  /** Picture to show, or null to fall back to the initial. */
  avatarUrl: string | null;
  email: string;
  /** True when the learner uploaded their own picture. */
  hasCustomAvatar: boolean;
}

export const MAX_NAME_LENGTH = 40;
const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 256;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The learner's own choices (display_name, custom_avatar_url) win over what Google provides
 * (full_name, avatar_url), so a Google account still looks right before anything is set.
 */
export function profileFromUser(user: User): Profile {
  const meta = user.user_metadata || {};
  const email = user.email || '';
  const custom = text(meta.custom_avatar_url);
  return {
    name: text(meta.display_name) || text(meta.full_name) || text(meta.name) || email.split('@')[0] || 'Learner',
    avatarUrl: custom || text(meta.avatar_url) || text(meta.picture) || null,
    email,
    hasCustomAvatar: Boolean(custom),
  };
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function updateDisplayName(name: string): Promise<void> {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new Error('Please enter a name.');
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  const { error } = await requireClient().auth.updateUser({ data: { display_name: trimmed } });
  if (error) throw error;
}

/** Centre-crops the picture to a square and re-encodes it small, so uploads stay fast and light. */
export async function resizeToSquareJpeg(file: File, size = AVATAR_SIZE): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot process images.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Unable to process this image.'))), 'image/jpeg', 0.85));
  } finally {
    bitmap.close();
  }
}

export async function uploadAvatar(file: File): Promise<void> {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw userError || new Error('Please sign in again.');
  const userId = userData.user.id;

  const image = await resizeToSquareJpeg(file);
  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, image, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (uploadError) {
    throw new Error(/bucket/i.test(uploadError.message)
      ? 'Profile pictures are not set up yet. Apply the avatars migration to your database.'
      : uploadError.message);
  }
  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // The version query keeps browsers from showing a cached older picture.
  const { error } = await client.auth.updateUser({ data: { custom_avatar_url: `${data.publicUrl}?v=${Date.now()}` } });
  if (error) throw error;
}

export async function removeAvatar(): Promise<void> {
  const client = requireClient();
  const { data: userData } = await client.auth.getUser();
  if (userData.user) await client.storage.from(AVATAR_BUCKET).remove([`${userData.user.id}/avatar.jpg`]);
  const { error } = await client.auth.updateUser({ data: { custom_avatar_url: null } });
  if (error) throw error;
}
