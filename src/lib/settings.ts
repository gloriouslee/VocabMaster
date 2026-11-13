/**
 * Learner preferences live in localStorage for instant reads and are mirrored to the
 * `user_settings` table so they follow the account across devices. If the table is not
 * available (migration not applied, offline) everything keeps working locally.
 */

export const SETTING_KEYS = [
  'vocabmaster.dailyPrefs',
  'vocabmaster.studyPrefs',
  'vocabmaster.quizPrefs',
  'vocabmaster.accent',
  'vocabmaster.chineseVariant',
  'vocabmaster.chineseWritingEnabled',
  'vocabmaster.examGoal',
] as const;

const UPDATED_AT_KEY = 'vocabmaster.settingsUpdatedAt';
/** Which account the local copy belongs to, so one learner's settings never leak into another's. */
const OWNER_KEY = 'vocabmaster.settingsOwner';
const PUSH_DELAY_MS = 800;

/** Fired on `window` after a preference is saved so open screens can refresh what they show. */
export const SETTINGS_UPDATED_EVENT = 'vocabmaster:settings-updated';

let pushTimer: ReturnType<typeof setTimeout> | null = null;

function readLocal(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
}

/** Removes every synced preference from this browser (used on sign-out and account switches). */
export function clearLocalSettings(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  for (const key of SETTING_KEYS) window.localStorage.removeItem(key);
  window.localStorage.removeItem(UPDATED_AT_KEY);
  window.localStorage.removeItem(OWNER_KEY);
}

async function currentClient() {
  const { supabase } = await import('@/lib/supabase');
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

async function pushNow(): Promise<void> {
  const session = await currentClient();
  if (!session) return;
  const owner = window.localStorage.getItem(OWNER_KEY);
  // Never upload settings that were written while another account was signed in.
  if (owner && owner !== session.userId) return;
  const updatedAt = Number(window.localStorage.getItem(UPDATED_AT_KEY)) || Date.now();
  const { error } = await session.supabase
    .from('user_settings')
    .upsert({ user_id: session.userId, data: { ...readLocal(), _updatedAt: updatedAt } });
  if (error) console.warn('Could not sync settings:', error.message);
  else window.localStorage.setItem(OWNER_KEY, session.userId);
}

/** Saves a preference locally and schedules a sync to the account. */
export function persistSetting(key: (typeof SETTING_KEYS)[number], value: string): void {
  window.localStorage.setItem(key, value);
  window.localStorage.setItem(UPDATED_AT_KEY, String(Date.now()));
  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow().catch(() => undefined), PUSH_DELAY_MS);
}

/**
 * Called once the learner is signed in, before screens read their preferences.
 * The newer copy wins: the server copy replaces local values, or local values are pushed up.
 * Settings left behind by a different account on this device are discarded first.
 */
export async function syncSettingsFromServer(): Promise<void> {
  const session = await currentClient();
  if (!session) return;

  const owner = window.localStorage.getItem(OWNER_KEY);
  if (owner && owner !== session.userId) clearLocalSettings();

  const { data, error } = await session.supabase.from('user_settings').select('data').eq('user_id', session.userId).maybeSingle();
  if (error) {
    console.warn('Could not load synced settings:', error.message);
    return;
  }

  const localUpdatedAt = Number(window.localStorage.getItem(UPDATED_AT_KEY)) || 0;
  const remote = data && typeof data.data === 'object' && data.data !== null && !Array.isArray(data.data)
    ? (data.data as Record<string, unknown>)
    : null;
  const remoteUpdatedAt = remote && typeof remote._updatedAt === 'number' ? remote._updatedAt : 0;

  if (remote && remoteUpdatedAt > localUpdatedAt) {
    for (const key of SETTING_KEYS) {
      const value = remote[key];
      if (typeof value === 'string') window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(UPDATED_AT_KEY, String(remoteUpdatedAt));
    window.localStorage.setItem(OWNER_KEY, session.userId);
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
  } else if (localUpdatedAt > remoteUpdatedAt) {
    window.localStorage.setItem(OWNER_KEY, session.userId);
    await pushNow();
  } else {
    window.localStorage.setItem(OWNER_KEY, session.userId);
  }
}
