import { describe, expect, it } from 'vitest';
import { createBackup, orderFoldersParentFirst, parseBackup } from '@/lib/backup';
import { daysUntil, planForExam } from '@/lib/examGoal';
import { STARTER_PACK, STARTER_PACK_SIZE } from '@/lib/starterPack';
import type { Folder } from '@/types';
import { makeWord } from './fixtures';

const folder = (id: string, parentId: string | null): Folder => ({ id, name: `folder ${id}`, parentId, createdAt: '' });

describe('backup', () => {
  const folders = [folder('a', null), folder('b', 'a')];
  const words = [makeWord({ id: '1', folderId: 'b', status: 'mastered', intervalDays: 30, repetitions: 5, easeFactor: 2.2, example: 'x' })];

  it('round-trips folders and learning progress', () => {
    const parsed = parseBackup(JSON.stringify(createBackup(folders, words)));
    expect(parsed.folders.map((item) => item.id)).toEqual(['a', 'b']);
    expect(parsed.vocabularies[0]).toMatchObject({ folderId: 'b', status: 'mastered', intervalDays: 30, repetitions: 5, easeFactor: 2.2 });
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow('valid JSON');
    expect(() => parseBackup('{"hello":1}')).toThrow('not a VocabMaster backup');
    expect(() => parseBackup(JSON.stringify({ app: 'vocabmaster', version: 99, folders: [], vocabularies: [] }))).toThrow('newer version');
  });

  it('sanitises bad rows instead of failing the whole file', () => {
    const parsed = parseBackup(JSON.stringify({
      app: 'vocabmaster',
      version: 1,
      folders: [{ id: 'a', name: ' Topic ', parentId: null }, { id: 5 }],
      vocabularies: [
        { word: ' ok ', meaning: 'fine', wordType: 'weird', status: 'odd', folderId: 'missing', easeFactor: 99, intervalDays: -4 },
        { word: '', meaning: 'empty word' },
        null,
      ],
    }));
    expect(parsed.folders).toEqual([{ id: 'a', name: 'Topic', parentId: null }]);
    expect(parsed.vocabularies).toHaveLength(1);
    expect(parsed.vocabularies[0]).toMatchObject({ word: 'ok', wordType: 'other', status: 'new', folderId: null, easeFactor: 5, intervalDays: 0 });
  });

  it('orders parents before children and breaks cycles', () => {
    const ordered = orderFoldersParentFirst([
      { id: 'child', name: 'c', parentId: 'parent' },
      { id: 'parent', name: 'p', parentId: null },
      { id: 'x', name: 'x', parentId: 'y' },
      { id: 'y', name: 'y', parentId: 'x' },
      { id: 'orphan', name: 'o', parentId: 'gone' },
    ]);
    const index = (id: string) => ordered.findIndex((item) => item.id === id);
    expect(index('parent')).toBeLessThan(index('child'));
    expect(ordered.find((item) => item.id === 'orphan')?.parentId).toBeNull();
    expect(ordered).toHaveLength(5);
    expect(ordered.filter((item) => item.id === 'x' || item.id === 'y').some((item) => item.parentId === null)).toBe(true);
  });
});

describe('exam goal', () => {
  const now = new Date(2026, 9, 8, 22, 30);

  it('counts whole local days', () => {
    expect(daysUntil('2026-10-08', now)).toBe(0);
    expect(daysUntil('2026-10-18', now)).toBe(10);
    expect(daysUntil('2026-10-01', now)).toBe(-7);
  });

  it('spreads new words over the study days, leaving two for revision', () => {
    expect(planForExam('2026-10-18', 80, now)).toEqual({ daysLeft: 10, newPerDayNeeded: 10, isPast: false });
    expect(planForExam('2026-10-09', 5, now)).toEqual({ daysLeft: 1, newPerDayNeeded: 5, isPast: false });
    expect(planForExam('2026-10-01', 5, now).isPast).toBe(true);
  });
});

describe('starter pack', () => {
  it('has unique words, valid types and complete fields', () => {
    const all = STARTER_PACK.flatMap((topic) => topic.words);
    expect(all).toHaveLength(STARTER_PACK_SIZE);
    expect(new Set(all.map((word) => word.word.toLowerCase())).size).toBe(all.length);
    for (const word of all) {
      expect(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other']).toContain(word.wordType);
      expect(word.meaning.length).toBeGreaterThan(1);
      expect(word.level).toMatch(/^Band \d(\.\d)?$/);
      // The example must contain the word (or its stem) so fill-in-the-blank cards work.
      expect(word.example.toLowerCase()).toContain(word.word.toLowerCase().slice(0, Math.max(4, word.word.length - 3)));
    }
  });
});
