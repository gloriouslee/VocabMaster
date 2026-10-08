'use client';

import React, { useMemo, useState } from 'react';
import { HelpCircle, Play, History, RotateCcw } from 'lucide-react';
import { Folder, QuizResult, Vocabulary } from '@/types';
import { getFolderScopeIds } from '@/lib/folderScope';
import { FolderPicker } from '@/components/common/FolderPicker';
import {
  FORMAT_LABELS,
  QuizFormat,
  QuizSource,
  SOURCE_LABELS,
  dedupeWords,
  minimumWords,
} from '@/lib/quizBuilder';

export interface QuizOptions {
  /** Folders the learner ticked (used for the saved result). Empty means the whole library. */
  folderIds: string[];
  /** Ticked folders plus all their subfolders. Null means the whole library. */
  scopeFolderIds: string[] | null;
  count: number;
  source: QuizSource;
  format: QuizFormat;
}

export interface QuizPrefs {
  count: number;
  source: QuizSource;
  format: QuizFormat;
}

interface QuizConfigProps {
  folders: Folder[];
  vocabularies: Vocabulary[];
  isLoading?: boolean;
  message?: string | null;
  history: QuizResult[];
  resume: { answered: number; total: number } | null;
  initialPrefs: QuizPrefs;
  onResume: () => void;
  onDiscardResume: () => void;
  onStartQuiz: (options: QuizOptions) => void;
}

const COUNT_OPTIONS = [5, 10, 15, 20, 30, 0];

export function QuizConfig({
  folders,
  vocabularies,
  isLoading = false,
  message,
  history,
  resume,
  initialPrefs,
  onResume,
  onDiscardResume,
  onStartQuiz,
}: QuizConfigProps) {
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [count, setCount] = useState(initialPrefs.count);
  const [source, setSource] = useState<QuizSource>(initialPrefs.source);
  const [format, setFormat] = useState<QuizFormat>(initialPrefs.format);

  const scopeIds = useMemo(() => {
    if (selectedFolderIds.length === 0) return null;
    const ids = new Set<string>();
    for (const id of selectedFolderIds) getFolderScopeIds(folders, id).forEach((scopeId) => ids.add(scopeId));
    return ids;
  }, [folders, selectedFolderIds]);

  const scoped = useMemo(
    () => dedupeWords(vocabularies.filter((word) => !scopeIds || (word.folderId !== null && scopeIds.has(word.folderId)))),
    [vocabularies, scopeIds],
  );

  const now = Date.now();
  const availableBySource: Record<QuizSource, number | null> = {
    random: scoped.length,
    weak: null,
    due: scoped.filter((word) => word.status !== 'new' && new Date(word.nextReviewAt).getTime() <= now).length,
    mastered: scoped.filter((word) => word.status === 'mastered').length,
  };
  const available = availableBySource[source];
  const minimum = minimumWords(format);
  const tooFewWords = !isLoading && scoped.length < minimum;
  const noSourceWords = available === 0;

  const countFor = (folderId: string) => {
    const ids = getFolderScopeIds(folders, folderId);
    return vocabularies.filter((word) => word.folderId && ids.has(word.folderId)).length;
  };

  const toggleFolder = (id: string) =>
    setSelectedFolderIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const handleStart = () =>
    onStartQuiz({
      folderIds: selectedFolderIds,
      scopeFolderIds: scopeIds ? [...scopeIds] : null,
      count,
      source,
      format,
    });

  const recent = history.slice(0, 5);
  const summaryLine = `${count === 0 ? 'All' : count} ${SOURCE_LABELS[source].toLowerCase()} · ${FORMAT_LABELS[format].split(' (')[0].toLowerCase()}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-inner">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Vocabulary quiz</h2>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          Test what you really remember. Wrong answers are rescheduled for review automatically.
        </p>
      </div>

      {resume && (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-indigo-900">
            <span className="font-semibold">Unfinished quiz</span> · {resume.answered} of {resume.total} answered
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onResume} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
              <RotateCcw className="h-3.5 w-3.5" /> Resume
            </button>
            <button type="button" onClick={onDiscardResume} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">Discard</button>
          </div>
        </div>
      )}

      {message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}

      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading || tooFewWords || noSourceWords}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4 fill-white" />
        <span>{isLoading ? 'Loading vocabulary…' : 'Start quiz'}</span>
      </button>
      <p className="text-center text-xs text-slate-500">{summaryLine}{selectedFolderIds.length > 0 ? ` · ${selectedFolderIds.length} topic${selectedFolderIds.length === 1 ? '' : 's'}` : ' · whole library'}</p>

      {tooFewWords && (
        <p className="text-center text-sm text-slate-500">
          {scoped.length === 0
            ? 'Add vocabulary to this scope to begin a quiz.'
            : `Add ${minimum - scoped.length} more unique ${minimum - scoped.length === 1 ? 'word' : 'words'} to create this quiz, or choose the "Type the word" format.`}
        </p>
      )}
      {!tooFewWords && noSourceWords && (
        <p className="text-center text-sm text-slate-500">
          {source === 'due' ? 'Nothing is due in this scope right now.' : 'No mastered words yet in this scope.'} Pick another word source.
        </p>
      )}

      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowOptions((value) => !value)}
          aria-expanded={showOptions}
          className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
        >
          Customize quiz
          <span className="text-xs font-normal text-slate-500">{showOptions ? 'Hide' : 'Show'}</span>
        </button>

        {showOptions && (
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                Which words
                <select value={source} onChange={(event) => setSource(event.target.value as QuizSource)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {(Object.keys(SOURCE_LABELS) as QuizSource[]).map((value) => (
                    <option key={value} value={value}>{SOURCE_LABELS[value]}{availableBySource[value] !== null ? ` (${availableBySource[value]})` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                Number of questions
                <select value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {COUNT_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value === 0 ? 'All matching words' : `${value} questions`}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                Question format
                <select value={format} onChange={(event) => setFormat(event.target.value as QuizFormat)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {(Object.keys(FORMAT_LABELS) as QuizFormat[]).map((value) => (
                    <option key={value} value={value}>{FORMAT_LABELS[value]}</option>
                  ))}
                </select>
              </label>
            </div>

            {source === 'weak' && (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Weak words are ones you often forget in flashcards, got wrong in earlier quizzes, or that have a low ease score. If you have fewer than the number requested, the quiz is shorter.
              </p>
            )}

            {folders.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Topics {selectedFolderIds.length > 0 ? `(${selectedFolderIds.length} selected, subfolders included)` : '(whole library)'}
                </p>
                <FolderPicker folders={folders} selectedIds={selectedFolderIds} onToggle={toggleFolder} countFor={countFor} />
                {selectedFolderIds.length > 0 && (
                  <button type="button" onClick={() => setSelectedFolderIds([])} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Clear selection</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><History className="h-3.5 w-3.5" /> Recent results</p>
          <ul className="space-y-1.5">
            {recent.map((result) => (
              <li key={result.id} className="flex items-center gap-3 text-xs text-slate-600">
                <span className="w-24 shrink-0">{new Date(result.createdAt).toLocaleDateString()}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-2 rounded-full ${result.scorePercent >= 80 ? 'bg-emerald-500' : result.scorePercent >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${result.scorePercent}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right font-semibold text-slate-800">{result.scorePercent}% · {result.correctCount}/{result.totalQuestions}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
