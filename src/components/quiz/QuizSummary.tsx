'use client';

import React, { useEffect } from 'react';
import { Award, CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { QuizQuestion } from './QuizSession';

interface QuizSummaryProps {
  userAnswers: Array<{ question: QuizQuestion; selectedAnswer: string; isCorrect: boolean }>;
  onRetakeQuiz: () => void;
}

export function QuizSummary({ userAnswers, onRetakeQuiz }: QuizSummaryProps) {
  const total = userAnswers.length;
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const wrongCount = total - correctCount;
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  useEffect(() => {
    if (scorePercent >= 70) {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [scorePercent]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Score Header Card */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner text-3xl font-extrabold ${
            scorePercent >= 80
              ? 'bg-emerald-100 text-emerald-600'
              : scorePercent >= 60
              ? 'bg-amber-100 text-amber-600'
              : 'bg-rose-100 text-rose-600'
          }`}
        >
          {scorePercent}%
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Quiz Completed!</h2>
          <p className="text-xs text-slate-500 mt-1">
            {scorePercent >= 80
              ? 'Outstanding performance! You have high IELTS vocabulary retention.'
              : scorePercent >= 60
              ? 'Good effort! Review the wrong answers below to improve.'
              : 'Keep practicing! Reviewing mistakes builds long-term recall.'}
          </p>
        </div>

        {/* Score Breakdown Cards */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="block text-[11px] font-bold text-slate-500 uppercase">Score</span>
            <span className="text-2xl font-extrabold text-slate-900">{scorePercent}%</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <span className="block text-[11px] font-bold text-emerald-700 uppercase">Correct</span>
            <span className="text-2xl font-extrabold text-emerald-900">{correctCount}</span>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
            <span className="block text-[11px] font-bold text-rose-700 uppercase">Wrong</span>
            <span className="text-2xl font-extrabold text-rose-900">{wrongCount}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={onRetakeQuiz}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition-colors"
          >
            Retake Quiz
          </button>
          {wrongCount > 0 && (
            <Link
              href="/mistakes"
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-sm"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Review {wrongCount} Mistakes</span>
            </Link>
          )}
        </div>
      </div>

      {/* Detailed Question Review */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
          Detailed Question Breakdown
        </h3>

        <div className="space-y-3">
          {userAnswers.map((ans, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border text-xs space-y-1 ${
                ans.isCorrect
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-rose-50/50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  #{idx + 1}. {ans.question.prompt} ({ans.question.vocab.word})
                </span>
                {ans.isCorrect ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Correct
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                    <XCircle className="w-4 h-4" /> Incorrect
                  </span>
                )}
              </div>

              <div className="text-slate-600 space-y-0.5 pt-1">
                <p>Your Answer: <strong className={ans.isCorrect ? 'text-emerald-800' : 'text-rose-800'}>{ans.selectedAnswer}</strong></p>
                {!ans.isCorrect && (
                  <p>Correct Answer: <strong className="text-emerald-800">{ans.question.correctAnswer}</strong></p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
