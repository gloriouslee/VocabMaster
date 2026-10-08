import React from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, Play } from 'lucide-react';

export interface TodaySummary {
  reviewsToday: number;
  dailyGoal: number;
  /** Reviews due right now. */
  dueNow: number;
  /** Whole days until the exam, or null when no exam date is set. */
  examDaysLeft: number | null;
}

interface TodayCardProps {
  today: TodaySummary | null;
  onNavigate?: () => void;
}

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Sidebar card: today's progress at a glance, one tap to keep studying, and the exam countdown. */
export function TodayCard({ today, onNavigate }: TodayCardProps) {
  if (!today) {
    return <div className="m-3 h-32 animate-pulse rounded-xl border border-slate-700/60 bg-slate-800/60" aria-hidden="true" />;
  }

  const progress = Math.min(1, today.reviewsToday / today.dailyGoal);
  const goalMet = today.reviewsToday >= today.dailyGoal;
  const allDone = goalMet && today.dueNow === 0;
  const exam = today.examDaysLeft;

  return (
    <section aria-label="Today" className="m-3 space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" role="img" aria-label={`${today.reviewsToday} of ${today.dailyGoal} cards reviewed today`}>
            <circle cx="24" cy="24" r={RADIUS} fill="none" strokeWidth="4" className="stroke-slate-700" />
            <circle
              cx="24"
              cy="24"
              r={RADIUS}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              className={`transition-all duration-500 ${goalMet ? 'stroke-emerald-400' : 'stroke-blue-400'}`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
            {goalMet ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : `${Math.round(progress * 100)}%`}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Today</p>
          <p className="text-sm font-bold text-white">{today.reviewsToday} / {today.dailyGoal} cards</p>
          <p className="text-xs text-slate-400">{today.dueNow > 0 ? `${today.dueNow} due now` : 'Nothing due'}</p>
        </div>
      </div>

      {allDone ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-semibold text-emerald-300">All done for today</p>
      ) : (
        <Link href="/study" onClick={onNavigate} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500">
          <Play className="h-3.5 w-3.5 fill-white" />
          {today.reviewsToday > 0 ? 'Continue studying' : 'Start today’s session'}
        </Link>
      )}

      <Link href="/settings" onClick={onNavigate} className="flex items-center gap-2 border-t border-slate-700/60 pt-3 text-xs text-slate-400 hover:text-slate-200">
        <CalendarCheck className="h-4 w-4 shrink-0 text-slate-500" />
        {exam === null ? (
          <span>Set your exam date</span>
        ) : exam < 0 ? (
          <span>Exam date passed. Set a new one</span>
        ) : exam === 0 ? (
          <span className="font-semibold text-amber-300">Your exam is today. Good luck!</span>
        ) : (
          <span><strong className="text-slate-200">{exam}</strong> {exam === 1 ? 'day' : 'days'} until your exam</span>
        )}
      </Link>
    </section>
  );
}
