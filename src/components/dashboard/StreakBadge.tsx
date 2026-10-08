import React from 'react';
import { Flame, Trophy, Calendar } from 'lucide-react';
import { UserStats } from '@/types';

interface StreakBadgeProps {
  stats: UserStats;
}

export function StreakBadge({ stats }: StreakBadgeProps) {
  const currentStreak = stats.currentStreak;
  const bestStreak = stats.bestStreak;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const activeToday = stats.lastActiveDate === todayKey && stats.wordsStudiedToday > 0;

  return (
    <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-6 rounded-2xl text-white shadow-lg shadow-orange-500/20 relative overflow-hidden flex flex-col justify-between">
      {/* Background Flame Accent */}
      <Flame className="absolute -right-6 -bottom-6 w-36 h-36 text-white/10 pointer-events-none" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase font-bold tracking-wider text-amber-100 flex items-center gap-1.5">
            <Flame className="w-4 h-4 fill-white" />
            Learning Habits
          </span>
          <span className="text-xs bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full font-semibold">
            Active Streak
          </span>
        </div>

        <div className="mt-2">
          <h2 className="text-4xl font-extrabold tracking-tight flex items-baseline gap-2">
            {currentStreak} <span className="text-lg font-medium text-amber-100">Days</span>
          </h2>
          <p className="text-xs text-amber-100 mt-1">
            {activeToday
              ? 'You studied today. Your streak is safe.'
              : 'Review a few cards today to keep your streak going.'}
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 text-amber-100">
          <Trophy className="w-4 h-4 text-amber-200" />
          <span>Best Streak: <strong>{bestStreak} days</strong></span>
        </div>
        <div className="flex items-center space-x-1 text-amber-100">
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily Habit</span>
        </div>
      </div>
    </div>
  );
}
