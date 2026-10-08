'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, CheckCircle2, XCircle, ArrowRight, LogOut, AlertTriangle } from 'lucide-react';
import { QuizAnswer, QuizQuestion, TYPE_LABELS, isAnswerCorrect } from '@/lib/quizBuilder';

export type { QuizQuestion, QuizAnswer };

interface QuizSessionProps {
  questions: QuizQuestion[];
  initialAnswers?: QuizAnswer[];
  /** Called after every answer so the quiz can be resumed after a reload. */
  onProgress: (answers: QuizAnswer[]) => void;
  onComplete: (answers: QuizAnswer[]) => Promise<void>;
  onExit: () => void;
}

const ACCENT_KEY = 'vocabmaster.accent';

export function QuizSession({ questions, initialAnswers = [], onProgress, onComplete, onExit }: QuizSessionProps) {
  const [answers, setAnswers] = useState<QuizAnswer[]>(initialAnswers);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIndex = answers.length;
  const question = questions[currentIndex];
  const isAnswered = selected !== null;
  const isCorrect = isAnswered && question ? isAnswerCorrect(question, selected) : false;

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const accent = window.localStorage.getItem(ACCENT_KEY) === 'en-GB' ? 'en-GB' : 'en-US';
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.replace('_', '-') === accent);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Read listening questions aloud as soon as they appear.
  useEffect(() => {
    if (question?.type === 'listening' && question.audioText) speak(question.audioText);
  }, [question, speak]);

  const submitAnswer = (value: string) => {
    if (!question || isAnswered) return;
    setSelected(value);
    const record: QuizAnswer = { question, selectedAnswer: value, isCorrect: isAnswerCorrect(question, value) };
    const next = [...answers, record];
    // Hold the answer in `selected` until "Next"; progress is persisted right away.
    onProgress(next);
    pendingRef.current = next;
  };

  const pendingRef = useRef<QuizAnswer[] | null>(null);

  const handleNext = async () => {
    const next = pendingRef.current;
    if (!next) return;
    pendingRef.current = null;
    setError(null);
    if (next.length >= questions.length) {
      setIsSaving(true);
      try {
        await onComplete(next);
      } catch (saveError) {
        pendingRef.current = next;
        setError(saveError instanceof Error ? saveError.message : 'Unable to save quiz results.');
      } finally {
        setIsSaving(false);
      }
      return;
    }
    setAnswers(next);
    setSelected(null);
    setTyped('');
  };

  const latest = useRef({ submitAnswer, handleNext, question, isAnswered, speak });
  latest.current = { submitAnswer, handleNext, question, isAnswered, speak };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const state = latest.current;
      if (!state.question || event.ctrlKey || event.metaKey || event.altKey) return;
      if (state.isAnswered) {
        if (event.key === 'Enter' || event.key === ' ') {
          if (target?.tagName === 'BUTTON' && event.key === 'Enter') return;
          event.preventDefault();
          void state.handleNext();
        }
        return;
      }
      const index = ['1', '2', '3', '4'].indexOf(event.key) >= 0
        ? Number(event.key) - 1
        : ['a', 'b', 'c', 'd'].indexOf(event.key.toLowerCase());
      if (index >= 0 && state.question.options[index]) state.submitAnswer(state.question.options[index]);
      else if (event.key.toLowerCase() === 'p') state.speak(state.question.audioText || state.question.vocab.word);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!question) return null;

  const progressPercent = Math.round((currentIndex / questions.length) * 100);
  const isLast = currentIndex + 1 >= questions.length;
  const promptLabel: Record<QuizQuestion['type'], string> = {
    mcq: 'What is the Vietnamese meaning of:',
    reverse: 'What is the English word for:',
    cloze: 'Which word fits the blank?',
    typing: 'Type the English word for:',
    listening: 'Listening',
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Question {currentIndex + 1} of {questions.length}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{TYPE_LABELS[question.type]}</span>
          <button type="button" onClick={onExit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Your progress is saved">
            <LogOut className="h-3.5 w-3.5" /> Save &amp; exit
          </button>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void handleNext()} className="font-semibold underline">Retry</button>
        </p>
      )}

      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{promptLabel[question.type]}</p>
          {question.type === 'listening' ? (
            <button type="button" onClick={() => speak(question.audioText || '')} className="mx-auto flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" aria-label="Play the word again">
              <Volume2 className="h-5 w-5" /> Play again <kbd className="rounded bg-white/20 px-1.5 text-[10px]">P</kbd>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2 className={`font-extrabold text-slate-900 ${question.type === 'cloze' ? 'text-xl italic leading-relaxed' : 'text-3xl'}`}>
                {question.type === 'cloze' ? `“${question.prompt}”` : question.prompt}
              </h2>
              {question.type === 'mcq' && (
                <button type="button" onClick={() => speak(question.prompt)} aria-label={`Pronounce ${question.prompt}`} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/50 hover:text-indigo-600">
                  <Volume2 className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          {question.subPrompt && (
            <p className={question.type === 'cloze' ? 'text-sm text-slate-600' : 'font-mono text-sm font-semibold text-indigo-600'}>
              {question.type === 'cloze' ? `Hint: ${question.subPrompt}` : question.subPrompt}
            </p>
          )}
        </div>

        {question.type === 'typing' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (typed.trim()) submitAnswer(typed.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={isAnswered}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Type the English word"
              placeholder="Type your answer…"
              className={`min-w-0 flex-1 rounded-xl border-2 px-3 py-3 text-center text-base outline-none ${
                isAnswered ? (isCorrect ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50') : 'border-slate-300 focus:border-indigo-500'
              }`}
            />
            {!isAnswered && (
              <button type="submit" disabled={!typed.trim()} className="rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">Check</button>
            )}
          </form>
        ) : (
          <div role="radiogroup" aria-label="Answer options" className="grid grid-cols-1 gap-2.5">
            {question.options.map((option, index) => {
              const isChosen = selected === option;
              const isRight = option === question.correctAnswer;
              let style = 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40';
              if (isAnswered) {
                if (isRight) style = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                else if (isChosen) style = 'border-rose-500 bg-rose-50 text-rose-900 font-bold';
                else style = 'border-slate-200 bg-white text-slate-400';
              }
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isChosen}
                  onClick={() => submitAnswer(option)}
                  disabled={isAnswered}
                  className={`flex w-full items-center justify-between rounded-2xl border-2 p-3.5 text-left text-sm transition-all ${style}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">{String.fromCharCode(65 + index)}</span>
                    <span>{option}</span>
                  </span>
                  {isAnswered && isRight && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
                  {isAnswered && isChosen && !isRight && <XCircle className="h-5 w-5 shrink-0 text-rose-600" />}
                </button>
              );
            })}
          </div>
        )}

        <div aria-live="polite">
          {isAnswered && (
            <div className={`animate-fade-in space-y-2 rounded-2xl border p-4 text-sm ${isCorrect ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
              <p className={`flex items-center gap-1.5 font-bold ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {isCorrect ? 'Correct!' : question.type === 'typing' ? `Not quite — the answer is “${question.correctAnswer}”` : 'Not quite'}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-slate-800">
                <span className="text-base font-extrabold">{question.vocab.word}</span>
                {question.vocab.phonetic && <span className="font-mono text-xs text-slate-600">{question.vocab.phonetic}</span>}
                <button type="button" onClick={() => speak(question.vocab.word)} aria-label={`Pronounce ${question.vocab.word}`} className="rounded-full p-1 text-slate-500 hover:bg-white hover:text-indigo-600">
                  <Volume2 className="h-4 w-4" />
                </button>
                <span className="text-slate-600">· {question.vocab.meaning}</span>
              </div>
              {question.vocab.example && <p className="text-xs italic leading-relaxed text-slate-600">“{question.vocab.example}”</p>}
              {!isCorrect && question.vocab.status !== 'new' && (
                <p className="text-xs text-slate-500">This word will come back in your next review session.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="hidden text-xs text-slate-500 sm:block">
            {isAnswered ? <><kbd className="rounded bg-slate-100 px-1">Enter</kbd> next</> : question.type === 'typing' ? 'Type then press Enter' : <><kbd className="rounded bg-slate-100 px-1">1–4</kbd> or <kbd className="rounded bg-slate-100 px-1">A–D</kbd> to answer</>}
          </span>
          {isAnswered && (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={isSaving}
              className="ml-auto flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <span>{isSaving ? 'Saving…' : isLast ? 'View results' : 'Next question'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
