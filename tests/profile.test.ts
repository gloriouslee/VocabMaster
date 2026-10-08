import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { profileFromUser, updateDisplayName } from '@/lib/profile';

const user = (metadata: Record<string, unknown>, email = 'lehuyhoang@example.com') => ({ email, user_metadata: metadata } as unknown as User);

describe('profileFromUser', () => {
  it('uses the learner\'s own name and photo over the Google ones', () => {
    const profile = profileFromUser(user({ display_name: 'Hoang', full_name: 'Le Huy Hoang', custom_avatar_url: 'https://x/own.jpg', avatar_url: 'https://g/pic.jpg' }));
    expect(profile).toMatchObject({ name: 'Hoang', avatarUrl: 'https://x/own.jpg', hasCustomAvatar: true });
  });

  it('falls back to Google data, then to the start of the email', () => {
    expect(profileFromUser(user({ full_name: 'Le Huy Hoang', picture: 'https://g/pic.jpg' }))).toMatchObject({ name: 'Le Huy Hoang', avatarUrl: 'https://g/pic.jpg', hasCustomAvatar: false });
    expect(profileFromUser(user({}))).toMatchObject({ name: 'lehuyhoang', avatarUrl: null });
  });
});

describe('updateDisplayName', () => {
  it('rejects empty and overlong names before calling the server', async () => {
    await expect(updateDisplayName('   ')).rejects.toThrow('enter a name');
    await expect(updateDisplayName('x'.repeat(41))).rejects.toThrow('at most 40');
  });
});
