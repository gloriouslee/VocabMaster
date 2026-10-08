export type VocabStatus = 'new' | 'learning' | 'mastered';

export type WordType = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'idiom' | 'other';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Vocabulary {
  id: string;
  folderId: string | null;
  word: string;
  meaning: string; // Vietnamese meaning
  wordType: WordType;
  phonetic?: string;
  level?: string; // e.g. B2, C1, Band 6.5, Band 7.5
  example?: string;
  status: VocabStatus;
  nextReviewAt: string; // ISO date string
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  createdAt: string;
  lastReviewedAt?: string;
}

export interface ReviewLog {
  id: string;
  vocabularyId: string;
  rating: 'forgot' | 'hard' | 'good' | 'easy';
  reviewedAt: string;
}

export interface QuizResult {
  id: string;
  createdAt: string;
  scorePercent: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  folderIds?: string[];
}

export interface MistakeLog {
  id: string;
  vocabularyId: string;
  word: string;
  meaning: string;
  userAnswer: string;
  correctAnswer: string;
  createdAt: string;
  resolved: boolean;
}

export interface UserStats {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  wordsStudiedToday: number;
  reviewsCompletedToday: number;
}

export interface RawImportRecord {
  id: string;
  word: string;
  meaning: string;
  wordType: string;
  phonetic?: string;
  level?: string;
  example?: string;
  folderName?: string;
  status: 'valid' | 'duplicate' | 'invalid';
  validationErrors: string[];
}
