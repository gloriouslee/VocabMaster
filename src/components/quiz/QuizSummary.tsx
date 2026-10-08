'use client';

import React, { useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RotateCcw, Layers, TrendingUp, TrendingDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { Folder } from '@/types';
import { QuizAnswer, TYPE_LABELS } from '@/lib/quizBuilder';

interface QuizSummaryProps {
  userAnswers: QuizAnswer[];
  folders: Folder[];
  /** Score of the previous saved quiz, if any. */
  previousScore: number | null;
  elapsedMs: number;
  /** True for a retry round of missed questions, which is not saved as a new result. */
  isPractice: boolean;
  scheduleNote: string | null;
  onRetakeQuiz: () => void;
  onRetryWrong: () => void;
}

export function QuizSummary({ userAnswers, folders, previousScore, elapsedMs, isPractice, scheduleNote, onRetakeQuiz, onRetryWrong }: QuizSummaryProps) {
  const total = userAnswers.length;
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const wrongCount = total - correctCount;
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const minutes = Math.max(1, Math.round(elapsedMs / 60000));
  const delta = previousScore === null ? null : scorePercent - previousScore;

  useEffect(() => {
    if (scorePercent >= 70 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }
  }, [scorePercent]);

  const byTopic = useMemo(() => {
    const names = new Map(folders.map((folder) => [folder.id, folder.name]));
    const groups = new Map<string, { name: string; total: number; correct: number }>();
    for (const answer of userAnswers) {
      const key = answer.question.vocab.folderId || 'none';
      const name = (answer.question.vocab.folderId && names.get(answer.question.vocab.folderId)) || 'Uncategorized';
      const group = groups.get(key) || { name, total: 0, correct: 0 };
      group.total += 1;
      if (answer.isCorrect) group.correct += 1;
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
  }, [userAnswers, folders]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl font-extrabold shadow-inner ${
            scorePercent >= 80 ? 'bg-emerald-100 text-emerald-600' : scorePercent >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
          }`}
        >
          {scorePercent}%
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">{isPractice ? 'Retry round complete' : 'Quiz completed!'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {scorePercent >= 80
              ? 'Outstanding! You have strong recall of these words.'
              : scorePercent >= 60
                ? 'Good effort. Review the missed words below to lock them in.'
                : 'Keep going. Reviewing mistakes is how long-term recall is built.'}
          </p>
          {delta !== null && !isPractice && (
            <p className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {delta === 0 ? 'Same as your last quiz' : `${delta > 0 ? '+' : ''}${delta} points vs your last quiz (${previousScore}%)`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3 pt-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><span className="block text-[11px] font-bold uppercase text-slate-500">Score</span><span className="text-xl font-extrabold text-slate-900">{scorePercent}%</span></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><span className="block text-[11px] font-bold uppercase text-emerald-700">Correct</span><span className="text-xl font-extrabold text-emerald-900">{correctCount}</span></div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3"><span className="block text-[11px] font-bold uppercase text-rose-700">Wrong</span><span className="text-xl font-extrabold text-rose-900">{wrongCount}</span></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><span className="block text-[11px] font-bold uppercase text-slate-500">Time</span><span className="text-xl font-extrabold text-slate-900">{minutes}m</span></div>
        </div>

        {scheduleNote && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{scheduleNote}</p>}

        <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={onRetakeQuiz} className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200">
            New quiz
          </button>
          {wrongCount > 0 && (
            <>
              <button type="button" onClick={onRetryWrong} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700">
                <RotateCcw className="h-4 w-4" /> Retry {wrongCount} missed
              </button>
              <Link href="/study" className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700">
                <Layers className="h-4 w-4" /> Study as flashcards
              </Link>
            </>
          )}
        </div>
        {wrongCount > 0 && (
          <Link href="/weak-words" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <AlertCircle className="h-3.5 w-3.5" /> See all my weak words
          </Link>
        )}
      </div>

      {byTopic.length > 1 && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Accuracy by topic</h3>
          <ul className="space-y-2">
            {byTopic.map((group) => {
              const percent = Math.round((group.correct / group.total) * 100);
              return (
                <li key={group.name} className="flex items-center gap-3 text-xs text-slate-600">
                  <span className="w-32 shrink-0 truncate font-medium text-slate-800">{group.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-2 rounded-full ${percent >= 80 ? 'bg-emerald-500' : percent >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${percent}%` }} />
                  </span>
                  <span className="w-20 shrink-0 text-right font-semibold">{group.correct}/{group.total} · {percent}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Question breakdown</h3>
        <div className="space-y-3">
          {userAnswers.map((answer, index) => (
            <div key={answer.question.id} className={`space-y-1 rounded-2xl border p-4 text-xs ${answer.isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-900">#{index + 1}. {answer.question.vocab.word} <span className="font-normal text-slate-500">· {TYPE_LABELS[answer.question.type]}</span></span>
                {answer.isCorrect ? (
                  <span className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Correct</span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 font-bold text-rose-700"><XCircle className="h-4 w-4" /> Incorrect</span>
                )}
              </div>
              <div className="space-y-0.5 pt-1 text-slate-600">
                <p>Meaning: {answer.question.vocab.meaning}</p>
                <p>Your answer: <strong className={answer.isCorrect ? 'text-emerald-800' : 'text-rose-800'}>{answer.selectedAnswer}</strong></p>
                {!answer.isCorrect && <p>Correct answer: <strong className="text-emerald-800">{answer.question.correctAnswer}</strong></p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
