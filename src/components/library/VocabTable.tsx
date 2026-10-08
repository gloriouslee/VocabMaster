'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Edit,
  Trash2,
  Volume2,
  CheckCircle,
  Clock,
  Sparkles,
  Download,
  X,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { Vocabulary, Folder, VocabStatus } from '@/types';

interface VocabTableProps {
  vocabularies: Vocabulary[];
  folders: Folder[];
  selectedFolderId?: string | null;
  onClearFolder: () => void;
  onAddWord: () => void;
  onEditWord: (vocab: Vocabulary) => void;
  onDeleteWord: (id: string) => void;
}

const statusLabels: Record<VocabStatus, string> = {
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
};

export function VocabTable({
  vocabularies,
  folders,
  selectedFolderId,
  onClearFolder,
  onAddWord,
  onEditWord,
  onDeleteWord,
}: VocabTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VocabStatus | 'all'>('all');
  const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
  const selectedFolderName = selectedFolderId ? folderMap.get(selectedFolderId) : null;
  const query = searchQuery.trim().toLocaleLowerCase();

  const filtered = vocabularies.filter((vocab) => {
    const matchesSearch = !query || [
      vocab.word,
      vocab.meaning,
      vocab.example || '',
      vocab.phonetic || '',
      vocab.level || '',
    ].some((value) => value.toLocaleLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || vocab.status === statusFilter) &&
      (!selectedFolderId || vocab.folderId === selectedFolderId);
  });

  const hasActiveFilters = Boolean(query || statusFilter !== 'all' || selectedFolderId);
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    onClearFolder();
  };

  const handleSpeak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleExport = () => {
    const headers = ['Word', 'Vietnamese Meaning', 'Word Type', 'Phonetic', 'Level', 'Example Sentence', 'Folder', 'Status', 'Next Review'];
    const rows = filtered.map((vocab) => [
      vocab.word,
      vocab.meaning,
      vocab.wordType,
      vocab.phonetic || '',
      vocab.level || '',
      vocab.example || '',
      vocab.folderId ? folderMap.get(vocab.folderId) || '' : '',
      vocab.status,
      vocab.nextReviewAt,
    ]);
    const csvCell = (value: string) => {
      const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocabmaster-words-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const getStatusBadge = (status: VocabStatus) => {
    const style = {
      new: 'border-blue-200 bg-blue-50 text-blue-700',
      learning: 'border-amber-200 bg-amber-50 text-amber-700',
      mastered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }[status];
    const Icon = { new: Sparkles, learning: Clock, mastered: CheckCircle }[status];
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>
        <Icon className="h-3.5 w-3.5" />{statusLabels[status]}
      </span>
    );
  };

  return (
    <section aria-label="Vocabulary list" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search words, meanings, examples…"
              aria-label="Search vocabulary"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </label>
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <Filter className="h-4 w-4 text-slate-400" />
              <span>Status</span>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as VocabStatus | 'all')}
                className="max-w-[135px] bg-transparent text-sm text-slate-800 outline-none"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="learning">Learning</option>
                <option value="mastered">Mastered</option>
              </select>
            </label>
            {selectedFolderName && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                <FolderOpen className="h-3.5 w-3.5" />{selectedFolderName}
              </span>
            )}
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
          <p aria-live="polite" className="text-xs font-medium text-slate-500">
            Showing <span className="font-bold text-slate-800">{filtered.length}</span> of {vocabularies.length} words
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Search className="h-5 w-5" />
          </span>
          <h2 className="text-base font-bold text-slate-900">
            {vocabularies.length === 0 ? 'Your library is ready for its first words' : 'No words match these filters'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {vocabularies.length === 0
              ? 'Add a word or import a vocabulary file to start building your collection.'
              : 'Try another search or remove a filter to see more results.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {vocabularies.length === 0 ? (
              <>
                <button onClick={onAddWord} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add a word</button>
                <Link href="/import" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Import a file</Link>
              </>
            ) : (
              <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Word</th>
                  <th className="px-5 py-3">Meaning & example</th>
                  <th className="px-5 py-3">Topic</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((vocab) => (
                  <tr key={vocab.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2">
                        <button onClick={() => handleSpeak(vocab.word)} aria-label={`Pronounce ${vocab.word}`} title="Listen" className="mt-0.5 rounded-md p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Volume2 className="h-4 w-4" /></button>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{vocab.word}</p>
                          {vocab.phonetic && <p className="mt-0.5 font-mono text-xs text-slate-500">{vocab.phonetic}</p>}
                          <p className="mt-1 text-[11px] capitalize text-slate-400">{vocab.wordType}{vocab.level ? ` · ${vocab.level}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[360px] px-5 py-4">
                      <p className="font-medium text-slate-800">{vocab.meaning}</p>
                      {vocab.example && <p className="mt-1 line-clamp-2 text-xs italic leading-relaxed text-slate-500">“{vocab.example}”</p>}
                    </td>
                    <td className="px-5 py-4">
                      {vocab.folderId && folderMap.get(vocab.folderId)
                        ? <span className="inline-flex max-w-[150px] truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{folderMap.get(vocab.folderId)}</span>
                        : <span className="text-xs text-slate-400">Uncategorized</span>}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(vocab.status)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => onEditWord(vocab)} aria-label={`Edit ${vocab.word}`} title="Edit word" className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => onDeleteWord(vocab.id)} aria-label={`Delete ${vocab.word}`} title="Delete word" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {filtered.map((vocab) => (
              <li key={vocab.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <button onClick={() => handleSpeak(vocab.word)} aria-label={`Pronounce ${vocab.word}`} className="mt-0.5 rounded-md p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Volume2 className="h-4 w-4" /></button>
                    <div className="min-w-0">
                      <p className="break-words text-base font-bold text-slate-900">{vocab.word}</p>
                      {vocab.phonetic && <p className="mt-0.5 font-mono text-xs text-slate-500">{vocab.phonetic}</p>}
                      <p className="mt-1 text-xs capitalize text-slate-400">{vocab.wordType}{vocab.level ? ` · ${vocab.level}` : ''}</p>
                    </div>
                  </div>
                  {getStatusBadge(vocab.status)}
                </div>
                <div className="pl-7">
                  <p className="text-sm font-medium leading-relaxed text-slate-800">{vocab.meaning}</p>
                  {vocab.example && <p className="mt-1 text-xs italic leading-relaxed text-slate-500">“{vocab.example}”</p>}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{vocab.folderId ? folderMap.get(vocab.folderId) || 'Uncategorized' : 'Uncategorized'}</span>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => onEditWord(vocab)} aria-label={`Edit ${vocab.word}`} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => onDeleteWord(vocab.id)} aria-label={`Delete ${vocab.word}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
