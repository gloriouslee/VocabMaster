import { describe, expect, it } from 'vitest';
import { buildQuiz, dedupeWords, isAnswerCorrect, pickDistractors, selectTargets, weaknessScore, type WeaknessInfo } from '@/lib/quizBuilder';
import { DAY_MS, makeWord } from './fixtures';

const noInfo: WeaknessInfo = { lapses: new Map(), mistakes: new Map() };
const pool = [
  makeWord({ id: '1', word: 'affect', meaning: 'tac dong', wordType: 'verb', example: 'It will affect everyone.' }),
  makeWord({ id: '2', word: 'effect', meaning: 'ket qua', wordType: 'noun', example: 'The effect was huge.' }),
  makeWord({ id: '3', word: 'afford', meaning: 'du kha nang', wordType: 'verb' }),
  makeWord({ id: '4', word: 'ground', meaning: 'mat dat', wordType: 'noun' }),
  makeWord({ id: '5', word: 'collapse', meaning: 'sup do', wordType: 'verb' }),
  makeWord({ id: '6', word: 'Affect', meaning: 'duplicate', wordType: 'verb' }),
];

describe('quiz building', () => {
  it('removes duplicate words ignoring case', () => {
    expect(dedupeWords(pool)).toHaveLength(5);
  });

  it('builds options that contain the answer once, without duplicates', () => {
    for (const question of buildQuiz(pool, { count: 0, source: 'random', format: 'mixed' }, noInfo)) {
      if (question.type === 'typing') {
        expect(question.options).toEqual([]);
        continue;
      }
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.options.filter((option) => option === question.correctAnswer)).toHaveLength(1);
      expect(question.options).toHaveLength(4);
    }
  });

  it('prefers distractors with the same word type and similar spelling', () => {
    const [first] = pickDistractors(pool[0], pool, 'word', 1);
    expect(['afford', 'effect']).toContain(first);
  });

  it('falls back to reverse questions when a cloze has no example sentence', () => {
    for (const question of buildQuiz(pool, { count: 0, source: 'random', format: 'cloze' }, noInfo)) {
      expect(question.type).toBe(question.vocab.example ? 'cloze' : 'reverse');
    }
  });

  it('grades typed answers ignoring case and spacing, exact match for choices', () => {
    const typing = buildQuiz(pool, { count: 1, source: 'random', format: 'typing' }, noInfo)[0];
    expect(isAnswerCorrect(typing, `  ${typing.correctAnswer.toUpperCase()} `)).toBe(true);
    expect(isAnswerCorrect(typing, 'nonsense')).toBe(false);
    const choice = buildQuiz(pool, { count: 1, source: 'random', format: 'reverse' }, noInfo)[0];
    expect(isAnswerCorrect(choice, choice.correctAnswer)).toBe(true);
    expect(isAnswerCorrect(choice, `${choice.correctAnswer}x`)).toBe(false);
  });
});

describe('weak word selection', () => {
  it('scores lapses, mistakes and low ease, and ignores old lapses once mastered', () => {
    const word = makeWord({ id: 'w', easeFactor: 2.5, nextReviewAt: new Date(Date.now() + DAY_MS).toISOString() });
    const info: WeaknessInfo = { lapses: new Map([['w', 2]]), mistakes: new Map([['w', 1]]) };
    expect(weaknessScore(word, info)).toBe(7);
    expect(weaknessScore({ ...word, status: 'mastered' }, info)).toBe(3);
  });

  it('selects only weak words, strongest first', () => {
    const info: WeaknessInfo = { lapses: new Map([['3', 4]]), mistakes: new Map([['1', 1]]) };
    const future = new Date(Date.now() + 10 * DAY_MS).toISOString();
    const scope = pool.map((word) => ({ ...word, nextReviewAt: future }));
    expect(selectTargets(scope, 'weak', 10, info).map((word) => word.id)).toEqual(['3', '1']);
  });

  it('selects due and mastered sets', () => {
    const due = makeWord({ id: 'd', nextReviewAt: new Date(Date.now() - DAY_MS).toISOString() });
    const later = makeWord({ id: 'l', nextReviewAt: new Date(Date.now() + DAY_MS).toISOString(), status: 'mastered' });
    expect(selectTargets([due, later], 'due', 0, noInfo).map((word) => word.id)).toEqual(['d']);
    expect(selectTargets([due, later], 'mastered', 0, noInfo).map((word) => word.id)).toEqual(['l']);
  });
});
