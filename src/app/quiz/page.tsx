'use client';

import React, { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { QuizConfig } from '@/components/quiz/QuizConfig';
import { QuizSession, QuizQuestion } from '@/components/quiz/QuizSession';
import { QuizSummary } from '@/components/quiz/QuizSummary';
import { StorageService } from '@/lib/storage';
import { Folder, Vocabulary } from '@/types';

export default function QuizPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'config' | 'session' | 'summary'>('config');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<
    Array<{ question: QuizQuestion; selectedAnswer: string; isCorrect: boolean }>
  >([]);

  useEffect(() => {
    void Promise.all([StorageService.getFolders(), StorageService.getVocabularies()])
      .then(([nextFolders, words]) => {
        setFolders(nextFolders);
        setVocabularies(words);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load quiz data.'));
  }, []);

  const handleStartQuiz = (
    selectedFolderIds: string[] | null,
    questionCount: number,
    mode: 'mixed' | 'mcq' | 'reverse'
  ) => {
    setSelectedFolderIds(selectedFolderIds || []);
    let pool = [...vocabularies];
    if (selectedFolderIds && selectedFolderIds.length > 0) {
      const folderSet = new Set(selectedFolderIds);
      pool = pool.filter((v) => v.folderId && folderSet.has(v.folderId));
    }

    if (pool.length < 4) {
      alert('You need at least 4 vocabulary words in the selected scope to generate a quiz with multiple choice options.');
      return;
    }

    // Pick target words randomly
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const targetVocabs = shuffledPool.slice(0, Math.min(questionCount, pool.length));

    const generatedQuestions: QuizQuestion[] = targetVocabs.map((vocab, index) => {
      let qType: 'mcq' | 'reverse' = 'mcq';
      if (mode === 'reverse') qType = 'reverse';
      else if (mode === 'mixed') qType = index % 2 === 0 ? 'mcq' : 'reverse';

      // Pick 3 distractors
      const distractors = pool
        .filter((v) => v.id !== vocab.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      if (qType === 'mcq') {
        const options = [vocab.meaning, ...distractors.map((d) => d.meaning)].sort(
          () => Math.random() - 0.5
        );
        return {
          id: `q-${index}`,
          type: 'mcq',
          prompt: vocab.word,
          subPrompt: vocab.phonetic,
          correctAnswer: vocab.meaning,
          options,
          vocab,
        };
      } else {
        const options = [vocab.word, ...distractors.map((d) => d.word)].sort(
          () => Math.random() - 0.5
        );
        return {
          id: `q-${index}`,
          type: 'reverse',
          prompt: vocab.meaning,
          correctAnswer: vocab.word,
          options,
          vocab,
        };
      }
    });

    setQuestions(generatedQuestions);
    setStep('session');
  };

  const handleCompleteQuiz = async (
    answers: Array<{ question: QuizQuestion; selectedAnswer: string; isCorrect: boolean }>
  ): Promise<void> => {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const wrongCount = answers.length - correctCount;
    const scorePercent = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

    const mistakes = answers.filter((ans) => !ans.isCorrect).map((ans) => ({
      vocabularyId: ans.question.vocab.id,
      word: ans.question.vocab.word,
      meaning: ans.question.vocab.meaning,
      userAnswer: ans.selectedAnswer,
      correctAnswer: ans.question.correctAnswer,
    }));

    await StorageService.saveQuizResult({
      scorePercent,
      totalQuestions: answers.length,
      correctCount,
      wrongCount,
      folderIds: selectedFolderIds,
    }, mistakes);
    setUserAnswers(answers);
    setStep('summary');
  };

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            IELTS Vocabulary Quiz
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate your active recall memory with interactive Multiple Choice & Reverse Translation tests.
          </p>
        </div>

        {step === 'config' && (
          <QuizConfig
            folders={folders}
            vocabularies={vocabularies}
            onStartQuiz={handleStartQuiz}
          />
        )}

        {step === 'session' && (
          <QuizSession questions={questions} onComplete={handleCompleteQuiz} />
        )}

        {step === 'summary' && (
          <QuizSummary
            userAnswers={userAnswers}
            onRetakeQuiz={() => setStep('config')}
          />
        )}
      </div>
    </Shell>
  );
}
