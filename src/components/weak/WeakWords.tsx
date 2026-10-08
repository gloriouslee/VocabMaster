'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, HelpCircle, Layers } from 'lucide-react';
import { Folder, MistakeLog, Vocabulary } from '@/types';
import { WeaknessInfo, weaknessScore } from '@/lib/quizBuilder';

interface WeakWordsProps {
  vocabularies: Vocabulary[];
  folders: Folder[];
  mistakes: MistakeLog[];
  lapses: Map<string, number>;
  onPracticeQuiz: (wordCount: number) => void;
}

const PAGE_SIZE = 30;

function nextReviewLabel(word: Vocabulary): string {
  if (word.status === 'new') return 'Not studied yet';
  const days = Math.ceil((new Date(word.nextReviewAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Due now';
  return days === 1 ? 'Review in 1 day' : `Review in ${days} days`;
}

export function WeakWords({ vocabularies, folders, mistakes, lapses, onPracticeQuiz }: WeakWordsProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
    const mistakeCounts = new Map<string, number>();
    const lastWrong = new Map<string, string>();
    for (const log of mistakes) {
      if (log.resolved || !log.vocabularyId) continue;
      mistakeCounts.set(log.vocabularyId, (mistakeCounts.get(log.vocabularyId) || 0) + 1);
      if (!lastWrong.has(log.vocabularyId)) lastWrong.set(log.vocabularyId, log.userAnswer);
    }
    const info: WeaknessInfo = { lapses, mistakes: mistakeCounts };
    return vocabularies
      .map((word) => ({ word, score: weaknessScore(word, info), mistakes: mistakeCounts.get(word.id) || 0, lastWrong: lastWrong.get(word.id), topic: word.folderId ? folderNames.get(word.folderId) : undefined }))
      .filter((row) => row.score > 0.5)
      .sort((a, b) => b.score - a.score);
  }, [vocabularies, folders, mistakes, lapses]);

  const shown = rows.slice(0, visible);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-inner">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{rows.length} weak {rows.length === 1 ? 'word' : 'words'}</h2>
            <p className="mt-0.5 max-w-md text-xs text-slate-500">
              Words you keep forgetting in flashcards or getting wrong in quizzes, ranked automatically. A word leaves this list once you answer it correctly in a quiz or it becomes well learned.
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => onPracticeQuiz(rows.length)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">
              <HelpCircle className="h-4 w-4" /> Quiz me on these
            </button>
            <Link href="/study" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Layers className="h-4 w-4" /> Review flashcards
            </Link>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="space-y-2 p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-700">No weak words right now</p>
            <p className="mx-auto max-w-sm text-xs text-slate-500">Words show up here after you forget them in flashcards or miss them in a quiz.</p>
            <Link href="/quiz" className="inline-block pt-2 text-xs font-semibold text-indigo-600 hover:underline">Take a quiz</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map(({ word, mistakes: missed, lastWrong, topic }) => {
              const forgot = word.status === 'mastered' ? 0 : lapses.get(word.id) || 0;
              return (
                <li key={word.id} className="flex flex-col justify-between gap-3 p-5 transition-colors hover:bg-slate-50/80 md:flex-row md:items-center">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900">{word.word}</span>
                      <span className="text-xs text-slate-400">→</span>
                      <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{word.meaning}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      {forgot > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Forgot {forgot}× in flashcards</span>}
                      {missed > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Missed {missed}× in quizzes</span>}
                      {word.easeFactor < 2 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Hard for you</span>}
                    </div>
                    {lastWrong && <p className="text-xs text-slate-500">Last wrong answer: <span className="font-semibold text-rose-600">{lastWrong}</span></p>}
                  </div>
                  <div className="shrink-0 text-xs text-slate-500 md:text-right">
                    {topic && <p className="font-medium text-slate-700">{topic}</p>}
                    <p>{nextReviewLabel(word)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > visible && (
          <button type="button" onClick={() => setVisible((value) => value + PAGE_SIZE)} className="w-full border-t border-slate-100 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Show more ({rows.length - visible} left)
          </button>
        )}
      </div>
    </div>
  );
}
