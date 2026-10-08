import { Vocabulary } from '@/types';
import { shuffle } from './shuffle';

export interface StudyQueue {
  queue: Vocabulary[];
  /** Reviews left out because of the per-session cap; they stay due for next time. */
  deferredReviews: number;
}

const dueTime = (word: Vocabulary) => new Date(word.nextReviewAt).getTime();

/**
 * Orders a study queue: the most overdue reviews first (capped by `maxReviews`,
 * 0 = unlimited), with new cards (capped by `newLimit`, null = unlimited)
 * interleaved roughly every third card so a session never opens with a wall of
 * unfamiliar words.
 */
export function buildStudyQueue(words: Vocabulary[], newLimit: number | null, maxReviews = 0): StudyQueue {
  const allReviews = words.filter((word) => word.status !== 'new').sort((a, b) => dueTime(a) - dueTime(b));
  const reviews = maxReviews > 0 ? allReviews.slice(0, maxReviews) : allReviews;
  const fresh = shuffle(words.filter((word) => word.status === 'new'));
  const newCards = newLimit === null ? fresh : fresh.slice(0, newLimit);

  const queue: Vocabulary[] = [];
  let newIndex = 0;
  reviews.forEach((word, index) => {
    queue.push(word);
    if ((index + 1) % 3 === 0 && newIndex < newCards.length) queue.push(newCards[newIndex++]);
  });
  return { queue: queue.concat(newCards.slice(newIndex)), deferredReviews: allReviews.length - reviews.length };
}
