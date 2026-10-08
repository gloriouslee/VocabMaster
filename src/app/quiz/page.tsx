'use client';

import React, { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { QuizConfig, QuizOptions, QuizPrefs } from '@/components/quiz/QuizConfig';
import { QuizSession } from '@/components/quiz/QuizSession';
import { QuizSummary } from '@/components/quiz/QuizSummary';
import { StorageService } from '@/lib/storage';
import { Folder, MistakeLog, QuizResult, Vocabulary } from '@/types';
import {
  QuizAnswer,
  QuizFormat,
  QuizQuestion,
  QuizSource,
  WeaknessInfo,
  buildQuiz,
  dedupeWords,
  minimumWords,
} from '@/lib/quizBuilder';
import { shuffle } from '@/lib/shuffle';
import { persistSetting } from '@/lib/settings';

const SESSION_KEY = 'vocabmaster.quizSession';
const PREFS_KEY = 'vocabmaster.quizPrefs';
const DEFAULT_PREFS: QuizPrefs = { count: 10, source: 'random', format: 'mixed' };
const SOURCES: QuizSource[] = ['random', 'weak', 'due', 'mastered'];
const FORMATS: QuizFormat[] = ['mixed', 'mcq', 'reverse', 'cloze', 'typing', 'listening'];

interface QuizSnapshot {
  questions: QuizQuestion[];
  answers: Array<{ questionId: string; selectedAnswer: string; isCorrect: boolean }>;
  folderIds: string[];
  startedAt: number;
}

const toSnapshotAnswers = (answers: QuizAnswer[]) =>
  answers.map((answer) => ({ questionId: answer.question.id, selectedAnswer: answer.selectedAnswer, isCorrect: answer.isCorrect }));

function readSnapshot(words: Vocabulary[]): QuizSnapshot | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null') as QuizSnapshot | null;
    if (!saved || !Array.isArray(saved.questions) || !Array.isArray(saved.answers)) return null;
    // Drop questions about words that were deleted since the quiz was saved.
    const existing = new Set(words.map((word) => word.id));
    const questions = saved.questions.filter((question) => existing.has(question.vocab.id));
    const keptIds = new Set(questions.map((question) => question.id));
    const answers = saved.answers.filter((answer) => keptIds.has(answer.questionId));
    if (questions.length === 0 || answers.length >= questions.length) return null;
    return { ...saved, questions, answers };
  } catch {
    return null;
  }
}

export default function QuizPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [history, setHistory] = useState<QuizResult[]>([]);
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prefs, setPrefs] = useState<QuizPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);

  const [step, setStep] = useState<'config' | 'session' | 'summary'>('config');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [initialAnswers, setInitialAnswers] = useState<QuizAnswer[]>([]);
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [isPractice, setIsPractice] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [snapshot, setSnapshot] = useState<QuizSnapshot | null>(null);

  const [finalAnswers, setFinalAnswers] = useState<QuizAnswer[]>([]);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
      if (saved && SOURCES.includes(saved.source) && FORMATS.includes(saved.format) && typeof saved.count === 'number') {
        setPrefs({ count: saved.count, source: saved.source, format: saved.format });
      }
    } catch {
      // Keep defaults when saved preferences cannot be read.
    }
    setPrefsReady(true);

    void Promise.all([
      StorageService.getFolders(),
      StorageService.getVocabularies(),
      StorageService.getQuizResults().catch(() => [] as QuizResult[]),
      StorageService.getMistakeLogs().catch(() => [] as MistakeLog[]),
    ])
      .then(([nextFolders, words, results, mistakeLogs]) => {
        setFolders(nextFolders);
        setVocabularies(words);
        setHistory(results);
        setMistakes(mistakeLogs);
        setSnapshot(readSnapshot(words));
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load quiz data.'))
      .finally(() => setIsLoading(false));
  }, []);

  const persistSnapshot = (next: QuizSnapshot | null) => {
    setSnapshot(next);
    if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SESSION_KEY);
  };

  const beginSession = (nextQuestions: QuizQuestion[], answers: QuizAnswer[], practice: boolean, ids: string[], started: number) => {
    setQuestions(nextQuestions);
    setInitialAnswers(answers);
    setIsPractice(practice);
    setFolderIds(ids);
    setStartedAt(started);
    setStep('session');
  };

  const handleStartQuiz = async (options: QuizOptions) => {
    setMessage(null);
    persistSetting('vocabmaster.quizPrefs', JSON.stringify({ count: options.count, source: options.source, format: options.format }));
    setPrefs({ count: options.count, source: options.source, format: options.format });

    const scopeSet = options.scopeFolderIds ? new Set(options.scopeFolderIds) : null;
    const scope = dedupeWords(vocabularies.filter((word) => !scopeSet || (word.folderId !== null && scopeSet.has(word.folderId))));
    if (scope.length < minimumWords(options.format)) {
      setMessage('You need at least 4 unique words in the selected scope for multiple-choice questions.');
      return;
    }

    const info: WeaknessInfo = { lapses: new Map(), mistakes: new Map() };
    if (options.source === 'weak') {
      for (const log of mistakes) {
        if (!log.resolved && log.vocabularyId) info.mistakes.set(log.vocabularyId, (info.mistakes.get(log.vocabularyId) || 0) + 1);
      }
      info.lapses = await StorageService.getLapseCounts(scope.map((word) => word.id)).catch(() => new Map<string, number>());
    }

    const generated = buildQuiz(scope, { count: options.count, source: options.source, format: options.format }, info);
    if (generated.length === 0) {
      setMessage(
        options.source === 'weak'
          ? 'No weak words found in this scope. Great job! Try random words or check mastered words.'
          : 'No words match this quiz setup. Try another word source.',
      );
      return;
    }

    const started = Date.now();
    persistSnapshot({ questions: generated, answers: [], folderIds: options.folderIds, startedAt: started });
    beginSession(generated, [], false, options.folderIds, started);
  };

  const handleResume = () => {
    if (!snapshot) return;
    const byId = new Map(snapshot.questions.map((question) => [question.id, question]));
    const answers = snapshot.answers.flatMap((answer) => {
      const question = byId.get(answer.questionId);
      return question ? [{ question, selectedAnswer: answer.selectedAnswer, isCorrect: answer.isCorrect }] : [];
    });
    beginSession(snapshot.questions, answers, false, snapshot.folderIds, snapshot.startedAt);
  };

  const handleProgress = (answers: QuizAnswer[]) => {
    if (isPractice) return;
    persistSnapshot({ questions, answers: toSnapshotAnswers(answers), folderIds, startedAt });
  };

  const handleExit = () => {
    setStep('config');
  };

  const handleCompleteQuiz = async (answers: QuizAnswer[]): Promise<void> => {
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const wrong = answers.filter((answer) => !answer.isCorrect);
    setElapsedMs(Date.now() - startedAt);
    setPreviousScore(history[0]?.scorePercent ?? null);

    if (!isPractice) {
      const result = await StorageService.saveQuizResult({
        scorePercent: answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0,
        totalQuestions: answers.length,
        correctCount,
        wrongCount: wrong.length,
        folderIds,
      }, wrong.map((answer) => ({
        vocabularyId: answer.question.vocab.id,
        word: answer.question.vocab.word,
        meaning: answer.question.vocab.meaning,
        userAnswer: answer.selectedAnswer,
        correctAnswer: answer.question.correctAnswer,
      })));
      persistSnapshot(null);
      setHistory((current) => [result, ...current]);

      // Answering a previously missed word correctly clears its open mistakes.
      const correctIds = new Set(answers.filter((answer) => answer.isCorrect).map((answer) => answer.question.vocab.id));
      const toResolve = mistakes.filter((log) => !log.resolved && log.vocabularyId && correctIds.has(log.vocabularyId));
      if (toResolve.length > 0) {
        void Promise.all(toResolve.map((log) => StorageService.resolveMistakeLog(log.id)))
          .then(() => StorageService.getMistakeLogs())
          .then(setMistakes)
          .catch(() => undefined);
      }

      // Rescheduling is best effort: the quiz result is already saved.
      const uniqueMissed = [...new Map(wrong.map((answer) => [answer.question.vocab.id, answer.question.vocab])).values()];
      try {
        const rescheduled = await StorageService.applyQuizLapses(uniqueMissed);
        setScheduleNote(rescheduled > 0
          ? `${rescheduled} missed ${rescheduled === 1 ? 'word is' : 'words are'} due for review today in your flashcards.`
          : null);
        if (rescheduled > 0) setVocabularies(await StorageService.getVocabularies());
      } catch {
        setScheduleNote('Your result was saved, but missed words could not be rescheduled for review.');
      }
    } else {
      setScheduleNote(null);
    }

    setFinalAnswers(answers);
    setStep('summary');
  };

  const handleRetryWrong = () => {
    const missed = finalAnswers.filter((answer) => !answer.isCorrect).map((answer, index) => ({
      ...answer.question,
      id: `retry-${index}`,
      options: shuffle(answer.question.options),
    }));
    beginSession(missed, [], true, folderIds, Date.now());
  };

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">IELTS Vocabulary Quiz</h1>
          <p className="text-xs text-slate-500 mt-1">
            Check your active recall with choice, listening, fill-in-the-blank and typing questions.
          </p>
        </div>

        {step === 'config' && (
          <QuizConfig
            key={String(prefsReady)}
            folders={folders}
            vocabularies={vocabularies}
            isLoading={isLoading}
            message={message}
            history={history}
            resume={snapshot ? { answered: snapshot.answers.length, total: snapshot.questions.length } : null}
            initialPrefs={prefs}
            onResume={handleResume}
            onDiscardResume={() => persistSnapshot(null)}
            onStartQuiz={(options) => void handleStartQuiz(options)}
          />
        )}

        {step === 'session' && (
          <QuizSession
            key={`${isPractice}-${startedAt}`}
            questions={questions}
            initialAnswers={initialAnswers}
            onProgress={handleProgress}
            onComplete={handleCompleteQuiz}
            onExit={handleExit}
          />
        )}

        {step === 'summary' && (
          <QuizSummary
            userAnswers={finalAnswers}
            folders={folders}
            previousScore={previousScore}
            elapsedMs={elapsedMs}
            isPractice={isPractice}
            scheduleNote={scheduleNote}
            onRetakeQuiz={() => setStep('config')}
            onRetryWrong={handleRetryWrong}
          />
        )}
      </div>
    </Shell>
  );
}
