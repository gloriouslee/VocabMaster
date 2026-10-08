'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Folder as FolderIcon, Layers, Play } from 'lucide-react';
import { Folder, Vocabulary } from '@/types';
import { getFolderScopeIds } from '@/lib/folderScope';
import {
  BACKLOG_RESTART_THRESHOLD,
  DailyPrefs,
  MAX_REVIEW_OPTIONS,
  NEW_PER_DAY_OPTIONS,
  TodayActivity,
  estimateMinutes,
  remainingNewToday,
} from '@/lib/dailyPlan';
import { STUDY_MODE_LABELS, StudyMode } from '@/lib/cards';

export interface StudyOptions {
  /** Folder ids (already expanded to include subfolders), or null for the whole library. */
  folderIds: string[] | null;
  includeNotDue: boolean;
  mode: StudyMode;
}

interface ScopeSelectorProps {
  folders: Folder[];
  vocabularies: Vocabulary[];
  isLoading?: boolean;
  message?: string | null;
  initialMode: StudyMode;
  dailyPrefs: DailyPrefs;
  activity: TodayActivity;
  onChangePrefs: (prefs: DailyPrefs) => void;
  onSpreadBacklog: () => void;
  initialPracticeAhead?: boolean;
  onStartStudy: (options: StudyOptions) => void;
}

export function ScopeSelector({
  folders,
  vocabularies,
  isLoading = false,
  message,
  initialMode,
  dailyPrefs,
  activity,
  onChangePrefs,
  onSpreadBacklog,
  initialPracticeAhead = false,
  onStartStudy,
}: ScopeSelectorProps) {
  const [showOptions, setShowOptions] = useState(initialPracticeAhead);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [includeNotDue, setIncludeNotDue] = useState(initialPracticeAhead);
  const [mode, setMode] = useState<StudyMode>(initialMode);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const scopeIds = useMemo(() => {
    if (selectedFolderIds.length === 0) return null;
    const ids = new Set<string>();
    for (const id of selectedFolderIds) getFolderScopeIds(folders, id).forEach((scopeId) => ids.add(scopeId));
    return ids;
  }, [folders, selectedFolderIds]);

  const now = Date.now();
  const inScope = (word: Vocabulary) => !scopeIds || (word.folderId !== null && scopeIds.has(word.folderId));
  const isDue = (word: Vocabulary) => word.status === 'new' || new Date(word.nextReviewAt).getTime() <= now;

  const scoped = vocabularies.filter(inScope);
  const dueReviews = scoped.filter((word) => word.status !== 'new' && isDue(word)).length;
  const newWords = scoped.filter((word) => word.status === 'new').length;
  const newAllowance = remainingNewToday(dailyPrefs, activity);
  const newCount = newAllowance === null ? newWords : Math.min(newAllowance, newWords);
  const sessionReviews = !includeNotDue && dailyPrefs.maxReviews > 0 ? Math.min(dailyPrefs.maxReviews, dueReviews) : dueReviews;
  const aheadReviews = scoped.filter((word) => word.status !== 'new').length;
  const availableCount = includeNotDue ? aheadReviews + newCount : sessionReviews + newCount;
  const deferred = includeNotDue ? 0 : dueReviews - sessionReviews;
  const overdueTotal = vocabularies.filter((word) => word.status !== 'new' && new Date(word.nextReviewAt).getTime() <= now).length;

  const countFor = (folderId: string) => {
    const ids = getFolderScopeIds(folders, folderId);
    return vocabularies.filter((word) => word.folderId && ids.has(word.folderId) && (includeNotDue || isDue(word))).length;
  };

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const folder of folders) {
      const siblings = map.get(folder.parentId) || [];
      siblings.push(folder);
      map.set(folder.parentId, siblings);
    }
    return map;
  }, [folders]);

  const toggleFolder = (id: string) =>
    setSelectedFolderIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const toggleCollapsed = (id: string) =>
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleStart = () =>
    onStartStudy({
      folderIds: scopeIds ? [...scopeIds] : null,
      includeNotDue,
      mode,
    });

  const renderFolder = (folder: Folder, level: number): React.ReactNode => {
    const children = childrenByParent.get(folder.id) || [];
    const isSelected = selectedFolderIds.includes(folder.id);
    const isCollapsed = collapsedIds.has(folder.id);
    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs transition-colors ${
            isSelected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-transparent text-slate-700 hover:bg-slate-50'
          }`}
          style={{ marginLeft: level * 16 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleCollapsed(folder.id)}
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${folder.name}`}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-[22px]" />
          )}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleFolder(folder.id)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <FolderIcon className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="truncate font-medium">{folder.name}</span>
          </label>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-bold text-slate-500">{countFor(folder.id)}</span>
        </div>
        {!isCollapsed && children.map((child) => renderFolder(child, level + 1))}
      </div>
    );
  };

  const startLabel = isLoading
    ? 'Loading library…'
    : includeNotDue
      ? `Practice ${availableCount} cards`
      : `Start today's session · ${availableCount} ${availableCount === 1 ? 'card' : 'cards'} (~${estimateMinutes(availableCount)} min)`;

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-inner">
          <Layers className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ready to study?</h2>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          {isLoading
            ? 'Loading your cards…'
            : `${dueReviews} due for review · ${newCount} of ${newWords} new ${newWords === 1 ? 'word' : 'words'} available today`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-lg font-extrabold text-amber-900">{dueReviews}</p><p className="text-[11px] font-semibold uppercase text-amber-700">Due</p></div>
        <div className="rounded-xl bg-blue-50 p-3"><p className="text-lg font-extrabold text-blue-900">{newCount}</p><p className="text-[11px] font-semibold uppercase text-blue-700">New to learn</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-lg font-extrabold text-emerald-900">{vocabularies.filter((word) => word.status === 'mastered').length}</p><p className="text-[11px] font-semibold uppercase text-emerald-700">Mastered</p></div>
      </div>

      {activity.reviewsToday > 0 && (
        <p className="text-center text-xs text-slate-500">
          Already today: {activity.reviewsToday} {activity.reviewsToday === 1 ? 'card' : 'cards'} reviewed, {activity.newToday} new {activity.newToday === 1 ? 'word' : 'words'} learned.
        </p>
      )}
      {deferred > 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Sessions are capped at {dailyPrefs.maxReviews} reviews, so {deferred} more stay due for your next session. You can change the cap under Customize.
        </p>
      )}
      {overdueTotal >= BACKLOG_RESTART_THRESHOLD && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{overdueTotal} cards are overdue</p>
          <p className="mt-1 text-xs">A big backlog is discouraging. Keep the {dailyPrefs.maxReviews > 0 ? dailyPrefs.maxReviews : 50} most overdue cards for today and spread the rest over the next 7 days.</p>
          <button type="button" onClick={onSpreadBacklog} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700">Spread my backlog</button>
        </div>
      )}

      {message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}

      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading || availableCount === 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-sm font-extrabold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4 fill-white" />
        <span>{startLabel}</span>
      </button>

      {!isLoading && vocabularies.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          Your library is empty. <Link href="/import" className="font-semibold text-blue-600 hover:underline">Import vocabulary</Link> or add words in the library.
        </p>
      )}
      {!isLoading && vocabularies.length > 0 && availableCount === 0 && !includeNotDue && (
        <p className="text-center text-sm text-slate-500">Nothing is due in this scope. Open the options and turn on practice ahead to study anyway.</p>
      )}

      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowOptions((value) => !value)}
          aria-expanded={showOptions}
          className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
        >
          Customize session
          {showOptions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {showOptions && (
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                Card format
                <select value={mode} onChange={(event) => setMode(event.target.value as StudyMode)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {(Object.keys(STUDY_MODE_LABELS) as StudyMode[]).map((value) => (
                    <option key={value} value={value}>{STUDY_MODE_LABELS[value]}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                New words per day
                <select value={dailyPrefs.newPerDay} onChange={(event) => onChangePrefs({ ...dailyPrefs, newPerDay: Number(event.target.value) })} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {NEW_PER_DAY_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value === 0 ? 'No limit' : `${value} new words`}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                Most reviews per session
                <select value={dailyPrefs.maxReviews} onChange={(event) => onChangePrefs({ ...dailyPrefs, maxReviews: Number(event.target.value) })} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {MAX_REVIEW_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value === 0 ? 'No cap' : `${value} reviews`}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
              <input type="checkbox" checked={includeNotDue} onChange={(event) => setIncludeNotDue(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
              <span>
                <span className="block text-sm font-bold text-slate-900">Practice ahead</span>
                <span className="block text-xs text-slate-500">Include cards that are not due yet ({vocabularies.length} total). Ignores the review cap.</span>
              </span>
            </label>

            {folders.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Topics {selectedFolderIds.length > 0 ? `(${selectedFolderIds.length} selected, subfolders included)` : '(all)'}
                </p>
                <div className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
                  {(childrenByParent.get(null) || []).map((folder) => renderFolder(folder, 0))}
                </div>
                {selectedFolderIds.length > 0 && (
                  <button type="button" onClick={() => setSelectedFolderIds([])} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Clear selection</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
