import { Folder, Vocabulary, QuizResult, MistakeLog, UserStats, VocabStatus, WordType } from '@/types';
import { INITIAL_FOLDERS, INITIAL_VOCABULARIES } from './seedData';
import { calculateNextReview, Rating } from './spacedRepetition';

const FOLDERS_KEY = 'vocabmaster_folders';
const VOCAB_KEY = 'vocabmaster_vocabularies';
const QUIZ_KEY = 'vocabmaster_quiz_results';
const MISTAKES_KEY = 'vocabmaster_mistakes';
const STATS_KEY = 'vocabmaster_user_stats';

function isClient(): boolean {
  return typeof window !== 'undefined';
}

export const StorageService = {
  // --- FOLDERS ---
  getFolders(): Folder[] {
    if (!isClient()) return INITIAL_FOLDERS;
    const data = localStorage.getItem(FOLDERS_KEY);
    if (!data) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(INITIAL_FOLDERS));
      return INITIAL_FOLDERS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_FOLDERS;
    }
  },

  saveFolder(folder: Omit<Folder, 'id' | 'createdAt'>): Folder {
    const folders = this.getFolders();
    const newFolder: Folder = {
      ...folder,
      id: 'f-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
    };
    folders.push(newFolder);
    if (isClient()) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    }
    return newFolder;
  },

  renameFolder(id: string, newName: string): void {
    const folders = this.getFolders().map((f) =>
      f.id === id ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f
    );
    if (isClient()) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    }
  },

  deleteFolder(id: string): void {
    // Collect child folder IDs recursively
    const allFolders = this.getFolders();
    const idsToDelete = new Set<string>([id]);

    let changed = true;
    while (changed) {
      changed = false;
      for (const f of allFolders) {
        if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
          idsToDelete.add(f.id);
          changed = true;
        }
      }
    }

    const updatedFolders = allFolders.filter((f) => !idsToDelete.has(f.id));
    if (isClient()) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
    }

    // Also reassign or delete vocabularies attached to deleted folders
    const vocabs = this.getVocabularies().map((v) => {
      if (v.folderId && idsToDelete.has(v.folderId)) {
        return { ...v, folderId: null };
      }
      return v;
    });
    if (isClient()) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabs));
    }
  },

  // --- VOCABULARIES ---
  getVocabularies(): Vocabulary[] {
    if (!isClient()) return INITIAL_VOCABULARIES;
    const data = localStorage.getItem(VOCAB_KEY);
    if (!data) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(INITIAL_VOCABULARIES));
      return INITIAL_VOCABULARIES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_VOCABULARIES;
    }
  },

  addVocabulary(vocab: Omit<Vocabulary, 'id' | 'createdAt' | 'status' | 'nextReviewAt' | 'intervalDays' | 'repetitions' | 'easeFactor'> & Partial<Vocabulary>): Vocabulary {
    const vocabs = this.getVocabularies();
    const newVocab: Vocabulary = {
      id: 'v-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      word: vocab.word.trim(),
      meaning: vocab.meaning.trim(),
      wordType: (vocab.wordType || 'noun') as WordType,
      phonetic: vocab.phonetic?.trim() || '',
      level: vocab.level?.trim() || 'Band 6.5',
      example: vocab.example?.trim() || '',
      folderId: vocab.folderId || null,
      status: vocab.status || 'new',
      nextReviewAt: vocab.nextReviewAt || new Date().toISOString(),
      intervalDays: vocab.intervalDays || 0,
      repetitions: vocab.repetitions || 0,
      easeFactor: vocab.easeFactor || 2.5,
      createdAt: new Date().toISOString(),
    };
    vocabs.push(newVocab);
    if (isClient()) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabs));
    }
    return newVocab;
  },

  bulkAddVocabularies(items: Array<Omit<Vocabulary, 'id' | 'createdAt' | 'status' | 'nextReviewAt' | 'intervalDays' | 'repetitions' | 'easeFactor'> & Partial<Vocabulary>>): Vocabulary[] {
    const vocabs = this.getVocabularies();
    const added: Vocabulary[] = [];

    items.forEach((item) => {
      const v: Vocabulary = {
        id: 'v-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        word: item.word.trim(),
        meaning: item.meaning.trim(),
        wordType: (item.wordType || 'noun') as WordType,
        phonetic: item.phonetic?.trim() || '',
        level: item.level?.trim() || 'Band 7.0',
        example: item.example?.trim() || '',
        folderId: item.folderId || null,
        status: item.status || 'new',
        nextReviewAt: item.nextReviewAt || new Date().toISOString(),
        intervalDays: item.intervalDays || 0,
        repetitions: item.repetitions || 0,
        easeFactor: item.easeFactor || 2.5,
        createdAt: new Date().toISOString(),
      };
      vocabs.push(v);
      added.push(v);
    });

    if (isClient()) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabs));
    }
    return added;
  },

  updateVocabulary(id: string, updates: Partial<Vocabulary>): Vocabulary | null {
    let updatedVocab: Vocabulary | null = null;
    const vocabs = this.getVocabularies().map((v) => {
      if (v.id === id) {
        updatedVocab = { ...v, ...updates };
        return updatedVocab;
      }
      return v;
    });

    if (isClient()) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabs));
    }
    return updatedVocab;
  },

  deleteVocabulary(id: string): void {
    const vocabs = this.getVocabularies().filter((v) => v.id !== id);
    if (isClient()) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabs));
    }
  },

  recordReview(id: string, rating: Rating): Vocabulary | null {
    const vocabs = this.getVocabularies();
    const index = vocabs.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const vocab = vocabs[index];
    const sr = calculateNextReview(vocab, rating);

    const updated: Vocabulary = {
      ...vocab,
      status: sr.status,
      nextReviewAt: sr.nextReviewAt,
      intervalDays: sr.intervalDays,
      repetitions: sr.repetitions,
      lastReviewedAt: new Date().toISOString(),
    };

    vocabs[index] = updated;
    if (isClient()) {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabs));
    }

    this.recordStudyActivity(1);
    return updated;
  },

  // --- QUIZ RESULTS & MISTAKES ---
  getQuizResults(): QuizResult[] {
    if (!isClient()) return [];
    const data = localStorage.getItem(QUIZ_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveQuizResult(result: Omit<QuizResult, 'id' | 'createdAt'>): QuizResult {
    const results = this.getQuizResults();
    const newResult: QuizResult = {
      ...result,
      id: 'q-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    results.unshift(newResult);
    if (isClient()) {
      localStorage.setItem(QUIZ_KEY, JSON.stringify(results));
    }
    this.recordStudyActivity(result.totalQuestions);
    return newResult;
  },

  getMistakeLogs(): MistakeLog[] {
    if (!isClient()) return [];
    const data = localStorage.getItem(MISTAKES_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  addMistakeLog(log: Omit<MistakeLog, 'id' | 'createdAt' | 'resolved'>): MistakeLog {
    const mistakes = this.getMistakeLogs();
    const newLog: MistakeLog = {
      ...log,
      id: 'm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    mistakes.unshift(newLog);
    if (isClient()) {
      localStorage.setItem(MISTAKES_KEY, JSON.stringify(mistakes));
    }
    return newLog;
  },

  resolveMistakeLog(id: string): void {
    const mistakes = this.getMistakeLogs().map((m) =>
      m.id === id ? { ...m, resolved: true } : m
    );
    if (isClient()) {
      localStorage.setItem(MISTAKES_KEY, JSON.stringify(mistakes));
    }
  },

  // --- USER STATS & STREAK ---
  getUserStats(): UserStats {
    const defaultStats: UserStats = {
      currentStreak: 12,
      bestStreak: 35,
      lastActiveDate: new Date().toISOString().split('T')[0],
      wordsStudiedToday: 15,
      reviewsCompletedToday: 24,
    };
    if (!isClient()) return defaultStats;

    const data = localStorage.getItem(STATS_KEY);
    if (!data) {
      localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
      return defaultStats;
    }
    try {
      const parsed = JSON.parse(data);
      const todayStr = new Date().toISOString().split('T')[0];
      // Reset daily counts if day changed
      if (parsed.lastActiveDate !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = parsed.currentStreak || 0;
        if (parsed.lastActiveDate === yesterdayStr) {
          // Maintained streak
        } else {
          // Broken streak
          newStreak = 1;
        }

        const updated: UserStats = {
          ...parsed,
          currentStreak: newStreak,
          bestStreak: Math.max(parsed.bestStreak || 0, newStreak),
          lastActiveDate: todayStr,
          wordsStudiedToday: 0,
          reviewsCompletedToday: 0,
        };
        localStorage.setItem(STATS_KEY, JSON.stringify(updated));
        return updated;
      }
      return parsed;
    } catch {
      return defaultStats;
    }
  },

  recordStudyActivity(reviewsCount: number = 1): void {
    if (!isClient()) return;
    const stats = this.getUserStats();
    const todayStr = new Date().toISOString().split('T')[0];

    const updated: UserStats = {
      ...stats,
      lastActiveDate: todayStr,
      wordsStudiedToday: stats.wordsStudiedToday + reviewsCount,
      reviewsCompletedToday: stats.reviewsCompletedToday + reviewsCount,
    };

    localStorage.setItem(STATS_KEY, JSON.stringify(updated));
  },
};
