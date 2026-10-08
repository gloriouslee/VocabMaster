'use client';

import React, { useState } from 'react';
import { Layers, Folder as FolderIcon, BookOpen, Play, Check } from 'lucide-react';
import { Folder, Vocabulary } from '@/types';

interface ScopeSelectorProps {
  folders: Folder[];
  vocabularies: Vocabulary[];
  onStartStudy: (selectedFolderIds: string[] | null) => void;
}

export function ScopeSelector({
  folders,
  vocabularies,
  onStartStudy,
}: ScopeSelectorProps) {
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'all' | 'custom'>('all');

  const toggleFolder = (id: string) => {
    if (selectedFolderIds.includes(id)) {
      setSelectedFolderIds(selectedFolderIds.filter((f) => f !== id));
    } else {
      setSelectedFolderIds([...selectedFolderIds, id]);
    }
  };

  const countForFolder = (folderId: string | null) => {
    if (!folderId) return vocabularies.length;
    return vocabularies.filter((v) => v.folderId === folderId).length;
  };

  const handleStart = () => {
    if (mode === 'all') {
      onStartStudy(null);
    } else {
      if (selectedFolderIds.length === 0) {
        alert('Please select at least one folder to study.');
        return;
      }
      onStartStudy(selectedFolderIds);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Layers className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Select Learning Scope</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Choose whether to practice your entire IELTS vocabulary library or focus on specific topic folders.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setMode('all')}
          className={`p-5 rounded-2xl border-2 text-left transition-all relative ${
            mode === 'all'
              ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          {mode === 'all' && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center">
              <Check className="w-3 h-3" />
            </div>
          )}
          <BookOpen className="w-6 h-6 text-blue-600 mb-2" />
          <h3 className="font-bold text-sm text-slate-900">Entire Library</h3>
          <p className="text-xs text-slate-500 mt-1">
            Study all {vocabularies.length} words with active spaced repetition.
          </p>
        </button>

        <button
          onClick={() => setMode('custom')}
          className={`p-5 rounded-2xl border-2 text-left transition-all relative ${
            mode === 'custom'
              ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          {mode === 'custom' && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center">
              <Check className="w-3 h-3" />
            </div>
          )}
          <FolderIcon className="w-6 h-6 text-indigo-600 mb-2" />
          <h3 className="font-bold text-sm text-slate-900">Specific Topic Folders</h3>
          <p className="text-xs text-slate-500 mt-1">
            Select one or multiple folders to practice.
          </p>
        </button>
      </div>

      {mode === 'custom' && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Choose Folders ({selectedFolderIds.length} selected):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {folders.map((f) => {
              const isSelected = selectedFolderIds.includes(f.id);
              const count = countForFolder(f.id);

              return (
                <div
                  key={f.id}
                  onClick={() => toggleFolder(f.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/80 text-blue-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <FolderIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    {f.name}
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500 font-bold">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleStart}
        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2"
      >
        <Play className="w-4 h-4 fill-white" />
        <span>Start Spaced Repetition Session</span>
      </button>
    </div>
  );
}
