import { Vocabulary } from '@/types';
import { shuffle } from './shuffle';
import { maskExample } from './cards';
import { normalizeWord } from './normalizeWord';

export type QuizQuestionType = 'mcq' | 'reverse' | 'cloze' | 'typing' | 'listening';
export type QuizFormat = 'mixed' | QuizQuestionType;
export type QuizSource = 'random' | 'weak' | 'due' | 'mastered';

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  subPrompt?: string;
  /** Text read aloud for listening questions. */
  audioText?: string;
  correctAnswer: string;
  /** Empty for typing questions. */
  options: string[];
  vocab: Vocabulary;
}

export interface QuizAnswer {
  question: QuizQuestion;
  selectedAnswer: string;
  isCorrect: boolean;
}

export const FORMAT_LABELS: Record<QuizFormat, string> = {
  mixed: 'Mixed (all formats)',
  mcq: 'Multiple choice (English → Vietnamese)',
  reverse: 'Reverse (Vietnamese → English)',
  cloze: 'Fill in the blank',
  typing: 'Type the word',
  listening: 'Listening (hear it, pick the spelling)',
};

export const SOURCE_LABELS: Record<QuizSource, string> = {
  random: 'Random words',
  weak: 'My weak words',
  due: 'Words due for review',
  mastered: 'Check mastered words',
};

export const TYPE_LABELS: Record<QuizQuestionType, string> = {
  mcq: 'Multiple choice',
  reverse: 'Reverse translation',
  cloze: 'Fill in the blank',
  typing: 'Type the word',
  listening: 'Listening',
};

export interface WeaknessInfo {
  /** Times each word was rated "forgot" in flashcards. */
  lapses: Map<string, number>;
  /** Unresolved mistakes per word from earlier quizzes. */
  mistakes: Map<string, number>;
}

const MIXED_TYPES: QuizQuestionType[] = ['mcq', 'reverse', 'cloze', 'typing', 'listening'];

export function isAnswerCorrect(question: QuizQuestion, selected: string): boolean {
  return question.type === 'typing'
    ? normalizeWord(selected) === normalizeWord(question.correctAnswer)
    : selected === question.correctAnswer;
}

export function dedupeWords(words: Vocabulary[]): Vocabulary[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = normalizeWord(word.word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Higher means the learner struggles more with this word. */
export function weaknessScore(word: Vocabulary, info: WeaknessInfo, now = Date.now()): number {
  const lapses = info.lapses.get(word.id) || 0;
  const mistakes = info.mistakes.get(word.id) || 0;
  const easePenalty = Math.max(0, 2.5 - (word.easeFactor || 2.5));
  const overdue = word.status !== 'new' && new Date(word.nextReviewAt).getTime() <= now ? 0.5 : 0;
  return lapses * 2 + mistakes * 3 + easePenalty * 2 + overdue;
}

export function selectTargets(pool: Vocabulary[], source: QuizSource, count: number, info: WeaknessInfo): Vocabulary[] {
  const now = Date.now();
  const shuffled = shuffle(pool);
  let ordered: Vocabulary[];
  switch (source) {
    case 'weak': {
      const scored = shuffled.map((word) => ({ word, score: weaknessScore(word, info, now) }));
      const weak = scored.filter((item) => item.score > 0.5).sort((a, b) => b.score - a.score).map((item) => item.word);
      ordered = weak;
      break;
    }
    case 'due':
      ordered = shuffled
        .filter((word) => word.status !== 'new' && new Date(word.nextReviewAt).getTime() <= now)
        .sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime());
      break;
    case 'mastered':
      ordered = shuffled.filter((word) => word.status === 'mastered');
      break;
    default:
      ordered = shuffled;
  }
  return count > 0 ? ordered.slice(0, count) : ordered;
}

function bigrams(value: string): Set<string> {
  const text = normalizeWord(value).replace(/\s/g, '');
  const result = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}

/** Dice coefficient on character pairs: 1 means identical spelling. */
function spellingSimilarity(a: string, b: string): number {
  const first = bigrams(a);
  const second = bigrams(b);
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  first.forEach((pair) => { if (second.has(pair)) shared += 1; });
  return (2 * shared) / (first.size + second.size);
}

/**
 * Picks wrong options that look plausible: same word type and topic, similar
 * length, and (for word options) similar spelling, so they cannot be ruled out at a glance.
 */
export function pickDistractors(
  vocab: Vocabulary,
  pool: Vocabulary[],
  field: 'meaning' | 'word',
  count = 3,
): string[] {
  const correctKey = vocab[field].trim().toLocaleLowerCase();
  const bySpelling = field === 'word';
  const candidates = new Map<string, { text: string; score: number }>();
  for (const other of pool) {
    if (other.id === vocab.id) continue;
    const text = other[field].trim();
    const key = text.toLocaleLowerCase();
    if (!key || key === correctKey || candidates.has(key)) continue;
    const lengthGap = Math.abs(text.length - vocab[field].length) / Math.max(text.length, vocab[field].length, 1);
    const score =
      (other.wordType === vocab.wordType ? 2 : 0) +
      (other.folderId && other.folderId === vocab.folderId ? 1 : 0) -
      lengthGap * 1.5 +
      (bySpelling ? spellingSimilarity(text, vocab[field]) * 3 : 0) +
      Math.random() * 0.8;
    candidates.set(key, { text, score });
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, count).map((item) => item.text);
}

function typeFor(index: number, format: QuizFormat, vocab: Vocabulary, offset: number): QuizQuestionType {
  const type: QuizQuestionType = format === 'mixed' ? MIXED_TYPES[(index + offset) % MIXED_TYPES.length] : format;
  return type === 'cloze' && !maskExample(vocab) ? 'reverse' : type;
}

export function buildQuestion(vocab: Vocabulary, type: QuizQuestionType, pool: Vocabulary[], id: string): QuizQuestion {
  switch (type) {
    case 'mcq':
      return {
        id, type, prompt: vocab.word, subPrompt: vocab.phonetic || undefined, correctAnswer: vocab.meaning, vocab,
        options: shuffle([vocab.meaning, ...pickDistractors(vocab, pool, 'meaning')]),
      };
    case 'reverse':
      return {
        id, type, prompt: vocab.meaning, correctAnswer: vocab.word, vocab,
        options: shuffle([vocab.word, ...pickDistractors(vocab, pool, 'word')]),
      };
    case 'cloze':
      return {
        id, type, prompt: maskExample(vocab) || vocab.meaning, subPrompt: vocab.meaning, correctAnswer: vocab.word, vocab,
        options: shuffle([vocab.word, ...pickDistractors(vocab, pool, 'word')]),
      };
    case 'typing':
      return { id, type, prompt: vocab.meaning, subPrompt: vocab.phonetic || undefined, correctAnswer: vocab.word, options: [], vocab };
    case 'listening':
      return {
        id, type, prompt: 'Listen and choose the word you hear', audioText: vocab.word, correctAnswer: vocab.word, vocab,
        options: shuffle([vocab.word, ...pickDistractors(vocab, pool, 'word')]),
      };
  }
}

export function buildQuiz(
  scope: Vocabulary[],
  options: { count: number; source: QuizSource; format: QuizFormat },
  info: WeaknessInfo,
): QuizQuestion[] {
  const pool = dedupeWords(scope);
  const targets = selectTargets(pool, options.source, options.count, info);
  const offset = Math.floor(Math.random() * MIXED_TYPES.length);
  return targets.map((vocab, index) => buildQuestion(vocab, typeFor(index, options.format, vocab, offset), pool, `q-${index}`));
}

/** Minimum scope size: choice questions need three wrong options, typing does not. */
export function minimumWords(format: QuizFormat): number {
  return format === 'typing' ? 1 : 4;
}
