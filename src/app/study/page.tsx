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
  const [studySession, setStudySession] = useState<Awaited<ReturnType<typeof StorageService.getActiveStudySession>>>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    void Promise.all([
      StorageService.getFolders(),
      StorageService.getVocabularies(),
      StorageService.getActiveStudySession(),
    ])
      .then(async ([nextFolders, words, savedSession]) => {
        setFolders(nextFolders);
        setVocabularies(words);
        if (!savedSession) return;

        const wordById = new Map(words.map((word) => [word.id, word]));
        const sessionWords = savedSession.vocabularyIds.map((id) => wordById.get(id));
        const remainingWords = sessionWords
          .slice(savedSession.currentIndex)
          .filter((word): word is Vocabulary => Boolean(word));

        if (remainingWords.length === 0) {
          await StorageService.deleteStudySession(savedSession.id);
          return;
        }

        const hasRemovedWords = sessionWords.some((word) => !word);
        const resumedSession = hasRemovedWords
          ? await StorageService.resumeStudySession(savedSession.id, remainingWords.map((word) => word.id))
          : savedSession;

        setStudySession(resumedSession);
        setSessionQueue(hasRemovedWords ? remainingWords : sessionWords as Vocabulary[]);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load study data.'))
      .finally(() => setIsLoading(false));
  }, []);

  const saveAndStart = (queue: Vocabulary[]) => {
    const nextQueue = shuffle(queue);
    setIsStarting(true);
    void StorageService.startStudySession(nextQueue.map((word) => word.id))
      .then((session) => {
        setStudySession(session);
        setSessionQueue(nextQueue);
      })
      .catch((error) => alert(error instanceof Error ? error.message : 'Unable to save study session.'))
      .finally(() => setIsStarting(false));
  };

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
      saveAndStart(queue);
      return;
    }

    saveAndStart(queue);
  };

  const handleRecordRating = async (vocabId: string, rating: Rating) => {
    if (!studySession) throw new Error('Your saved study session is unavailable. Please reload the page.');
    const updatedSession = await StorageService.recordStudySessionReview(studySession.id, vocabId, rating);
    setStudySession(updatedSession);
    return updatedSession;
  };

  const handleFinishSession = async () => {
    if (studySession) await StorageService.deleteStudySession(studySession.id);
    setStudySession(null);
    setSessionQueue(null);
    router.push('/');
  };

  const handlePauseSession = () => router.push('/');

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

        {!sessionQueue || !studySession ? (
          <ScopeSelector
            folders={folders}
            vocabularies={vocabularies}
            isLoading={isLoading || isStarting}
            onStartStudy={handleStartStudy}
          />
        ) : (
          <FlashcardDeck
            vocabularies={sessionQueue}
            session={studySession}
            onRecordRating={handleRecordRating}
            onFinishSession={handleFinishSession}
            onPauseSession={handlePauseSession}
          />
        )}
      </div>
    </Shell>
  );
}
