'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { ScopeSelector } from '@/components/study/ScopeSelector';
import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { StorageService } from '@/lib/storage';
import { Folder, Vocabulary } from '@/types';
import { Rating } from '@/lib/spacedRepetition';
import { shuffle } from '@/lib/shuffle';

export default function StudyPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [sessionQueue, setSessionQueue] = useState<Vocabulary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void Promise.all([StorageService.getFolders(), StorageService.getVocabularies()])
      .then(([nextFolders, words]) => {
        setFolders(nextFolders);
        setVocabularies(words);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load study data.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleStartStudy = (selectedFolderIds: string[] | null, includeNotDue: boolean) => {
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

    if (!includeNotDue) {
      const now = Date.now();
      queue = queue.filter((v) => new Date(v.nextReviewAt).getTime() <= now);
      if (queue.length === 0) {
        alert('There are no cards due in this scope. Choose Practice ahead to review other words.');
        return;
      }
      queue.sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime());
      setSessionQueue(queue);
      return;
    }

    setSessionQueue(shuffle(queue));
  };

  const handleRecordRating = async (vocabId: string, rating: Rating) => {
    await StorageService.recordReview(vocabId, rating);
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
            isLoading={isLoading}
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
