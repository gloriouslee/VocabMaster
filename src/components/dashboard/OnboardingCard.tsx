'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, FileSpreadsheet, PenLine, Layers, Check } from 'lucide-react';
import { STARTER_PACK_SIZE } from '@/lib/starterPack';

interface OnboardingCardProps {
  /** Adds the starter words; resolves with how many were added. */
  onAddStarterPack: () => Promise<number>;
}

/** Shown to learners with an empty library so the dashboard is not a wall of zeros. */
export function OnboardingCard({ onAddStarterPack }: OnboardingCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    try {
      setAdded(await onAddStarterPack());
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add the starter words.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section aria-label="Get started" className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
      <h2 className="text-lg font-extrabold text-slate-900">Welcome to VocabMaster</h2>
      <p className="mt-1 max-w-xl text-sm text-slate-600">
        Your library is empty. Pick the quickest way to start; you will review a few cards a day and the app schedules everything else.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border border-blue-100 bg-white p-4">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Sparkles className="h-5 w-5" /></span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Start with {STARTER_PACK_SIZE} IELTS words</h3>
            <p className="mt-1 text-xs text-slate-500">Common academic words in 5 topics, each with a Vietnamese meaning and an example.</p>
          </div>
          {added !== null ? (
            <Link href="/study" className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
              <Check className="h-4 w-4" /> {added} words added. Start studying
            </Link>
          ) : (
            <button type="button" onClick={() => void handleAdd()} disabled={isAdding} className="mt-4 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {isAdding ? 'Adding…' : 'Add starter words'}
            </button>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-blue-100 bg-white p-4">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><FileSpreadsheet className="h-5 w-5" /></span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Import your own list</h3>
            <p className="mt-1 text-xs text-slate-500">Bring words from an Excel or CSV file you already have.</p>
          </div>
          <Link href="/import" className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">Import a file</Link>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-blue-100 bg-white p-4">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><PenLine className="h-5 w-5" /></span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Add words as you meet them</h3>
            <p className="mt-1 text-xs text-slate-500">Found a new word while reading? Save it with its meaning and example.</p>
          </div>
          <Link href="/library" className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">Open the library</Link>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Layers className="h-3.5 w-3.5" /> Tip: set your exam date and daily goal in Settings so the app can plan your days.</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
