import { describe, expect, it } from 'vitest';
import { countDueReviews, dueForecast, estimateMinutes, remainingNewToday } from '@/lib/dailyPlan';
import { DAY_MS, makeWord } from './fixtures';

describe('remainingNewToday', () => {
  const prefs = { dailyGoal: 20, newPerDay: 10, maxReviews: 50 };

  it('subtracts new words already learned today', () => {
    expect(remainingNewToday(prefs, { reviewsToday: 5, newToday: 4 })).toBe(6);
    expect(remainingNewToday(prefs, { reviewsToday: 5, newToday: 12 })).toBe(0);
  });

  it('is unlimited when the limit is 0', () => {
    expect(remainingNewToday({ ...prefs, newPerDay: 0 }, { reviewsToday: 0, newToday: 99 })).toBeNull();
  });
});

describe('dueForecast and counts', () => {
  const now = new Date(2026, 9, 8, 15, 0, 0);
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();
  const words = [
    makeWord({ id: 'overdue', nextReviewAt: at(-5) }),
    makeWord({ id: 'today', nextReviewAt: at(0) }),
    makeWord({ id: 'tomorrow', nextReviewAt: at(1) }),
    makeWord({ id: 'later', nextReviewAt: at(3) }),
    makeWord({ id: 'beyond', nextReviewAt: at(30) }),
    makeWord({ id: 'new', status: 'new', nextReviewAt: at(-1) }),
  ];

  it('buckets reviews by local day and ignores new and far-off cards', () => {
    const forecast = dueForecast(words, 7, now);
    expect(forecast).toHaveLength(8);
    expect(forecast[0]).toEqual({ label: 'Today', count: 2 });
    expect(forecast[1]).toEqual({ label: 'Tomorrow', count: 1 });
    expect(forecast[3].count).toBe(1);
    expect(forecast.reduce((sum, day) => sum + day.count, 0)).toBe(4);
  });

  it('counts due reviews without new words', () => {
    expect(countDueReviews(words, now.getTime())).toBe(2);
  });

  it('estimates minutes', () => {
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(1)).toBe(1);
    expect(estimateMinutes(60)).toBe(8);
  });
});
