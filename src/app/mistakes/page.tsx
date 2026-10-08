'use client';

import React, { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { MistakeReview } from '@/components/mistakes/MistakeReview';
import { StorageService } from '@/lib/storage';
import { MistakeLog } from '@/types';

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);

  const loadMistakes = () => {
    setMistakes(StorageService.getMistakeLogs());
  };

  useEffect(() => {
    loadMistakes();
  }, []);

  return (
    <Shell>
      <div className="space-y-6">
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
