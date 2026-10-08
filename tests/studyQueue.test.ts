import { describe, expect, it } from 'vitest';
import { buildStudyQueue } from '@/lib/studyQueue';
import { DAY_MS, makeWord } from './fixtures';

const now = Date.now();
const reviews = Array.from({ length: 10 }, (_, i) => makeWord({ id: `r${i}`, nextReviewAt: new Date(now - (i + 1) * DAY_MS).toISOString() }));
const fresh = Array.from({ length: 6 }, (_, i) => makeWord({ id: `n${i}`, status: 'new' }));

describe('buildStudyQueue', () => {
  it('puts the most overdue reviews first', () => {
    const { queue } = buildStudyQueue([...fresh, ...reviews], null);
    expect(queue[0].id).toBe('r9');
  });

  it('caps reviews and reports the deferred count', () => {
    const { queue, deferredReviews } = buildStudyQueue(reviews, 0, 4);
    expect(queue.map((word) => word.id)).toEqual(['r9', 'r8', 'r7', 'r6']);
    expect(deferredReviews).toBe(6);
  });

  it('limits new cards and interleaves them with reviews', () => {
    const { queue } = buildStudyQueue([...fresh, ...reviews], 2);
    expect(queue.filter((word) => word.status === 'new')).toHaveLength(2);
    expect(queue[3].status).toBe('new');
  });

  it('supports no new cards and unlimited new cards', () => {
    expect(buildStudyQueue(fresh, 0).queue).toHaveLength(0);
    expect(buildStudyQueue(fresh, null).queue).toHaveLength(6);
  });
});
