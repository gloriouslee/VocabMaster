import { Vocabulary, VocabStatus } from '@/types';

export type Rating = 'forgot' | 'hard' | 'good' | 'easy';

export const RATINGS: readonly Rating[] = ['forgot', 'hard', 'good', 'easy'];

export interface SchedulingState {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
}

export interface SpacedRepetitionResult extends SchedulingState {
  nextReviewAt: string;
  status: VocabStatus;
}

const MIN_EASE = 1.3;
const MAX_EASE = 3;
const MAX_INTERVAL_DAYS = 365;
/** A word counts as mastered once it is scheduled at least this far ahead. */
export const MASTERED_INTERVAL_DAYS = 21;

const roundEase = (value: number) => Math.round(value * 100) / 100;

/**
 * SM-2 style scheduling. This must stay in sync with the `record_vocabulary_review`
 * SQL function (supabase/migrations/20261009000000_sm2_scheduling.sql), which is
 * the source of truth; this copy powers the interval previews on the buttons.
 */
export function scheduleReview(state: SchedulingState, rating: Rating): SchedulingState & { status: VocabStatus } {
  const { intervalDays, repetitions, easeFactor } = state;
  let nextInterval: number;
  let nextEase = easeFactor;

  switch (rating) {
    case 'forgot':
      return {
        intervalDays: 0,
        repetitions: 0,
        easeFactor: roundEase(Math.max(MIN_EASE, easeFactor - 0.2)),
        status: 'learning',
      };
    case 'hard':
      nextInterval = repetitions === 0 || intervalDays < 1 ? 1 : Math.max(intervalDays + 1, Math.round(intervalDays * 1.2));
      nextEase = Math.max(MIN_EASE, easeFactor - 0.15);
      break;
    case 'good':
      nextInterval = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(intervalDays + 1, Math.round(intervalDays * easeFactor));
      break;
    case 'easy':
      nextInterval = repetitions === 0 ? 4 : repetitions === 1 ? 7 : Math.max(intervalDays + 1, Math.round(intervalDays * easeFactor * 1.3));
      nextEase = Math.min(MAX_EASE, easeFactor + 0.15);
      break;
  }

  nextInterval = Math.min(MAX_INTERVAL_DAYS, nextInterval);
  return {
    intervalDays: nextInterval,
    repetitions: repetitions + 1,
    easeFactor: roundEase(nextEase),
    status: nextInterval >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'learning',
  };
}

export function calculateNextReview(vocab: Vocabulary, rating: Rating): SpacedRepetitionResult {
  const next = scheduleReview(
    {
      intervalDays: vocab.intervalDays || 0,
      repetitions: vocab.repetitions || 0,
      easeFactor: vocab.easeFactor || 2.5,
    },
    rating,
  );
  return {
    ...next,
    nextReviewAt: new Date(Date.now() + next.intervalDays * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function formatInterval(days: number): string {
  if (days <= 0) return 'Again today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return '1 year';
}

/** Interval label shown under each rating button for the given card. */
export function previewIntervals(vocab: Vocabulary): Record<Rating, string> {
  const state = {
    intervalDays: vocab.intervalDays || 0,
    repetitions: vocab.repetitions || 0,
    easeFactor: vocab.easeFactor || 2.5,
  };
  return {
    forgot: formatInterval(scheduleReview(state, 'forgot').intervalDays),
    hard: formatInterval(scheduleReview(state, 'hard').intervalDays),
    good: formatInterval(scheduleReview(state, 'good').intervalDays),
    easy: formatInterval(scheduleReview(state, 'easy').intervalDays),
  };
}
