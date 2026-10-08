import { persistSetting } from './settings';

const KEY = 'vocabmaster.examGoal' as const;

export interface ExamGoal {
  /** Exam date as YYYY-MM-DD in the learner's local time. */
  date: string;
}

export function loadExamGoal(): ExamGoal | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    return saved && typeof saved.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.date) ? { date: saved.date } : null;
  } catch {
    return null;
  }
}

export function saveExamGoal(goal: ExamGoal | null): void {
  persistSetting(KEY, JSON.stringify(goal));
}

export interface ExamPlan {
  daysLeft: number;
  /** New words per day needed to learn every word that is still new before the exam. */
  newPerDayNeeded: number;
  isPast: boolean;
}

/** Whole local calendar days from `now` until the exam date (0 = exam is today). */
export function daysUntil(date: string, now = new Date()): number {
  const [year, month, day] = date.split('-').map(Number);
  const exam = new Date(year, month - 1, day).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((exam - today) / 86_400_000);
}

export function planForExam(date: string, newWordsLeft: number, now = new Date()): ExamPlan {
  const daysLeft = daysUntil(date, now);
  if (daysLeft < 0) return { daysLeft, newPerDayNeeded: 0, isPast: true };
  // Keep the last two days for revision only, but never divide by less than one day.
  const studyDays = Math.max(1, daysLeft - 2);
  return { daysLeft, newPerDayNeeded: Math.ceil(newWordsLeft / studyDays), isPast: false };
}
