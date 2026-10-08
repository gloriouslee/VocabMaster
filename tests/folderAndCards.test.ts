import { describe, expect, it } from 'vitest';
import { getFolderScopeIds } from '@/lib/folderScope';
import { isCorrectAnswer, maskExample, pickCardMode } from '@/lib/cards';
import type { Folder } from '@/types';
import { makeWord } from './fixtures';

const folder = (id: string, parentId: string | null): Folder => ({ id, name: id, parentId, createdAt: '' });

describe('getFolderScopeIds', () => {
  const folders = [folder('a', null), folder('b', 'a'), folder('c', 'b'), folder('d', null)];

  it('includes all descendants', () => {
    expect([...getFolderScopeIds(folders, 'a')].sort()).toEqual(['a', 'b', 'c']);
    expect([...getFolderScopeIds(folders, 'd')]).toEqual(['d']);
  });

  it('terminates on cycles', () => {
    const cyclic = [folder('x', 'y'), folder('y', 'x')];
    expect([...getFolderScopeIds(cyclic, 'x')].sort()).toEqual(['x', 'y']);
  });
});

describe('cards', () => {
  it('masks the word and simple inflections in the example', () => {
    expect(maskExample(makeWord({ id: '1', word: 'ground', example: 'They stood their grounds.' }))).toBe('They stood their _____.');
    expect(maskExample(makeWord({ id: '2', word: 'turn a blind eye', example: 'Do not Turn  a blind eye.' }))).toBe('Do not _____.');
    expect(maskExample(makeWord({ id: '3', word: 'ground', example: 'Nothing relevant.' }))).toBeNull();
  });

  it('does not break on regex characters in a word', () => {
    expect(() => maskExample(makeWord({ id: '4', word: 'c++ (x)', example: 'Safe with c++ (x) here' }))).not.toThrow();
  });

  it('keeps new words simple in mixed mode and falls back from cloze without an example', () => {
    expect(pickCardMode(makeWord({ id: '1', repetitions: 0 }), 'mixed')).toBe('classic');
    expect(pickCardMode(makeWord({ id: '1', repetitions: 3 }), 'cloze')).toBe('reverse');
    expect(pickCardMode(makeWord({ id: '1', repetitions: 3, example: 'A word-1 here' }), 'cloze')).toBe('cloze');
  });

  it('compares typed answers ignoring case and spacing', () => {
    expect(isCorrectAnswer('  WORD-1 ', makeWord({ id: '1' }))).toBe(true);
  });
});
