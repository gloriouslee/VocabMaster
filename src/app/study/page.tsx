'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { ScopeSelector, StudyOptions } from '@/components/study/ScopeSelector';
import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { StorageService } from '@/lib/storage';
import { Folder, Vocabulary } from '@/types';
import { Rating } from '@/lib/spacedRepetition';
import { buildStudyQueue } from '@/lib/studyQueue';
import { StudyMode } from '@/lib/cards';

const PREFS_KEY = 'vocabmaster.studyPrefs';
const STUDY_MODES: StudyMode[] = ['mixed', 'classic', 'reverse', 'cloze', 'typing'];

export default function StudyPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [sessionQueue, setSessionQueue] = useState<Vocabulary[] | null>(null);
  const [studySession, setStudySession] = useState<Awaited<ReturnType<typeof StorageService.getActiveStudySession>>>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lapseCounts, setLapseCounts] = useState<Map<string, number>>(new Map());
  const [prefs, setPrefs] = useState<{ mode: StudyMode; newLimit: number }>({ mode: 'mixed', newLimit: 20 });
  const [prefsReady, setPrefsReady] = useState(false);
  const [practiceAhead, setPracticeAhead] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
      if (saved && STUDY_MODES.includes(saved.mode) && typeof saved.newLimit === 'number') {
        setPrefs({ mode: saved.mode, newLimit: saved.newLimit });
      }
    } catch {
      // Ignore unreadable preferences and keep the defaults.
    }
    setPrefsReady(true);
  }, []);

  const loadLapseCounts = (ids: string[]) =>
    StorageService.getLapseCounts(ids).then(setLapseCounts).catch(() => setLapseCounts(new Map()));

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

        const resumedQueue = hasRemovedWords ? remainingWords : sessionWords as Vocabulary[];
        await loadLapseCounts(resumedQueue.map((word) => word.id));
        setStudySession(resumedSession);
        setSessionQueue(resumedQueue);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load study data.'))
      .finally(() => setIsLoading(false));
  }, []);

  const saveAndStart = (queue: Vocabulary[]) => {
    setIsStarting(true);
    void Promise.all([
      StorageService.startStudySession(queue.map((word) => word.id)),
      loadLapseCounts(queue.map((word) => word.id)),
    ])
      .then(([session]) => {
        setStudySession(session);
        setSessionQueue(queue);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to save study session.'))
      .finally(() => setIsStarting(false));
  };

  const handleStartStudy = (options: StudyOptions) => {
    setMessage(null);
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: options.mode, newLimit: options.newLimit }));
    setPrefs({ mode: options.mode, newLimit: options.newLimit });

    const folderSet = options.folderIds ? new Set(options.folderIds) : null;
    let pool = vocabularies.filter((word) => !folderSet || (word.folderId && folderSet.has(word.folderId)));
    if (pool.length === 0) {
      setMessage('No vocabulary words found in the selected topics.');
      return;
    }
    if (!options.includeNotDue) {
      const now = Date.now();
      pool = pool.filter((word) => word.status === 'new' || new Date(word.nextReviewAt).getTime() <= now);
      if (pool.length === 0) {
        setMessage('Nothing is due in this scope. Turn on practice ahead to review other words.');
        return;
      }
    }
    saveAndStart(buildStudyQueue(pool, options.newLimit));
  };

  const handleRecordRating = async (vocabId: string, rating: Rating) => {
    if (!studySession) throw new Error('Your saved study session is unavailable. Please reload the page.');
    const updatedSession = await StorageService.recordStudySessionReview(studySession.id, vocabId, rating);
    setStudySession(updatedSession);
    return updatedSession;
  };

  const handleFinishSession = async (destination: 'dashboard' | 'more') => {
    if (studySession) await StorageService.deleteStudySession(studySession.id);
    setStudySession(null);
    setSessionQueue(null);
    if (destination === 'dashboard') {
      router.push('/');
      return;
    }
    // Reload so statuses and due dates reflect the session that just finished.
    setVocabularies(await StorageService.getVocabularies());
    setPracticeAhead(true);
    setMessage(null);
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
            key={`${prefsReady}-${practiceAhead}`}
            folders={folders}
            vocabularies={vocabularies}
            isLoading={isLoading || isStarting}
            message={message}
            initialMode={prefs.mode}
            initialNewLimit={prefs.newLimit}
            initialPracticeAhead={practiceAhead}
            onStartStudy={handleStartStudy}
          />
        ) : (
          <FlashcardDeck
            vocabularies={sessionQueue}
            session={studySession}
            mode={prefs.mode}
            lapseCounts={lapseCounts}
            onRecordRating={handleRecordRating}
            onFinishSession={handleFinishSession}
            onPauseSession={handlePauseSession}
          />
        )}
      </div>
    </Shell>
  );
}
