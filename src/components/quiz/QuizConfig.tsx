'use client';

import React, { useState } from 'react';
import { HelpCircle, Play, BookOpen, Check } from 'lucide-react';
import { Folder, Vocabulary } from '@/types';

interface QuizConfigProps {
  folders: Folder[];
  vocabularies: Vocabulary[];
  isLoading?: boolean;
  onStartQuiz: (
    selectedFolderIds: string[] | null,
    questionCount: number,
    mode: 'mixed' | 'mcq' | 'reverse'
  ) => void;
}

export function QuizConfig({ folders, vocabularies, isLoading = false, onStartQuiz }: QuizConfigProps) {
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [scopeMode, setScopeMode] = useState<'all' | 'custom'>('all');
  const [questionCount, setQuestionCount] = useState(10);
  const [quizType, setQuizType] = useState<'mixed' | 'mcq' | 'reverse'>('mixed');
  const selectedWords = scopeMode === 'all'
    ? vocabularies
    : vocabularies.filter((vocab) => vocab.folderId && selectedFolderIds.includes(vocab.folderId));

  const toggleFolder = (id: string) => {
    if (selectedFolderIds.includes(id)) {
      setSelectedFolderIds(selectedFolderIds.filter((f) => f !== id));
    } else {
      setSelectedFolderIds([...selectedFolderIds, id]);
    }
  };

  const handleStart = () => {
    if (scopeMode === 'custom' && selectedFolderIds.length === 0) {
      alert('Please select at least one folder for the quiz.');
      return;
    }
    onStartQuiz(
      scopeMode === 'all' ? null : selectedFolderIds,
      questionCount,
      quizType
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Vocabulary Quiz & Assessment</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Test your retention with Multiple Choice and Reverse Translation questions.
        </p>
      </div>

      {/* Scope Choice */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          1. Select Quiz Library Scope
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setScopeMode('all')}
            className={`p-4 rounded-xl border text-left flex items-center justify-between text-xs font-semibold ${
              scopeMode === 'all'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-slate-200 text-slate-700'
            }`}
          >
            <span>Entire Library ({vocabularies.length} words)</span>
            {scopeMode === 'all' && <Check className="w-4 h-4 text-blue-600" />}
          </button>
          <button
            onClick={() => setScopeMode('custom')}
            className={`p-4 rounded-xl border text-left flex items-center justify-between text-xs font-semibold ${
              scopeMode === 'custom'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-slate-200 text-slate-700'
            }`}
          >
            <span>Select Specific Topics</span>
            {scopeMode === 'custom' && <Check className="w-4 h-4 text-blue-600" />}
          </button>
        </div>
      </div>

      {scopeMode === 'custom' && (
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-xl">
          {folders.map((f) => (
            <div
              key={f.id}
              onClick={() => toggleFolder(f.id)}
              className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between ${
                selectedFolderIds.includes(f.id)
                  ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span className="truncate">{f.name}</span>
            </div>
          ))}
        </div>
      )}

      {!isLoading && selectedWords.length < 4 && (
        <p className="text-center text-sm text-slate-500">
          {selectedWords.length === 0
            ? 'Add vocabulary to this scope to begin a quiz.'
            : `Add ${4 - selectedWords.length} more unique words to create a multiple-choice quiz.`}
        </p>
      )}

      {/* Question Count & Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            2. Question Count
          </label>
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white font-medium outline-none"
          >
            <option value={5}>5 Questions</option>
            <option value={10}>10 Questions</option>
            <option value={15}>15 Questions</option>
            <option value={20}>20 Questions</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            3. Question Format
          </label>
          <select
            value={quizType}
            onChange={(e) => setQuizType(e.target.value as any)}
            className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white font-medium outline-none"
          >
            <option value="mixed">Mixed (All Types)</option>
            <option value="mcq">Multiple Choice (Eng → Vie)</option>
            <option value="reverse">Reverse Translation (Vie → Eng)</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={isLoading || selectedWords.length < 4}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold rounded-2xl text-xs transition-colors shadow-md flex items-center justify-center space-x-2"
      >
        <Play className="w-4 h-4 fill-white" />
        <span>{isLoading ? 'Loading vocabulary…' : 'Start Quiz'}</span>
      </button>
    </div>
  );
}
