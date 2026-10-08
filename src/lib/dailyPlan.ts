import { Vocabulary } from '@/types';
import { persistSetting } from './settings';

export interface DailyPrefs {
  /** Cards the learner aims to review each day. */
  dailyGoal: number;
  /** New words introduced per day (0 = no limit). */
  newPerDay: number;
  /** Most overdue reviews put in one session (0 = no limit). */
  maxReviews: number;
}

export const DEFAULT_DAILY_PREFS: DailyPrefs = { dailyGoal: 20, newPerDay: 10, maxReviews: 50 };
export const GOAL_OPTIONS = [10, 20, 30, 50] as const;
export const NEW_PER_DAY_OPTIONS = [5, 10, 20, 30, 0] as const;
export const MAX_REVIEW_OPTIONS = [25, 50, 100, 0] as const;
/** A backlog this many times the session cap triggers the gentle-restart offer. */
export const BACKLOG_RESTART_THRESHOLD = 100;

const PREFS_KEY = 'vocabmaster.dailyPrefs';
const SECONDS_PER_CARD = 8;

export interface TodayActivity {
  reviewsToday: number;
  newToday: number;
}

function pick<T extends number>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'number' && (options as readonly number[]).includes(value) ? (value as T) : fallback;
}

export function loadDailyPrefs(): DailyPrefs {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
    return {
      dailyGoal: pick(saved?.dailyGoal, GOAL_OPTIONS, DEFAULT_DAILY_PREFS.dailyGoal),
      newPerDay: pick(saved?.newPerDay, NEW_PER_DAY_OPTIONS, DEFAULT_DAILY_PREFS.newPerDay),
      maxReviews: pick(saved?.maxReviews, MAX_REVIEW_OPTIONS, DEFAULT_DAILY_PREFS.maxReviews),
    };
  } catch {
    return DEFAULT_DAILY_PREFS;
  }
}

export function saveDailyPrefs(prefs: DailyPrefs): void {
  persistSetting('vocabmaster.dailyPrefs', JSON.stringify(prefs));
}

/** New words still allowed today, or null when there is no daily limit. */
export function remainingNewToday(prefs: DailyPrefs, activity: TodayActivity): number | null {
  return prefs.newPerDay === 0 ? null : Math.max(0, prefs.newPerDay - activity.newToday);
}

export function estimateMinutes(cards: number): number {
  return cards === 0 ? 0 : Math.max(1, Math.round((cards * SECONDS_PER_CARD) / 60));
}

const isReview = (word: Vocabulary) => word.status !== 'new';
const isDue = (word: Vocabulary, now: number) => new Date(word.nextReviewAt).getTime() <= now;

export function countDueReviews(words: Vocabulary[], now = Date.now()): number {
  return words.filter((word) => isReview(word) && isDue(word, now)).length;
}

export interface ForecastDay {
  label: string;
  count: number;
}

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Reviews expected now (including overdue) and on each of the next `days` calendar days. */
export function dueForecast(words: Vocabulary[], days = 7, now = new Date()): ForecastDay[] {
  const today = startOfLocalDay(now).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: days + 1 }, (_, offset) => ({
    label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : new Date(today + offset * dayMs).toLocaleDateString('en-US', { weekday: 'short' }),
    count: 0,
  }));
  for (const word of words) {
    if (!isReview(word)) continue;
    const offset = Math.floor((startOfLocalDay(new Date(word.nextReviewAt)).getTime() - today) / dayMs);
    if (offset <= 0) buckets[0].count += 1;
    else if (offset <= days) buckets[offset].count += 1;
  }
  return buckets;
}
