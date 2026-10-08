import React from 'react';
import { Target, CheckCircle2, TrendingUp } from 'lucide-react';
import { UserStats } from '@/types';

interface DailyProgressProps {
  stats: UserStats;
  dailyTarget?: number;
}

export function DailyProgress({ stats, dailyTarget = 20 }: DailyProgressProps) {
  const wordsStudied = stats.wordsStudiedToday || 0;
  const reviewsCompleted = stats.reviewsCompletedToday || 0;
  const progressPercent = Math.min(100, Math.round((wordsStudied / dailyTarget) * 100));

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Daily Learning Goal</h3>
            <p className="text-xs text-slate-500">Target: {dailyTarget} words per day</p>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          {progressPercent}% Completed
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-3 mb-5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-600 to-indigo-500 h-3 rounded-full transition-all duration-500 shadow-sm"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">Words Studied Today</p>
            <p className="text-lg font-bold text-slate-900">{wordsStudied}</p>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">Reviews Completed</p>
            <p className="text-lg font-bold text-slate-900">{reviewsCompleted}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
