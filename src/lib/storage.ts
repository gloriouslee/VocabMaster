import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/database';
import { Folder, Vocabulary, QuizResult, MistakeLog, UserStats, WordType } from '@/types';
import { Rating, scheduleReview } from './spacedRepetition';
import type { TodayActivity } from './dailyPlan';
import { normalizeWord } from './normalizeWord';
import { Backup, orderFoldersParentFirst } from './backup';
import { STARTER_PACK } from './starterPack';

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

// PostgREST returns at most 1000 rows per request, so larger tables are read page by page.
const PAGE_SIZE = 1000;

async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
  return groups;
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

/** Calendar day (YYYY-MM-DD) in the learner's local timezone, so "today" rolls over at local midnight. */
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayKey(isoDate: string): string {
  return localDayKey(new Date(isoDate));
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
    const rows = await fetchAll((from, to) =>
      client().from('vocabularies').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(from, to));
    return rows.map(mapVocabulary);
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

  /** Number of times each word was rated "forgot" (all words when no ids are given). */
  async getLapseCounts(vocabularyIds?: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (vocabularyIds && vocabularyIds.length === 0) return counts;
    const userId = await currentUserId();
    const wanted = vocabularyIds ? new Set(vocabularyIds) : null;
    const rows = await fetchAll((from, to) =>
      client().from('review_logs').select('vocabulary_id').eq('user_id', userId).eq('rating', 'forgot').order('id').range(from, to));
    for (const row of rows) {
      if (wanted && !wanted.has(row.vocabulary_id)) continue;
      counts.set(row.vocabulary_id, (counts.get(row.vocabulary_id) || 0) + 1);
    }
    return counts;
  },

  /** Number of already-studied cards that are due for review right now. */
  async getDueCount(): Promise<number> {
    const userId = await currentUserId();
    const { count, error } = await client()
      .from('vocabularies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'new')
      .lte('next_review_at', new Date().toISOString());
    if (error) throw error;
    return count || 0;
  },

  /** Flashcard reviews done since local midnight, and how many of those words were seen for the first time. */
  async getTodayActivity(): Promise<TodayActivity> {
    const userId = await currentUserId();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const since = midnight.toISOString();
    const todayLogs = await fetchAll((from, to) =>
      client().from('review_logs').select('vocabulary_id').eq('user_id', userId).gte('reviewed_at', since).order('id').range(from, to));
    const todayIds = [...new Set(todayLogs.map((row) => row.vocabulary_id))];
    if (todayIds.length === 0) return { reviewsToday: 0, newToday: 0 };

    // Chunked so the id list never makes the request URL too long.
    const seenBefore = new Set<string>();
    await Promise.all(chunk(todayIds, 50).map(async (ids) => {
      const rows = await fetchAll((from, to) =>
        client().from('review_logs').select('vocabulary_id').eq('user_id', userId).lt('reviewed_at', since).in('vocabulary_id', ids).order('id').range(from, to));
      for (const row of rows) seenBefore.add(row.vocabulary_id);
    }));
    return {
      reviewsToday: todayLogs.length,
      newToday: todayIds.filter((id) => !seenBefore.has(id)).length,
    };
  },

  /** Spreads the given overdue cards across the next `days` days so a backlog becomes manageable. */
  async spreadOverdue(ids: string[], days: number): Promise<void> {
    const perDay = Math.ceil(ids.length / days);
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (let start = 0; start < ids.length; start += 10) {
      await Promise.all(ids.slice(start, start + 10).map((id, offset) => {
        const dayOffset = Math.floor((start + offset) / perDay);
        return this.updateVocabulary(id, { nextReviewAt: new Date(now + dayOffset * dayMs).toISOString() });
      }));
    }
  },

  /**
   * A word missed in a quiz is treated like a flashcard lapse: it is due again now and
   * its ease drops. New (never studied) words are left alone.
   */
  async applyQuizLapses(words: Vocabulary[]): Promise<number> {
    const missed = words.filter((word) => word.status !== 'new');
    for (let start = 0; start < missed.length; start += 10) {
      await Promise.all(missed.slice(start, start + 10).map((word) => {
        const next = scheduleReview(
          { intervalDays: word.intervalDays || 0, repetitions: word.repetitions || 0, easeFactor: word.easeFactor || 2.5 },
          'forgot',
        );
        return this.updateVocabulary(word.id, {
          nextReviewAt: new Date().toISOString(),
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          easeFactor: next.easeFactor,
          status: next.status,
        });
      }));
    }
    return missed.length;
  },

  /** Adds the built-in starter words (skipping any word already in the library). */
  async importStarterPack(): Promise<{ added: number; skipped: number }> {
    const [folders, words] = await Promise.all([this.getFolders(), this.getVocabularies()]);
    const known = new Set(words.map((word) => normalizeWord(word.word)));
    let added = 0;
    let skipped = 0;
    for (const topic of STARTER_PACK) {
      const existing = folders.find((folder) => folder.parentId === null && folder.name.toLocaleLowerCase() === topic.folder.toLocaleLowerCase());
      const folder = existing || await this.saveFolder({ name: topic.folder, parentId: null });
      const fresh = topic.words.filter((word) => !known.has(normalizeWord(word.word)));
      skipped += topic.words.length - fresh.length;
      if (fresh.length === 0) continue;
      await this.bulkAddVocabularies(fresh.map((word) => ({ ...word, phonetic: '', folderId: folder.id })));
      fresh.forEach((word) => known.add(normalizeWord(word.word)));
      added += fresh.length;
    }
    return { added, skipped };
  },

  /** Restores a backup file additively: folders are matched by name and words already present are skipped. */
  async restoreBackup(backup: Backup): Promise<{ foldersCreated: number; added: number; skipped: number }> {
    const [folders, words] = await Promise.all([this.getFolders(), this.getVocabularies()]);
    const idMap = new Map<string, string>();
    let foldersCreated = 0;
    const current = [...folders];
    for (const folder of orderFoldersParentFirst(backup.folders)) {
      const parentId = folder.parentId ? idMap.get(folder.parentId) ?? null : null;
      const existing = current.find((item) => item.parentId === parentId && item.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase());
      if (existing) {
        idMap.set(folder.id, existing.id);
        continue;
      }
      const created = await this.saveFolder({ name: folder.name, parentId });
      current.push(created);
      idMap.set(folder.id, created.id);
      foldersCreated += 1;
    }

    const keyOf = (word: string, folderId: string | null) => `${normalizeWord(word)}|${folderId ?? ''}`;
    const known = new Set(words.map((word) => keyOf(word.word, word.folderId)));
    const fresh = backup.vocabularies
      .map((word) => ({ ...word, folderId: word.folderId ? idMap.get(word.folderId) ?? null : null }))
      .filter((word) => {
        const key = keyOf(word.word, word.folderId);
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
    for (const group of chunk(fresh, 200)) await this.bulkAddVocabularies(group);
    return { foldersCreated, added: fresh.length, skipped: backup.vocabularies.length - fresh.length };
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
    const [resultRows, scopeRows] = await Promise.all([
      fetchAll((from, to) =>
        client().from('quiz_results').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(from, to)),
      fetchAll((from, to) =>
        client().from('quiz_result_folders').select('quiz_result_id,folder_id').eq('user_id', userId).order('quiz_result_id').order('folder_id').range(from, to)),
    ]);
    const results = { data: resultRows };
    const folderIds = new Map<string, string[]>();
    for (const scope of scopeRows) {
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
    const rows = await fetchAll((from, to) =>
      client().from('mistake_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(from, to));
    return rows.map(mapMistake);
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
    const [reviewRows, quizRows] = await Promise.all([
      fetchAll((from, to) => client().from('review_logs').select('reviewed_at').eq('user_id', userId).order('id').range(from, to)),
      fetchAll((from, to) => client().from('quiz_results').select('created_at,total_questions').eq('user_id', userId).order('id').range(from, to)),
    ]);
    const reviews = { data: reviewRows };
    const quizzes = { data: quizRows };

    const today = localDayKey(new Date());
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
