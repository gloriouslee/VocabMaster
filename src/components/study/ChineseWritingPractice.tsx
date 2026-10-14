'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, RotateCcw } from 'lucide-react';

interface ChineseWritingPracticeProps {
  word: string;
  onRevealAnswer: () => void;
}

const HAN_CHARACTER = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\ud840-\ud87f][\udc00-\udfff]/u;

export function ChineseWritingPractice({ word, onRevealAnswer }: ChineseWritingPracticeProps) {
  const characters = useMemo(() => Array.from(word).filter((character) => HAN_CHARACTER.test(character)), [word]);
  const targetRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<{ cancelQuiz: () => void } | null>(null);
  const [characterIndex, setCharacterIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (characterIndex >= characters.length) {
      setIsComplete(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let writer: { cancelQuiz: () => void } | null = null;
    setIsLoading(true);
    setHasLoadError(false);

    void import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (cancelled || !targetRef.current) return;
      targetRef.current.replaceChildren();
      const instance = HanziWriter.create(targetRef.current, characters[characterIndex], {
        width: 240,
        height: 240,
        padding: 12,
        showCharacter: false,
        showOutline: false,
        showHintAfterMisses: 2,
        acceptBackwardsStrokes: true,
        onLoadCharDataSuccess: () => { if (!cancelled) setIsLoading(false); },
        onLoadCharDataError: () => { if (!cancelled) { setIsLoading(false); setHasLoadError(true); } },
      });
      writer = instance;
      writerRef.current = instance;
      void instance.quiz({
        onMistake: () => setMistakes((count) => count + 1),
        onComplete: () => {
          if (!cancelled) setCharacterIndex((index) => index + 1);
        },
      }).catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoadError(true);
        }
      });
    }).catch(() => {
      if (!cancelled) {
        setIsLoading(false);
        setHasLoadError(true);
      }
    });

    return () => {
      cancelled = true;
      writer?.cancelQuiz();
      if (writerRef.current === writer) writerRef.current = null;
      targetRef.current?.replaceChildren();
    };
  }, [characterIndex, characters]);

  const reset = () => {
    writerRef.current?.cancelQuiz();
    setCharacterIndex(0);
    setMistakes(0);
    setIsComplete(false);
    setHasLoadError(false);
  };

  return (
    <section className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left" aria-label="Chinese handwriting practice">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-700">Write the character strokes</p>
          {characters.length > 1 && !isComplete && !hasLoadError && (
            <p className="mt-0.5 text-[11px] text-slate-500">Character {Math.min(characterIndex + 1, characters.length)} of {characters.length}</p>
          )}
        </div>
        <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white" aria-label="Restart writing practice">
          <RotateCcw className="h-3 w-3" /> Retry
        </button>
      </div>

      {isComplete ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center" role="status">
          <Check className="mx-auto h-6 w-6 text-emerald-600" />
          <p className="mt-1 text-sm font-bold text-emerald-800">All {characters.length} characters matched</p>
          <p className="mt-1 text-xs text-emerald-700">{mistakes === 0 ? 'Great writing!' : `You corrected ${mistakes} stroke${mistakes === 1 ? '' : 's'} along the way.`}</p>
          <button type="button" onClick={onRevealAnswer} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">Review answer</button>
        </div>
      ) : hasLoadError ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertCircle className="h-4 w-4 shrink-0" /> Stroke data could not load.</p>
          <p className="text-xs text-amber-800">You can still compare your writing yourself.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setHasLoadError(false); setCharacterIndex(0); }} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100">Try again</button>
            <button type="button" onClick={onRevealAnswer} className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800">Show answer</button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-60 w-60 max-w-full touch-none overflow-hidden rounded-xl border border-slate-200 bg-white" ref={targetRef} aria-label={`Write Chinese character ${characterIndex + 1} of ${characters.length}`} />
          {isLoading && <p className="flex items-center justify-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading stroke data…</p>}
          <p className="text-[11px] text-slate-500">Follow the correct stroke shape and direction. A hint appears after two misses. Stroke data loads online; your drawn strokes stay on this device.</p>
          <button type="button" onClick={onRevealAnswer} className="text-xs font-bold text-blue-700 hover:text-blue-900">Skip and show answer</button>
        </>
      )}
    </section>
  );
}
