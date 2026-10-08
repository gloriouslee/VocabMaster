import React from 'react';
import type { Profile } from '@/lib/profile';

interface AvatarProps {
  profile: Pick<Profile, 'name' | 'avatarUrl'>;
  /** Pixel size of the circle. */
  size?: number;
}

/** Round profile picture, falling back to the learner's initial. */
export function Avatar({ profile, size = 28 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (profile.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" style={style} className="shrink-0 rounded-full bg-slate-200 object-cover" />;
  }
  return (
    <span style={style} className="flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white" aria-hidden="true">
      {profile.name.charAt(0).toUpperCase() || '?'}
    </span>
  );
}
