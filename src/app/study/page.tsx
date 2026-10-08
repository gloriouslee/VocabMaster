'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { ScopeSelector } from '@/components/study/ScopeSelector';
import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { StorageService } from '@/lib/storage';
import { Folder, Vocabulary } from '@/types';
import { Rating } from '@/lib/spacedRepetition';

export default function StudyPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [sessionQueue, setSessionQueue] = useState<Vocabulary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([StorageService.getFolders(), StorageService.getVocabularies()])
      .then(([nextFolders, words]) => {
        setFolders(nextFolders);
        setVocabularies(words);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load study data.'));
  }, []);

  const handleStartStudy = (selectedFolderIds: string[] | null) => {
    let queue: Vocabulary[] = [];

    if (!selectedFolderIds) {
      queue = [...vocabularies];
    } else {
      const folderSet = new Set(selectedFolderIds);
      queue = vocabularies.filter((v) => v.folderId && folderSet.has(v.folderId));
    }

    if (queue.length === 0) {
      alert('No vocabulary words found in the selected scope.');
      return;
    }

    // Shuffle queue for active recall practice
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setSessionQueue(shuffled);
  };

  const handleRecordRating = (vocabId: string, rating: Rating) => {
    void StorageService.recordReview(vocabId, rating)
      .catch((error) => alert(error instanceof Error ? error.message : 'Unable to save review.'));
  };

  const handleFinishSession = () => {
    router.push('/');
  };

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Flashcard Spaced Repetition Study
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active recall practice for IELTS retention. Ratings schedule next review automatically.
          </p>
        </div>

        {!sessionQueue ? (
          <ScopeSelector
            folders={folders}
            vocabularies={vocabularies}
            onStartStudy={handleStartStudy}
          />
        ) : (
          <FlashcardDeck
            vocabularies={sessionQueue}
            onRecordRating={handleRecordRating}
            onFinishSession={handleFinishSession}
          />
        )}
      </div>
    </Shell>
  );
}
