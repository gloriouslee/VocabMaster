import React from 'react';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { ExamPlan } from '@/lib/examGoal';

interface ExamBannerProps {
  plan: ExamPlan;
  newWordsLeft: number;
  /** New words per day the learner currently allows (0 = no limit). */
  currentNewPerDay: number;
}

export function ExamBanner({ plan, newWordsLeft, currentNewPerDay }: ExamBannerProps) {
  if (plan.isPast) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Your exam date has passed. <Link href="/settings" className="font-semibold text-blue-600 hover:underline">Set a new date</Link> in Settings.
      </div>
    );
  }

  const behind = currentNewPerDay > 0 && plan.newPerDayNeeded > currentNewPerDay;
  const headline = plan.daysLeft === 0 ? 'Your exam is today. Good luck!' : `${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'} until your exam`;

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${behind ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-white'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${behind ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}><CalendarCheck className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-bold text-slate-900">{headline}</p>
          <p className="text-xs text-slate-600">
            {newWordsLeft === 0
              ? 'You have started every word in your library. Keep reviewing daily.'
              : `${newWordsLeft} new ${newWordsLeft === 1 ? 'word' : 'words'} to start, about ${plan.newPerDayNeeded} per day.`}
            {behind && ` Your limit is ${currentNewPerDay} a day, so you may not finish in time.`}
          </p>
        </div>
      </div>
      {behind && <Link href="/settings" className="shrink-0 text-xs font-bold text-amber-800 hover:underline">Adjust my plan</Link>}
    </div>
  );
}
