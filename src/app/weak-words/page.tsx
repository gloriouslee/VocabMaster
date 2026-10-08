'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { WeakWords } from '@/components/weak/WeakWords';
import { StorageService } from '@/lib/storage';
import { Folder, MistakeLog, Vocabulary } from '@/types';

const QUIZ_PREFS_KEY = 'vocabmaster.quizPrefs';

export default function WeakWordsPage() {
  const router = useRouter();
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);
  const [lapses, setLapses] = useState<Map<string, number>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

  // Open the quiz screen with the weak-words source already selected.
  const handlePracticeQuiz = (wordCount: number) => {
    window.localStorage.setItem(QUIZ_PREFS_KEY, JSON.stringify({ count: Math.min(20, Math.max(5, wordCount)), source: 'weak', format: 'mixed' }));
    router.push('/quiz');
  };

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p>}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Weak Words</h1>
          <p className="mt-1 text-xs text-slate-500">Focus your practice on the words that need it most.</p>
        </div>
        {isLoading ? (
          <div className="mx-auto h-48 max-w-4xl animate-pulse rounded-2xl bg-slate-200" />
        ) : (
          <WeakWords vocabularies={vocabularies} folders={folders} mistakes={mistakes} lapses={lapses} onPracticeQuiz={handlePracticeQuiz} />
        )}
      </div>
    </Shell>
  );
}
