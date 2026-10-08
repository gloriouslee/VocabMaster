import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/database';
import { Folder, Vocabulary, QuizResult, MistakeLog, UserStats, WordType } from '@/types';
import { Rating } from './spacedRepetition';

type FolderRow = Tables<'folders'>;
type VocabularyRow = Tables<'vocabularies'>;
type QuizResultRow = Tables<'quiz_results'>;
type MistakeRow = Tables<'mistake_logs'>;
type StudySessionRow = Tables<'study_sessions'>;

export interface StudySession {
  id: string;
  vocabularyIds: string[];
  currentIndex: number;
  ratingCounts: { forgot: number; hard: number; good: number; easy: number };
}

function mapStudySession(row: StudySessionRow): StudySession {
  const counts = row.rating_counts && typeof row.rating_counts === 'object' && !Array.isArray(row.rating_counts)
    ? row.rating_counts as Record<string, unknown>
    : {};
  const count = (key: keyof StudySession['ratingCounts']) => {
    const value = counts[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };

  return {
    id: row.id,
    vocabularyIds: row.vocabulary_ids,
    currentIndex: row.current_index,
    ratingCounts: {
      forgot: count('forgot'),
      hard: count('hard'),
      good: count('good'),
      easy: count('easy'),
    },
  };
}

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the public URL and publishable key.');
  }
  return supabase;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in to access your study data.');
  return data.user.id;
}

function mapFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVocabulary(row: VocabularyRow): Vocabulary {
  return {
    id: row.id,
    folderId: row.folder_id,
    word: row.word,
    meaning: row.meaning,
    wordType: row.word_type as WordType,
    phonetic: row.phonetic,
    level: row.level,
    example: row.example,
    status: row.status,
    nextReviewAt: row.next_review_at,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    easeFactor: row.ease_factor,
    createdAt: row.created_at,
    lastReviewedAt: row.last_reviewed_at || undefined,
  };
}

function mapQuizResult(row: QuizResultRow, folderIds: string[] = []): QuizResult {
  return {
    id: row.id,
    createdAt: row.created_at,
    scorePercent: row.score_percent,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    folderIds,
  };
}

function mapMistake(row: MistakeRow): MistakeLog {
  return {
    id: row.id,
    vocabularyId: row.vocabulary_id,
    word: row.word,
    meaning: row.meaning,
    userAnswer: row.user_answer,
    correctAnswer: row.correct_answer,
    createdAt: row.created_at,
    resolved: row.resolved,
  };
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function previousDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function streaks(activeDates: Set<string>, today: string) {
  const sorted = [...activeDates].sort((a, b) => b.localeCompare(a));
  let currentStreak = 0;
  if (sorted[0] === today || sorted[0] === previousDay(today)) {
    let expected = sorted[0];
    for (const date of sorted) {
      if (date !== expected) break;
      currentStreak += 1;
      expected = previousDay(expected);
    }
  }

  let bestStreak = 0;
  let run = 0;
  let expected: string | undefined;
  for (const date of [...activeDates].sort()) {
    run = expected && date === expected ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    expected = next.toISOString().slice(0, 10);
  }
  return { currentStreak, bestStreak };
}

function mapVocabularyInput(
  vocab: Omit<Vocabulary, 'id' | 'createdAt' | 'status' | 'nextReviewAt' | 'intervalDays' | 'repetitions' | 'easeFactor'> & Partial<Vocabulary>,
  userId: string,
): TablesInsert<'vocabularies'> {
  return {
    user_id: userId,
    word: vocab.word.trim(),
    meaning: vocab.meaning.trim(),
    word_type: (vocab.wordType || 'noun') as Database['public']['Enums']['word_type'],
    phonetic: vocab.phonetic?.trim() || '',
    level: vocab.level?.trim() || 'Band 6.5',
    example: vocab.example?.trim() || '',
    folder_id: vocab.folderId || null,
    status: vocab.status || 'new',
    next_review_at: vocab.nextReviewAt || new Date().toISOString(),
    interval_days: vocab.intervalDays || 0,
    repetitions: vocab.repetitions || 0,
    ease_factor: vocab.easeFactor || 2.5,
    last_reviewed_at: vocab.lastReviewedAt || null,
  };
}

export const StorageService = {
  async getFolders(): Promise<Folder[]> {
    const userId = await currentUserId();
    const { data, error } = await client().from('folders').select('*').eq('user_id', userId).order('name');
    if (error) throw error;
    return data.map(mapFolder);
  },

  async saveFolder(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const userId = await currentUserId();
    const row: TablesInsert<'folders'> = {
      user_id: userId,
      name: folder.name.trim(),
      parent_id: folder.parentId,
    };
    const { data, error } = await client().from('folders').insert(row).select('*').single();
    if (error) throw error;
    return mapFolder(data);
  },

  async renameFolder(id: string, newName: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client().from('folders').update({ name: newName.trim() }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  async deleteFolder(id: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client().from('folders').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  async getVocabularies(): Promise<Vocabulary[]> {
    const userId = await currentUserId();
    const { data, error } = await client().from('vocabularies').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapVocabulary);
  },

  async addVocabulary(vocab: Omit<Vocabulary, 'id' | 'createdAt' | 'status' | 'nextReviewAt' | 'intervalDays' | 'repetitions' | 'easeFactor'> & Partial<Vocabulary>): Promise<Vocabulary> {
    const userId = await currentUserId();
    const { data, error } = await client().from('vocabularies').insert(mapVocabularyInput(vocab, userId)).select('*').single();
    if (error) throw error;
    return mapVocabulary(data);
  },

  async bulkAddVocabularies(items: Array<Omit<Vocabulary, 'id' | 'createdAt' | 'status' | 'nextReviewAt' | 'intervalDays' | 'repetitions' | 'easeFactor'> & Partial<Vocabulary>>): Promise<Vocabulary[]> {
    if (items.length === 0) return [];
    const userId = await currentUserId();
    const rows = items.map((item) => mapVocabularyInput(item, userId));
    const { data, error } = await client().from('vocabularies').insert(rows).select('*');
    if (error) throw error;
    return data.map(mapVocabulary);
  },

  async updateVocabulary(id: string, updates: Partial<Vocabulary>): Promise<Vocabulary | null> {
    const userId = await currentUserId();
    const row: TablesUpdate<'vocabularies'> = {};
    if (updates.folderId !== undefined) row.folder_id = updates.folderId;
    if (updates.word !== undefined) row.word = updates.word.trim();
    if (updates.meaning !== undefined) row.meaning = updates.meaning.trim();
    if (updates.wordType !== undefined) row.word_type = updates.wordType as Database['public']['Enums']['word_type'];
    if (updates.phonetic !== undefined) row.phonetic = updates.phonetic;
    if (updates.level !== undefined) row.level = updates.level;
    if (updates.example !== undefined) row.example = updates.example;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.nextReviewAt !== undefined) row.next_review_at = updates.nextReviewAt;
    if (updates.intervalDays !== undefined) row.interval_days = updates.intervalDays;
    if (updates.repetitions !== undefined) row.repetitions = updates.repetitions;
    if (updates.easeFactor !== undefined) row.ease_factor = updates.easeFactor;
    if (updates.lastReviewedAt !== undefined) row.last_reviewed_at = updates.lastReviewedAt;
    const { data, error } = await client().from('vocabularies').update(row).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    if (error) throw error;
    return data ? mapVocabulary(data) : null;
  },

  async deleteVocabulary(id: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client().from('vocabularies').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  async recordReview(id: string, rating: Rating): Promise<Vocabulary> {
    const { data, error } = await client().rpc('record_vocabulary_review', {
      p_vocabulary_id: id,
      p_rating: rating,
    });
    if (error) throw error;
    return mapVocabulary(data);
  },

  async getActiveStudySession(): Promise<StudySession | null> {
    const userId = await currentUserId();
    const { data, error } = await client()
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStudySession(data) : null;
  },

  async startStudySession(vocabularyIds: string[]): Promise<StudySession> {
    const { data, error } = await client().rpc('start_study_session', {
      p_vocabulary_ids: vocabularyIds,
    });
    if (error) throw error;
    return mapStudySession(data);
  },

  async resumeStudySession(id: string, vocabularyIds: string[]): Promise<StudySession> {
    const userId = await currentUserId();
    const { data, error } = await client()
      .from('study_sessions')
      .update({ vocabulary_ids: vocabularyIds, current_index: 0 })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return mapStudySession(data);
  },

  async recordStudySessionReview(sessionId: string, vocabularyId: string, rating: Rating): Promise<StudySession> {
    const { data, error } = await client().rpc('record_study_session_review', {
      p_session_id: sessionId,
      p_vocabulary_id: vocabularyId,
      p_rating: rating,
    });
    if (error) throw error;
    return mapStudySession(data);
  },

  async deleteStudySession(id: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client()
      .from('study_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async getQuizResults(): Promise<QuizResult[]> {
    const userId = await currentUserId();
    const [results, scopes] = await Promise.all([
      client().from('quiz_results').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client().from('quiz_result_folders').select('quiz_result_id,folder_id').eq('user_id', userId),
    ]);
    if (results.error) throw results.error;
    if (scopes.error) throw scopes.error;
    const folderIds = new Map<string, string[]>();
    for (const scope of scopes.data) {
      folderIds.set(scope.quiz_result_id, [...(folderIds.get(scope.quiz_result_id) || []), scope.folder_id]);
    }
    return results.data.map((row) => mapQuizResult(row, folderIds.get(row.id) || []));
  },

  async saveQuizResult(
    result: Omit<QuizResult, 'id' | 'createdAt'>,
    mistakes: Array<Omit<MistakeLog, 'id' | 'createdAt' | 'resolved'>> = [],
  ): Promise<QuizResult> {
    const { data, error } = await client().rpc('record_quiz_attempt', {
      p_score_percent: result.scorePercent,
      p_total_questions: result.totalQuestions,
      p_correct_count: result.correctCount,
      p_wrong_count: result.wrongCount,
      p_folder_ids: result.folderIds || [],
      p_mistakes: mistakes.map((mistake) => ({
        vocabulary_id: mistake.vocabularyId,
        word: mistake.word,
        meaning: mistake.meaning,
        user_answer: mistake.userAnswer,
        correct_answer: mistake.correctAnswer,
      })),
    });
    if (error) throw error;
    return mapQuizResult(data, result.folderIds || []);
  },

  async getMistakeLogs(): Promise<MistakeLog[]> {
    const userId = await currentUserId();
    const { data, error } = await client().from('mistake_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapMistake);
  },

  async addMistakeLog(log: Omit<MistakeLog, 'id' | 'createdAt' | 'resolved'>): Promise<MistakeLog> {
    const userId = await currentUserId();
    const row: TablesInsert<'mistake_logs'> = {
      user_id: userId,
      vocabulary_id: log.vocabularyId || null,
      word: log.word,
      meaning: log.meaning,
      user_answer: log.userAnswer,
      correct_answer: log.correctAnswer,
    };
    const { data, error } = await client().from('mistake_logs').insert(row).select('*').single();
    if (error) throw error;
    return mapMistake(data);
  },

  async resolveMistakeLog(id: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client().from('mistake_logs').update({ resolved: true }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  async getUserStats(): Promise<UserStats> {
    const userId = await currentUserId();
    const [reviews, quizzes] = await Promise.all([
      client().from('review_logs').select('reviewed_at').eq('user_id', userId),
      client().from('quiz_results').select('created_at,total_questions').eq('user_id', userId),
    ]);
    if (reviews.error) throw reviews.error;
    if (quizzes.error) throw quizzes.error;

    const today = new Date().toISOString().slice(0, 10);
    const reviewDates = reviews.data.map((row) => dayKey(row.reviewed_at));
    const quizDates = quizzes.data.map((row) => dayKey(row.created_at));
    const activityDates = new Set([...reviewDates, ...quizDates]);
    const { currentStreak, bestStreak } = streaks(activityDates, today);
    const wordsStudiedToday = reviews.data.filter((row) => dayKey(row.reviewed_at) === today).length +
      quizzes.data.filter((row) => dayKey(row.created_at) === today).reduce((sum, row) => sum + row.total_questions, 0);
    const lastActiveDate = [...activityDates].sort((a, b) => b.localeCompare(a))[0] || today;

    return {
      currentStreak,
      bestStreak,
      lastActiveDate,
      wordsStudiedToday,
      reviewsCompletedToday: wordsStudiedToday,
    };
  },
};
