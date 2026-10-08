'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Volume2,
  CheckCircle,
  Clock,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Vocabulary, Folder, VocabStatus } from '@/types';

interface VocabTableProps {
  vocabularies: Vocabulary[];
  folders: Folder[];
  selectedFolderId?: string | null;
  onAddWord: () => void;
  onEditWord: (vocab: Vocabulary) => void;
  onDeleteWord: (id: string) => void;
}

export function VocabTable({
  vocabularies,
  folders,
  selectedFolderId,
  onAddWord,
  onEditWord,
  onDeleteWord,
}: VocabTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VocabStatus | 'all'>('all');
  const [folderFilter, setFolderFilter] = useState<string | 'all'>(
    selectedFolderId || 'all'
  );

  const handleSpeak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const folderMap = new Map<string, string>();
  folders.forEach((f) => folderMap.set(f.id, f.name));

  const filtered = vocabularies.filter((v) => {
    const matchesSearch =
      v.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.example && v.example.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchesFolder =
      folderFilter === 'all' || v.folderId === folderFilter;

    return matchesSearch && matchesStatus && matchesFolder;
  });

  const getStatusBadge = (status: VocabStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Sparkles className="w-3 h-3 text-blue-500" />
            New
          </span>
        );
      case 'learning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            Learning
          </span>
        );
      case 'mastered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            Mastered
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search word, meaning, example sentence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="learning">Learning</option>
              <option value="mastered">Mastered</option>
            </select>
          </div>

          {/* Folder Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="all">All Folders</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Add Word Button */}
          <button
            onClick={onAddWord}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Word</span>
          </button>
        </div>
      </div>

      {/* Vocabulary Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
              <th className="py-3.5 px-5">Word & Phonetic</th>
              <th className="py-3.5 px-5">Vietnamese Meaning</th>
              <th className="py-3.5 px-5">Word Type</th>
              <th className="py-3.5 px-5">Topic / Folder</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  No vocabulary words found matching your search and filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((vocab) => (
                <tr key={vocab.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSpeak(vocab.word)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                        title="Listen Pronunciation"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{vocab.word}</span>
                        {vocab.phonetic && (
                          <span className="ml-2 font-mono text-[11px] text-slate-400">
                            {vocab.phonetic}
                          </span>
                        )}
                        {vocab.level && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {vocab.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5 font-medium text-slate-700">
                    {vocab.meaning}
                    {vocab.example && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5 max-w-xs truncate">
                        &quot;{vocab.example}&quot;
                      </p>
                    )}
                  </td>
                  <td className="py-4 px-5 capitalize font-semibold text-slate-500">
                    {vocab.wordType}
                  </td>
                  <td className="py-4 px-5 text-slate-600 font-medium">
                    {vocab.folderId && folderMap.get(vocab.folderId) ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {folderMap.get(vocab.folderId)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">Uncategorized</span>
                    )}
                  </td>
                  <td className="py-4 px-5">{getStatusBadge(vocab.status)}</td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onEditWord(vocab)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Word"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteWord(vocab.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Word"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
