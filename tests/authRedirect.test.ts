import { describe, expect, it } from 'vitest';
import { authPathFor, safeNextPath } from '@/lib/authRedirect';
import { quizCountFor } from '@/lib/quizBuilder';

describe('safeNextPath', () => {
  it('accepts only same-site paths', () => {
    expect(safeNextPath('/explore/collection?id=abc')).toBe('/explore/collection?id=abc');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('authPathFor', () => {
  it('carries the current page along, except the dashboard and the auth page itself', () => {
    expect(authPathFor('/explore/collection', '?id=abc')).toBe('/auth?next=%2Fexplore%2Fcollection%3Fid%3Dabc');
    expect(authPathFor('/', '')).toBe('/auth');
    expect(authPathFor('/auth', '?next=%2Fstudy')).toBe('/auth');
  });
});

describe('quizCountFor', () => {
  it('rounds the weak-word count up to an offered option, or all words', () => {
    expect(quizCountFor(3)).toBe(5);
    expect(quizCountFor(7)).toBe(10);
    expect(quizCountFor(20)).toBe(20);
    expect(quizCountFor(45)).toBe(0);
  });
});
