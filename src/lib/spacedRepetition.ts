import { Vocabulary, VocabStatus } from '@/types';

export type Rating = 'forgot' | 'hard' | 'good' | 'easy';

export interface SpacedRepetitionResult {
  nextReviewAt: string;
  intervalDays: number;
  repetitions: number;
  status: VocabStatus;
}

export function calculateNextReview(vocab: Vocabulary, rating: Rating): SpacedRepetitionResult {
  const now = new Date();
  let intervalDays = 0;
  let repetitions = vocab.repetitions || 0;
  let status: VocabStatus = vocab.status;

  switch (rating) {
    case 'forgot':
      intervalDays = 0; // Today
      repetitions = 0;
      status = 'learning';
      break;

    case 'hard':
      intervalDays = 1; // 1 day
      repetitions = Math.max(1, repetitions + 1);
      status = 'learning';
      break;

    case 'good':
      intervalDays = 3; // 3 days
      repetitions += 1;
      status = repetitions >= 2 ? 'mastered' : 'learning';
      break;

    case 'easy':
      intervalDays = 7; // 7 days
      repetitions += 1;
      status = 'mastered';
      break;
  }

  const nextDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    nextReviewAt: nextDate.toISOString(),
    intervalDays,
    repetitions,
    status,
  };
}
