'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { WeakWords } from '@/components/weak/WeakWords';
import { StorageService } from '@/lib/storage';
import { persistSetting } from '@/lib/settings';
import { quizCountFor } from '@/lib/quizBuilder';
import { Folder, MistakeLog, Vocabulary } from '@/types';

export default function WeakWordsPage() {
  const router = useRouter();
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);
  const [lapses, setLapses] = useState<Map<string, number>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    void Promise.all([
      StorageService.getVocabularies(),
      StorageService.getFolders(),
      StorageService.getMistakeLogs(),
      StorageService.getLapseCounts(),
    ])
      .then(([words, nextFolders, logs, lapseCounts]) => {
        setVocabularies(words);
        setFolders(nextFolders);
        setMistakes(logs);
        setLapses(lapseCounts);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load your weak words.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Open the quiz screen with the weak-words source selected, keeping the learner's other quiz choices.
  const handlePracticeQuiz = (wordCount: number) => {
    let applyToSchedule = false;
    try {
      const saved = JSON.parse(window.localStorage.getItem('vocabmaster.quizPrefs') || 'null');
      if (saved && typeof saved.applyToSchedule === 'boolean') applyToSchedule = saved.applyToSchedule;
    } catch {
      // Unreadable preferences fall back to the default.
    }
    persistSetting('vocabmaster.quizPrefs', JSON.stringify({ count: quizCountFor(wordCount), source: 'weak', format: 'mixed', applyToSchedule }));
    router.push('/quiz');
  };

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && (
          <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <span>{loadError}</span>
            <button type="button" onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Try again</button>
          </p>
        )}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Weak Words</h1>
          <p className="mt-1 text-xs text-slate-500">Focus your practice on the words that need it most.</p>
        </div>
        {isLoading ? (
          <div className="mx-auto h-48 max-w-4xl animate-pulse rounded-2xl bg-slate-200" />
        ) : loadError ? null : (
          <WeakWords vocabularies={vocabularies} folders={folders} mistakes={mistakes} lapses={lapses} onPracticeQuiz={handlePracticeQuiz} />
        )}
      </div>
    </Shell>
  );
}
