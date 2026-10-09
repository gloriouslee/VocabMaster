import { describe, expect, it } from 'vitest';
import { collectionLink, parseTags, validateShareForm } from '@/lib/explore';

describe('parseTags', () => {
  it('lowercases, trims, removes duplicates and keeps five at most', () => {
    expect(parseTags(' Climate, IELTS ,climate,,Writing\nspeaking, band7, extra ')).toEqual(['climate', 'ielts', 'writing', 'speaking', 'band7']);
  });

  it('shortens very long tags', () => {
    expect(parseTags('x'.repeat(40))[0]).toHaveLength(24);
    expect(parseTags('')).toEqual([]);
  });
});

describe('validateShareForm', () => {
  const valid = { title: 'Environment essentials', description: '', visibility: 'public' as const, wordCount: 12, acknowledged: true };

  it('accepts a complete form', () => {
    expect(validateShareForm(valid)).toBeNull();
  });

  it('checks the title and description length', () => {
    expect(validateShareForm({ ...valid, title: 'ab' })).toContain('title');
    expect(validateShareForm({ ...valid, description: 'x'.repeat(501) })).toContain('500');
  });

  it('needs enough words and an acknowledgement to share, but not to keep private', () => {
    expect(validateShareForm({ ...valid, wordCount: 3 })).toContain('at least 5');
    expect(validateShareForm({ ...valid, acknowledged: false })).toContain('confirm');
    expect(validateShareForm({ ...valid, visibility: 'private', wordCount: 0, acknowledged: false })).toBeNull();
  });
});

describe('collectionLink', () => {
  it('builds a shareable link', () => {
    expect(collectionLink('https://app.example', 'abc-123')).toBe('https://app.example/explore/collection?id=abc-123');
  });
});
