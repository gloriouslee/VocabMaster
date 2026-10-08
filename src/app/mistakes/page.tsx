'use client';

import React, { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { MistakeReview } from '@/components/mistakes/MistakeReview';
import { StorageService } from '@/lib/storage';
import { MistakeLog } from '@/types';

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMistakes = async () => {
    setMistakes(await StorageService.getMistakeLogs());
  };

  useEffect(() => {
    void loadMistakes().catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load mistakes.'));
  }, []);

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Mistake Review & Mastery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Focus on words you previously answered incorrectly until fully mastered.
          </p>
        </div>

        <MistakeReview mistakes={mistakes} onRefresh={loadMistakes} />
      </div>
    </Shell>
  );
}
