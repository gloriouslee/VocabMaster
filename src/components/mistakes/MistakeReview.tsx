'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Trash2, ArrowRight, Play } from 'lucide-react';
import { MistakeLog } from '@/types';
import { StorageService } from '@/lib/storage';

interface MistakeReviewProps {
  mistakes: MistakeLog[];
  onRefresh: () => void;
}

export function MistakeReview({ mistakes, onRefresh }: MistakeReviewProps) {
  const [activeTab, setActiveTab] = useState<'unresolved' | 'resolved'>('unresolved');

  const unresolved = mistakes.filter((m) => !m.resolved);
  const resolved = mistakes.filter((m) => m.resolved);

  const displayList = activeTab === 'unresolved' ? unresolved : resolved;

  const handleResolve = (id: string) => {
    StorageService.resolveMistakeLog(id);
    onRefresh();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Mistake Review Bank</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically saved incorrect quiz answers for targeted review and mastery.
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('unresolved')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'unresolved'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Needs Practice ({unresolved.length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'resolved'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Mastered ({resolved.length})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {displayList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No mistakes in this list!</p>
            <p className="text-xs text-slate-400">
              {activeTab === 'unresolved'
                ? 'Great job! Take quizzes to test your memory, any mistakes will appear here.'
                : 'You have not marked any mistakes as resolved yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayList.map((m) => (
              <div
                key={m.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-base text-slate-900">{m.word}</span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      {m.meaning}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Your Incorrect Answer: <span className="text-rose-600 font-semibold">{m.userAnswer}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {!m.resolved && (
                    <button
                      onClick={() => handleResolve(m.id)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs transition-colors border border-emerald-200"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark as Mastered</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
