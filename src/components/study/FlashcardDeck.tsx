'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, Eye, Award, Pause, Undo2, AlertTriangle, Check, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Vocabulary } from '@/types';
import { Rating, previewIntervals } from '@/lib/spacedRepetition';
import { StudySession } from '@/lib/storage';
import { CardMode, StudyMode, isCorrectAnswer, maskExample, pickCardMode } from '@/lib/cards';

type RatingCounts = StudySession['ratingCounts'];
type DeckItem = { vocab: Vocabulary; relearn: boolean };
type Accent = 'en-US' | 'en-GB';
type Snapshot = { items: DeckItem[]; index: number; stats: RatingCounts };
type Pending = { vocabId: string; rating: Rating; snapshot: Snapshot };

interface FlashcardDeckProps {
  vocabularies: Vocabulary[];
  session: StudySession;
  mode: StudyMode;
  lapseCounts: Map<string, number>;
  onRecordRating: (vocabId: string, rating: Rating) => Promise<StudySession>;
  onFinishSession: (destination: 'dashboard' | 'more') => Promise<void>;
  onPauseSession: () => void;
}

const UNDO_WINDOW_MS = 5000;
const RELEARN_GAP: Partial<Record<Rating, number>> = { forgot: 4, hard: 7 };
const LEECH_LAPSES = 3;
const ACCENT_KEY = 'vocabmaster.accent';

const RATING_STYLES: Record<Rating, { label: string; className: string; subClass: string }> = {
  forgot: { label: 'Forgot', className: 'bg-rose-500 hover:bg-rose-600', subClass: 'text-rose-100' },
  hard: { label: 'Hard', className: 'bg-amber-500 hover:bg-amber-600', subClass: 'text-amber-100' },
  good: { label: 'Good', className: 'bg-blue-600 hover:bg-blue-700', subClass: 'text-blue-100' },
  easy: { label: 'Easy', className: 'bg-emerald-600 hover:bg-emerald-700', subClass: 'text-emerald-100' },
};
const RATING_KEYS: Rating[] = ['forgot', 'hard', 'good', 'easy'];

const sumCounts = (counts: RatingCounts) => counts.forgot + counts.hard + counts.good + counts.easy;

export function FlashcardDeck({
  vocabularies,
  session,
  mode,
  lapseCounts,
  onRecordRating,
  onFinishSession,
  onPauseSession,
}: FlashcardDeckProps) {
  const [items, setItems] = useState<DeckItem[]>(() => vocabularies.map((vocab) => ({ vocab, relearn: false })));
  const [index, setIndex] = useState(session.currentIndex);
  const [stats, setStats] = useState<RatingCounts>(session.ratingCounts);
  const [showAnswer, setShowAnswer] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState<'correct' | 'wrong' | null>(null);
  const [undoable, setUndoable] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccent] = useState<Accent>('en-US');

  const pendingRef = useRef<Pending | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef<Snapshot | null>(null);
  const startedAtRef = useRef(Date.now());
  const onRecordRef = useRef(onRecordRating);
  onRecordRef.current = onRecordRating;

  const current = items[index];
  const isFinished = index >= items.length;

  useEffect(() => {
    const saved = window.localStorage.getItem(ACCENT_KEY);
    if (saved === 'en-US' || saved === 'en-GB') setAccent(saved);
  }, []);

  const handleSpeak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.replace('_', '-') === accent);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, [accent]);

  const toggleAccent = () => {
    const next: Accent = accent === 'en-US' ? 'en-GB' : 'en-US';
    setAccent(next);
    window.localStorage.setItem(ACCENT_KEY, next);
  };

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  /** Sends the held-back rating to the server. On failure the deck rewinds to that card. */
  const flushPending = useCallback(async (): Promise<boolean> => {
    clearTimer();
    const pending = pendingRef.current;
    if (!pending) return true;
    pendingRef.current = null;
    try {
      await onRecordRef.current(pending.vocabId, pending.rating);
      setUndoable((value) => (lastSnapshotRef.current === pending.snapshot ? false : value));
      return true;
    } catch (flushError) {
      setItems(pending.snapshot.items);
      setIndex(pending.snapshot.index);
      setStats(pending.snapshot.stats);
      setShowAnswer(false);
      setUndoable(false);
      setError(`${flushError instanceof Error ? flushError.message : 'Unable to save review.'} Your last card was restored — try rating it again.`);
      return false;
    }
  }, []);

  useEffect(() => () => {
    // Do not lose a rating that is still inside its undo window when leaving the page.
    if (timerRef.current) clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    if (pending) void onRecordRef.current(pending.vocabId, pending.rating).catch(() => undefined);
  }, []);

  const resetCardState = () => {
    setShowAnswer(false);
    setTyped('');
    setTypedResult(null);
  };

  const handleRating = async (rating: Rating) => {
    if (!current || isBusy) return;
    setIsBusy(true);
    setError(null);
    if (!(await flushPending())) {
      setIsBusy(false);
      return;
    }

    const snapshot: Snapshot = { items, index, stats };
    const nextItems = [...items];
    const gap = RELEARN_GAP[rating];
    if (gap !== undefined) {
      nextItems.splice(Math.min(nextItems.length, index + 1 + gap), 0, { vocab: current.vocab, relearn: true });
    }

    if (!current.relearn) {
      setStats({ ...stats, [rating]: stats[rating] + 1 });
      pendingRef.current = { vocabId: current.vocab.id, rating, snapshot };
      timerRef.current = setTimeout(() => void flushPending(), UNDO_WINDOW_MS);
    }
    lastSnapshotRef.current = snapshot;
    setUndoable(true);
    setItems(nextItems);
    setIndex(index + 1);
    resetCardState();
    setIsBusy(false);

    if (index + 1 >= nextItems.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    }
  };

  const handleUndo = () => {
    const snapshot = lastSnapshotRef.current;
    if (!snapshot || !undoable || isBusy) return;
    // Only possible while the rating is still held back (or was a local relearn rating).
    if (!pendingRef.current && !items[index - 1]?.relearn) return;
    clearTimer();
    pendingRef.current = null;
    lastSnapshotRef.current = null;
    setItems(snapshot.items);
    setIndex(snapshot.index);
    setStats(snapshot.stats);
    setUndoable(false);
    resetCardState();
  };

  const finishWith = async (destination: 'dashboard' | 'more') => {
    setIsFinishing(true);
    setError(null);
    if (!(await flushPending())) {
      setIsFinishing(false);
      return;
    }
    try {
      await onFinishSession(destination);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'Unable to close the saved study session.');
      setIsFinishing(false);
    }
  };

  const handlePause = async () => {
    setIsBusy(true);
    if (await flushPending()) onPauseSession();
    else setIsBusy(false);
  };

  const reveal = () => setShowAnswer(true);

  const submitTyped = (event: React.FormEvent) => {
    event.preventDefault();
    if (!current || showAnswer) return;
    setTypedResult(isCorrectAnswer(typed, current.vocab) ? 'correct' : 'wrong');
    reveal();
  };

  const latest = useRef({ handleRating, handleUndo, reveal, handleSpeak, showAnswer, current, isFinished });
  latest.current = { handleRating, handleUndo, reveal, handleSpeak, showAnswer, current, isFinished };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const state = latest.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        state.handleUndo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || state.isFinished) return;
      if (event.key === ' ' || event.key === 'Enter') {
        if (!state.showAnswer && target?.tagName !== 'BUTTON') {
          event.preventDefault();
          state.reveal();
        }
      } else if (['1', '2', '3', '4'].includes(event.key) && state.showAnswer) {
        void state.handleRating(RATING_KEYS[Number(event.key) - 1]);
      } else if (event.key.toLowerCase() === 'p' && state.current) {
        state.handleSpeak(state.current.vocab.word);
      } else if (event.key.toLowerCase() === 'u') {
        state.handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (isFinished || items.length === 0) {
    const total = sumCounts(stats);
    const accuracy = total > 0 ? Math.round(((stats.good + stats.easy) / total) * 100) : 0;
    const minutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-inner">
          <Award className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Study session complete!</h2>
          <p className="mt-1 text-sm text-slate-500">You reviewed {total} {total === 1 ? 'card' : 'cards'} · {accuracy}% recalled · about {minutes} min</p>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2">
          {RATING_KEYS.map((key) => (
            <div key={key} className={`rounded-2xl border p-3 ${key === 'forgot' ? 'border-rose-100 bg-rose-50' : key === 'hard' ? 'border-amber-100 bg-amber-50' : key === 'good' ? 'border-blue-100 bg-blue-50' : 'border-emerald-100 bg-emerald-50'}`}>
              <span className="block text-[10px] font-bold uppercase text-slate-600">{RATING_STYLES[key].label}</span>
              <span className="text-lg font-extrabold text-slate-900">{stats[key]}</span>
            </div>
          ))}
        </div>

        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {undoable && (
          <button type="button" onClick={handleUndo} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <Undo2 className="h-3.5 w-3.5" /> Undo last rating
          </button>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void finishWith('more')} disabled={isFinishing} className="rounded-2xl border border-slate-200 py-3.5 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60">
            Study more
          </button>
          <button type="button" onClick={() => void finishWith('dashboard')} disabled={isFinishing} className="rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60">
            {isFinishing ? 'Saving…' : 'Return to dashboard'}
          </button>
        </div>
      </div>
    );
  }

  const { vocab, relearn } = current;
  const cardMode: CardMode = pickCardMode(vocab, mode);
  const masked = cardMode === 'cloze' ? maskExample(vocab) : null;
  const lapses = lapseCounts.get(vocab.id) || 0;
  const intervals = previewIntervals(vocab);
  const remaining = items.slice(index);
  const remainingNew = remaining.filter((item) => !item.relearn && item.vocab.repetitions === 0).length;
  const remainingRelearn = remaining.filter((item) => item.relearn).length;
  const remainingReview = remaining.length - remainingNew - remainingRelearn;
  const progressPercent = Math.round((index / items.length) * 100);
  const suggested: Rating | null = typedResult === 'correct' ? 'good' : typedResult === 'wrong' ? 'forgot' : null;

  const subLabel = (rating: Rating) => {
    if (!relearn) return intervals[rating];
    return rating === 'forgot' || rating === 'hard' ? 'Again soon' : 'Done';
  };

  const wordBlock = (
    <div className="flex items-center justify-center gap-3">
      <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">{vocab.word}</h2>
      <button type="button" onClick={() => handleSpeak(vocab.word)} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Pronounce (P)" aria-label={`Pronounce ${vocab.word}`}>
        <Volume2 className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Card {index + 1} of {items.length}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggleAccent} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Switch pronunciation accent">
            {accent === 'en-US' ? 'US' : 'UK'}
          </button>
          <button type="button" onClick={() => void handlePause()} disabled={isBusy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50" title="Your progress is saved after every rating">
            <Pause className="h-3.5 w-3.5" /> Pause &amp; exit
          </button>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">New {remainingNew}</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Review {remainingReview}</span>
        {remainingRelearn > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Relearn {remainingRelearn}</span>}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-rose-500 hover:text-rose-800"><X className="h-4 w-4" /></button>
        </p>
      )}

      <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl">
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-6 text-center sm:p-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
              {vocab.wordType}{vocab.level ? ` • ${vocab.level}` : ''}
            </span>
            {relearn && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Relearn</span>}
            {lapses >= LEECH_LAPSES && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800" title="You have forgotten this word several times. Try making your own example sentence.">
                <AlertTriangle className="h-3 w-3" /> Tricky word · forgotten {lapses}×
              </span>
            )}
          </div>

          {/* Prompt side */}
          {cardMode === 'classic' && (
            <div className="space-y-2">
              {wordBlock}
              {vocab.phonetic && <p className="font-mono text-base text-slate-600">{vocab.phonetic}</p>}
            </div>
          )}
          {(cardMode === 'reverse' || cardMode === 'typing') && (
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{cardMode === 'typing' ? 'Type the English word for' : 'What is the English word for'}</p>
              <p className="text-2xl font-bold leading-snug text-slate-900">{vocab.meaning}</p>
            </div>
          )}
          {cardMode === 'cloze' && masked && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fill in the blank</p>
              <p className="text-lg italic leading-relaxed text-slate-900">“{masked}”</p>
              <p className="text-sm text-slate-600">Hint: {vocab.meaning}</p>
            </div>
          )}

          {cardMode === 'typing' && !showAnswer && (
            <form onSubmit={submitTyped} className="flex w-full max-w-sm gap-2">
              <input
                type="text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Type the English word"
                placeholder="Type your answer…"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-center text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
              <button type="submit" disabled={!typed.trim()} className="rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">Check</button>
            </form>
          )}

          {!showAnswer ? (
            <button type="button" onClick={reveal} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700">
              <Eye className="h-4 w-4" /> {cardMode === 'typing' ? 'I don’t know' : 'Show answer'} <kbd className="ml-1 rounded bg-white/20 px-1.5 text-[10px]">Space</kbd>
            </button>
          ) : (
            <div className="animate-fade-in w-full space-y-3 border-t border-slate-100 pt-5">
              {typedResult && (
                <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${typedResult === 'correct' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {typedResult === 'correct' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {typedResult === 'correct' ? 'Correct!' : `You typed “${typed}”`}
                </p>
              )}
              {cardMode !== 'classic' && (
                <div className="space-y-1">
                  {wordBlock}
                  {vocab.phonetic && <p className="font-mono text-base text-slate-600">{vocab.phonetic}</p>}
                </div>
              )}
              {cardMode === 'classic' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Vietnamese meaning</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{vocab.meaning}</p>
                </div>
              )}
              {vocab.example && (
                <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Example sentence</p>
                  <p className="mt-1 text-base italic leading-relaxed text-slate-800">“{vocab.example}”</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`grid grid-cols-4 gap-2 border-t border-slate-100 bg-slate-50 p-3 transition-opacity ${showAnswer ? 'opacity-100' : 'pointer-events-none opacity-40'}`}>
          {RATING_KEYS.map((rating, position) => (
            <button
              key={rating}
              type="button"
              onClick={() => void handleRating(rating)}
              disabled={!showAnswer || isBusy}
              className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl p-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed ${RATING_STYLES[rating].className} ${suggested === rating ? 'ring-4 ring-offset-2 ring-blue-300' : ''}`}
            >
              <span>{RATING_STYLES[rating].label} <kbd className="ml-0.5 rounded bg-black/15 px-1 text-[10px] font-normal">{position + 1}</kbd></span>
              <span className={`mt-0.5 text-[10px] font-normal ${RATING_STYLES[rating].subClass}`}>{subLabel(rating)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[28px] items-center justify-between text-xs text-slate-500">
        <span>Shortcuts: <kbd className="rounded bg-slate-100 px-1">Space</kbd> reveal · <kbd className="rounded bg-slate-100 px-1">1–4</kbd> rate · <kbd className="rounded bg-slate-100 px-1">P</kbd> pronounce</span>
        {undoable && (
          <button type="button" onClick={handleUndo} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Undo last rating (U)">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
        )}
      </div>
    </div>
  );
}
