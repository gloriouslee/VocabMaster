'use client';

import React, { useState } from 'react';
import {
  Volume2,
  Eye,
  RotateCcw,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Vocabulary } from '@/types';
import { Rating } from '@/lib/spacedRepetition';

interface FlashcardDeckProps {
  vocabularies: Vocabulary[];
  onRecordRating: (vocabId: string, rating: Rating) => void;
  onFinishSession: () => void;
}

export function FlashcardDeck({
  vocabularies,
  onRecordRating,
  onFinishSession,
}: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [ratingStats, setRatingStats] = useState({
    forgot: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const currentVocab = vocabularies[currentIndex];
  const isFinished = currentIndex >= vocabularies.length;

  const handleSpeak = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRating = (rating: Rating) => {
    if (!currentVocab) return;

    onRecordRating(currentVocab.id, rating);
    setRatingStats((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));
    setCompletedCount((prev) => prev + 1);

    setShowAnswer(false);

    if (currentIndex + 1 >= vocabularies.length) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    setCurrentIndex((prev) => prev + 1);
  };

  if (isFinished || vocabularies.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl max-w-lg mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Study Session Complete!</h2>
          <p className="text-xs text-slate-500 mt-1">
            Great job! You reviewed {completedCount} IELTS vocabulary cards today.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2">
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
            <span className="block text-[10px] font-bold text-rose-600 uppercase">Forgot</span>
            <span className="text-lg font-extrabold text-rose-900">{ratingStats.forgot}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
            <span className="block text-[10px] font-bold text-amber-600 uppercase">Hard</span>
            <span className="text-lg font-extrabold text-amber-900">{ratingStats.hard}</span>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100">
            <span className="block text-[10px] font-bold text-blue-600 uppercase">Good</span>
            <span className="text-lg font-extrabold text-blue-900">{ratingStats.good}</span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
            <span className="block text-[10px] font-bold text-emerald-600 uppercase">Easy</span>
            <span className="text-lg font-extrabold text-emerald-900">{ratingStats.easy}</span>
          </div>
        </div>

        <button
          onClick={onFinishSession}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-colors shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / vocabularies.length) * 100);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Session Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Card {currentIndex + 1} of {vocabularies.length}
          </span>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          {progressPercent}% Session
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Active Recall Card Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden transition-all min-h-[360px] flex flex-col justify-between relative">
        {/* Card Front */}
        <div className="p-8 text-center flex-1 flex flex-col justify-center items-center space-y-4">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
            {currentVocab.wordType} {currentVocab.level && `• ${currentVocab.level}`}
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {currentVocab.word}
            </h1>
            <button
              onClick={(e) => handleSpeak(currentVocab.word, e)}
              className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
              title="Pronounce Word"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          {currentVocab.phonetic && (
            <p className="text-base font-mono text-slate-500">{currentVocab.phonetic}</p>
          )}

          {/* Active Recall Answer Reveal */}
          {!showAnswer ? (
            <div className="pt-6">
              <button
                onClick={() => setShowAnswer(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-blue-500/20 transform hover:-translate-y-0.5"
              >
                <Eye className="w-4 h-4" />
                <span>Show Answer</span>
              </button>
            </div>
          ) : (
            /* Card Back (Revealed Answer) */
            <div className="pt-6 border-t border-slate-100 w-full space-y-3 animate-fade-in">
              <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Vietnamese Meaning
                </p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {currentVocab.meaning}
                </p>
              </div>

              {currentVocab.example && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-left">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Example Sentence
                  </p>
                  <p className="text-xs text-slate-800 italic mt-1 leading-relaxed">
                    &quot;{currentVocab.example}&quot;
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Spaced Repetition Rating Actions */}
        {showAnswer && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-4 gap-2">
            <button
              onClick={() => handleRating('forgot')}
              className="p-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-xs flex flex-col items-center transition-all shadow-sm active:scale-95"
            >
              <span>Forgot</span>
              <span className="text-[10px] font-normal text-rose-100 mt-0.5">Today</span>
            </button>

            <button
              onClick={() => handleRating('hard')}
              className="p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs flex flex-col items-center transition-all shadow-sm active:scale-95"
            >
              <span>Hard</span>
              <span className="text-[10px] font-normal text-amber-100 mt-0.5">1 Day</span>
            </button>

            <button
              onClick={() => handleRating('good')}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex flex-col items-center transition-all shadow-sm active:scale-95"
            >
              <span>Good</span>
              <span className="text-[10px] font-normal text-blue-100 mt-0.5">3 Days</span>
            </button>

            <button
              onClick={() => handleRating('easy')}
              className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex flex-col items-center transition-all shadow-sm active:scale-95"
            >
              <span>Easy</span>
              <span className="text-[10px] font-normal text-emerald-100 mt-0.5">7 Days</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
