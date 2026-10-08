'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Sparkles,
  Clock,
  CheckCircle,
  Play,
  FileSpreadsheet,
  HelpCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { StatCard } from '@/components/dashboard/StatCard';
import { DailyProgress } from '@/components/dashboard/DailyProgress';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { DueForecast } from '@/components/dashboard/DueForecast';
import { WordOfTheDay } from '@/components/dashboard/WordOfTheDay';
import { StorageService } from '@/lib/storage';
import { Vocabulary, UserStats } from '@/types';
import { DEFAULT_DAILY_PREFS, DailyPrefs, TodayActivity, countDueReviews, dueForecast, loadDailyPrefs, remainingNewToday, saveDailyPrefs } from '@/lib/dailyPlan';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dailyPrefs, setDailyPrefs] = useState<DailyPrefs>(DEFAULT_DAILY_PREFS);
  const [activity, setActivity] = useState<TodayActivity>({ reviewsToday: 0, newToday: 0 });
  const [stats, setStats] = useState<UserStats>({
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
    wordsStudiedToday: 0,
    reviewsCompletedToday: 0,
  });

  useEffect(() => {
    setDailyPrefs(loadDailyPrefs());
    void Promise.all([
      StorageService.getVocabularies(),
      StorageService.getUserStats(),
      StorageService.getTodayActivity().catch(() => ({ reviewsToday: 0, newToday: 0 })),
    ])
      .then(([words, userStats, todayActivity]) => {
        setVocabularies(words);
        setStats(userStats);
        setActivity(todayActivity);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.'))
      .finally(() => setMounted(true));
  }, []);

  const totalWords = vocabularies.length;
  const newWords = vocabularies.filter((v) => v.status === 'new').length;
  const learningWords = vocabularies.filter((v) => v.status === 'learning').length;
  const masteredWords = vocabularies.filter((v) => v.status === 'mastered').length;
  const dueWords = countDueReviews(vocabularies);
  const newAllowance = remainingNewToday(dailyPrefs, activity);
  const newAvailable = newAllowance === null ? newWords : Math.min(newAllowance, newWords);
  const forecast = dueForecast(vocabularies);

  const handleChangeGoal = (dailyGoal: number) => {
    const next = { ...dailyPrefs, dailyGoal };
    setDailyPrefs(next);
    saveDailyPrefs(next);
  };

  if (!mounted) {
    return (
      <Shell>
        <div className="space-y-8 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        {/* Page Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              VocabMaster Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Build a daily IELTS vocabulary habit & retention through spaced repetition.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/study"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-blue-500/20 transition-colors"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Today&apos;s Session</span>
            </Link>
            <Link
              href="/import"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl text-xs transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Words</span>
            </Link>
          </div>
        </div>

        {/* Epic 4.1: Overview Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <StatCard
            title="Total Vocabulary"
            value={totalWords}
            subtitle="Words in your library"
            icon={BookOpen}
            color="blue"
          />
          <StatCard
            title="New Words"
            value={newWords}
            subtitle="Ready for initial study"
            icon={Sparkles}
            color="amber"
          />
          <StatCard
            title="Learning Words"
            value={learningWords}
            subtitle="In Spaced Repetition queue"
            icon={Clock}
            color="purple"
          />
          <StatCard
            title="Due for Review"
            value={dueWords}
            subtitle="Ready to practice now"
            icon={Clock}
            color="rose"
          />
          <StatCard
            title="Mastered Words"
            value={masteredWords}
            subtitle="Scheduled at longer intervals"
            icon={CheckCircle}
            color="emerald"
          />
        </div>

        {/* Middle Grid: Daily Progress & Streak */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DailyProgress
              dailyGoal={dailyPrefs.dailyGoal}
              onChangeGoal={handleChangeGoal}
              reviewsToday={activity.reviewsToday}
              newToday={activity.newToday}
              dueNow={dueWords}
              newAvailable={newAvailable}
            />
          </div>
          <div>
            <StreakBadge stats={stats} />
          </div>
        </div>

        <DueForecast days={forecast} />

        {/* Bottom Grid: Word of the Day & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <WordOfTheDay vocabularies={vocabularies} />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Quick Practice Shortcuts</h3>
              <p className="text-xs text-slate-500">Accelerate your IELTS preparation</p>
            </div>

            <div className="space-y-3">
              <Link
                href="/quiz"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Take Vocabulary Quiz</p>
                    <p className="text-[10px] text-slate-500">Multiple choice & translation</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </Link>

              <Link
                href="/mistakes"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/50 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Review Mistake Bank</p>
                    <p className="text-[10px] text-slate-500">Re-practice past wrong answers</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
