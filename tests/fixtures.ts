import type { Vocabulary } from '@/types';

export function makeWord(overrides: Partial<Vocabulary> & { id: string }): Vocabulary {
  return {
    folderId: null,
    word: `word-${overrides.id}`,
    meaning: `meaning ${overrides.id}`,
    wordType: 'noun',
    status: 'learning',
    nextReviewAt: new Date(0).toISOString(),
    intervalDays: 0,
    repetitions: 0,
    easeFactor: 2.5,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
