import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatInterval, previewIntervals, scheduleReview, type SchedulingState } from '@/lib/spacedRepetition';
import { makeWord } from './fixtures';

const fresh: SchedulingState = { intervalDays: 0, repetitions: 0, easeFactor: 2.5 };

describe('scheduleReview', () => {
  it('grows intervals with repeated good answers and only then marks mastered', () => {
    let state: SchedulingState = fresh;
    const intervals: number[] = [];
    const statuses: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const next = scheduleReview(state, 'good');
      intervals.push(next.intervalDays);
      statuses.push(next.status);
      state = next;
    }
    expect(intervals).toEqual([1, 3, 8, 20, 50]);
    expect(statuses).toEqual(['learning', 'learning', 'learning', 'learning', 'mastered']);
  });

  it('resets a forgotten card to due-now and lowers ease without going under the floor', () => {
    const forgotten = scheduleReview({ intervalDays: 40, repetitions: 5, easeFactor: 1.35 }, 'forgot');
    expect(forgotten).toMatchObject({ intervalDays: 0, repetitions: 0, easeFactor: 1.3, status: 'learning' });
    expect(scheduleReview({ ...forgotten, easeFactor: 2.5 }, 'forgot').easeFactor).toBe(2.3);
  });

  it('hard grows slowly and lowers ease; easy grows faster and raises ease up to the cap', () => {
    const mature: SchedulingState = { intervalDays: 10, repetitions: 4, easeFactor: 2.5 };
    expect(scheduleReview(mature, 'hard')).toMatchObject({ intervalDays: 12, easeFactor: 2.35 });
    expect(scheduleReview(mature, 'easy')).toMatchObject({ intervalDays: 33, easeFactor: 2.65 });
    expect(scheduleReview({ ...mature, easeFactor: 2.95 }, 'easy').easeFactor).toBe(3);
  });

  it('never schedules past a year and always moves forward after a success', () => {
    expect(scheduleReview({ intervalDays: 300, repetitions: 9, easeFactor: 3 }, 'easy').intervalDays).toBe(365);
    expect(scheduleReview({ intervalDays: 1, repetitions: 3, easeFactor: 1.3 }, 'good').intervalDays).toBe(2);
  });
});

describe('previewIntervals', () => {
  it('labels each rating for a card', () => {
    const labels = previewIntervals(makeWord({ id: 'a', repetitions: 2, intervalDays: 3 }));
    expect(labels).toEqual({ forgot: 'Again today', hard: '4 days', good: '8 days', easy: '10 days' });
  });

  it('formats long intervals', () => {
    expect(formatInterval(1)).toBe('1 day');
    expect(formatInterval(60)).toBe('2 mo');
  });
});

describe('SQL parity', () => {
  const sql = readFileSync('supabase/migrations/20261009000000_sm2_scheduling.sql', 'utf8');

  it('uses the same constants as the TypeScript scheduler', () => {
    for (const fragment of [
      'greatest(1.3, v_ease - 0.2)',
      'greatest(1.3, v_ease - 0.15)',
      'least(3, v_ease + 0.15)',
      'least(365, v_interval_days)',
      'v_interval_days >= 21',
      'v_vocabulary.interval_days * 1.2',
      'v_vocabulary.interval_days * v_ease * 1.3',
    ]) {
      expect(sql).toContain(fragment);
    }
  });
});
