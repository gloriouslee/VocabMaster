import React from 'react';
import Link from 'next/link';
import { Target, CheckCircle2, Sparkles, Clock, Play } from 'lucide-react';
import { GOAL_OPTIONS, estimateMinutes } from '@/lib/dailyPlan';

interface DailyProgressProps {
  dailyGoal: number;
  onChangeGoal: (goal: number) => void;
  reviewsToday: number;
  newToday: number;
  /** Reviews due right now. */
  dueNow: number;
  /** New words still available to learn today under the daily limit. */
  newAvailable: number;
}

export function DailyProgress({ dailyGoal, onChangeGoal, reviewsToday, newToday, dueNow, newAvailable }: DailyProgressProps) {
  const progressPercent = Math.min(100, Math.round((reviewsToday / dailyGoal) * 100));
  const goalMet = reviewsToday >= dailyGoal;
  const remainingToGoal = Math.max(0, dailyGoal - reviewsToday);
  const plannedCards = Math.min(dueNow + newAvailable, remainingToGoal);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Today&apos;s goal</h3>
            <label className="text-xs text-slate-500">
              Review{' '}
              <select
                aria-label="Daily review goal"
                value={dailyGoal}
                onChange={(event) => onChangeGoal(Number(event.target.value))}
                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs font-semibold text-slate-700"
              >
                {GOAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>{' '}
              cards per day
            </label>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${goalMet ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
          {goalMet ? 'Goal reached' : `${progressPercent}% done`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Daily goal progress"
        className="w-full bg-slate-100 rounded-full h-3 mb-5 overflow-hidden"
      >
        <div
          className="bg-gradient-to-r from-blue-600 to-indigo-500 h-3 rounded-full transition-all duration-500 shadow-sm"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">Reviewed today</p>
            <p className="text-lg font-bold text-slate-900">{reviewsToday} <span className="text-xs font-medium text-slate-500">/ {dailyGoal}</span></p>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">New words learned</p>
            <p className="text-lg font-bold text-slate-900">{newToday}</p>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
          <Clock className="w-5 h-5 text-rose-500" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">Due now</p>
            <p className="text-lg font-bold text-slate-900">{dueNow}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          {goalMet
            ? 'Great work, you hit today’s goal. Extra practice is optional.'
            : plannedCards > 0
              ? `About ${plannedCards} ${plannedCards === 1 ? 'card' : 'cards'} (~${estimateMinutes(plannedCards)} min) left to reach today’s goal.`
              : 'Nothing is due right now. Check back tomorrow or add new words.'}
        </p>
        <Link href="/study" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
          <Play className="h-3.5 w-3.5 fill-white" /> {reviewsToday > 0 ? 'Continue studying' : 'Start today’s session'}
        </Link>
      </div>
    </div>
  );
}
