'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Vocabulary } from '@/types';

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'reverse';
  prompt: string;
  subPrompt?: string;
  correctAnswer: string;
  options: string[];
  vocab: Vocabulary;
}

interface QuizSessionProps {
  questions: QuizQuestion[];
  onComplete: (userAnswers: Array<{ question: QuizQuestion; selectedAnswer: string; isCorrect: boolean }>) => Promise<void>;
}

export function QuizSession({ questions, onComplete }: QuizSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Array<{ question: QuizQuestion; selectedAnswer: string; isCorrect: boolean }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (opt: string) => {
    if (isSubmitted) return;
    setSelectedOption(opt);
  };

  const handleConfirmAnswer = () => {
    if (!selectedOption || !currentQ) return;

    const isCorrect = selectedOption === currentQ.correctAnswer;
    setIsSubmitted(true);

    const record = {
      question: currentQ,
      selectedAnswer: selectedOption,
      isCorrect,
    };

    setAnswers((prev) => [...prev, record]);
  };

  const handleNextQuestion = async () => {
    if (currentIndex + 1 >= questions.length) {
      setIsSaving(true);
      try {
        await onComplete([...answers]);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to save quiz results.');
      } finally {
        setIsSaving(false);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!currentQ) return null;

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Quiz Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
          {currentQ.type === 'mcq' ? 'Multiple Choice' : 'Reverse Translation'}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-6">
        {/* Prompt */}
        <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {currentQ.type === 'mcq' ? 'What is the Vietnamese meaning of:' : 'What is the English word for:'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-extrabold text-slate-900">{currentQ.prompt}</h2>
            {currentQ.type === 'mcq' && (
              <button
                onClick={() => handleSpeak(currentQ.prompt)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-200/50"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            )}
          </div>
          {currentQ.subPrompt && (
            <p className="text-xs font-mono text-indigo-600 font-semibold">{currentQ.subPrompt}</p>
          )}
        </div>

        {/* 4 Options Grid */}
        <div className="grid grid-cols-1 gap-3">
          {currentQ.options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D
            const isSelected = selectedOption === opt;
            const isCorrectOpt = opt === currentQ.correctAnswer;

            let optionStyle = 'border-slate-200 hover:border-slate-300 bg-white text-slate-800';

            if (isSubmitted) {
              if (isCorrectOpt) {
                optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
              } else if (isSelected && !isCorrectOpt) {
                optionStyle = 'border-rose-500 bg-rose-50 text-rose-900 font-bold';
              }
            } else if (isSelected) {
              optionStyle = 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20';
            }

            return (
              <button
                key={opt}
                onClick={() => handleSelectOption(opt)}
                disabled={isSubmitted}
                className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between text-sm transition-all ${optionStyle}`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {letter}
                  </span>
                  <span>{opt}</span>
                </div>

                {isSubmitted && (
                  <div>
                    {isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    {isSelected && !isCorrectOpt && <XCircle className="w-5 h-5 text-rose-600" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          {!isSubmitted ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={!selectedOption}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs transition-colors shadow-md"
            >
              Submit Answer
            </button>
          ) : (
            <button
                onClick={handleNextQuestion}
                disabled={isSaving}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-colors shadow-md flex items-center justify-center space-x-2"
            >
              <span>{isSaving ? 'Saving…' : currentIndex + 1 < questions.length ? 'Next Question' : 'View Results'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
