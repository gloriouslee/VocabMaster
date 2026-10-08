import { Vocabulary } from '@/types';
import { shuffle } from './shuffle';

export const NEW_CARD_LIMITS = [10, 20, 30, 0] as const; // 0 = no limit

const dueTime = (word: Vocabulary) => new Date(word.nextReviewAt).getTime();

/**
 * Orders a study queue: reviews first by how overdue they are, with new cards
 * (capped by `newLimit`, 0 = unlimited) interleaved roughly every fourth card
 * so a session never opens with a wall of unfamiliar words.
 */
export function buildStudyQueue(words: Vocabulary[], newLimit: number): Vocabulary[] {
  const reviews = words.filter((word) => word.status !== 'new').sort((a, b) => dueTime(a) - dueTime(b));
  const fresh = shuffle(words.filter((word) => word.status === 'new'));
  const newCards = newLimit > 0 ? fresh.slice(0, newLimit) : fresh;

  const queue: Vocabulary[] = [];
  let newIndex = 0;
  reviews.forEach((word, index) => {
    queue.push(word);
    if ((index + 1) % 3 === 0 && newIndex < newCards.length) queue.push(newCards[newIndex++]);
  });
  return queue.concat(newCards.slice(newIndex));
}
