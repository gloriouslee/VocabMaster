import { describe, expect, it } from 'vitest';
import { chineseTestText, detectLanguage, findVoice, languageForText, missingVoiceMessage, summariseVoices, type VoiceLike } from '@/lib/speech';

const voice = (lang: string, name = lang, localService = true): VoiceLike => ({ lang, name, localService });

describe('detectLanguage', () => {
  it('recognises the script of a word or sentence', () => {
    expect(detectLanguage('sustainable')).toBe('en');
    expect(detectLanguage('可持续的')).toBe('zh');
    expect(detectLanguage('我今天学习了很多新单词。')).toBe('zh');
    expect(detectLanguage('持続可能な')).toBe('ja');
    expect(detectLanguage('こんにちは')).toBe('ja');
    expect(detectLanguage('지속 가능한')).toBe('ko');
  });

  it('treats mixed text with Chinese characters as Chinese and plain symbols as English', () => {
    expect(detectLanguage('iPhone 手机')).toBe('zh');
    expect(detectLanguage('123 !?')).toBe('en');
    expect(detectLanguage('')).toBe('en');
  });
});

describe('findVoice', () => {
  it('prefers an exact match and understands different spellings of the tag', () => {
    const voices = [voice('en-US'), voice('zh_TW'), voice('zh-CN', 'Mandarin')];
    expect(findVoice(voices, 'zh-CN')?.name).toBe('Mandarin');
    expect(findVoice(voices, 'zh-TW')?.lang).toBe('zh_TW');
  });

  it('does not let an installed fallback voice shadow an exact regional match', () => {
    const voices = [voice('zh-TW', 'Local Taiwan', true), voice('zh-CN', 'Network China', false)];
    expect(findVoice(voices, 'zh-CN')?.name).toBe('Network China');
  });

  it('understands Android and Apple style tags', () => {
    expect(findVoice([voice('cmn-CN')], 'zh-CN')).toBeDefined();
    expect(findVoice([voice('zh-Hans')], 'zh-CN')).toBeDefined();
    expect(findVoice([voice('yue-HK')], 'zh-HK')).toBeDefined();
    expect(findVoice([voice('zh-Hant')], 'zh-TW')).toBeDefined();
  });

  it('falls back to another Chinese voice rather than nothing', () => {
    expect(findVoice([voice('zh-TW')], 'zh-CN')?.lang).toBe('zh-TW');
    expect(findVoice([voice('en-GB')], 'en-US')?.lang).toBe('en-GB');
  });

  it('never returns a voice of a different language', () => {
    expect(findVoice([voice('en-US'), voice('ja-JP')], 'zh-CN')).toBeUndefined();
    expect(findVoice([], 'ko-KR')).toBeUndefined();
  });

  it('prefers voices installed on the device over network voices', () => {
    const voices = [voice('zh-CN', 'Network', false), voice('zh-CN', 'Local', true)];
    expect(findVoice(voices, 'zh-CN')?.name).toBe('Local');
  });
});

describe('languageForText', () => {
  it('uses the chosen accent for English and the chosen variant for Chinese', () => {
    expect(languageForText('hello', 'en-GB', 'zh-TW')).toBe('en-GB');
    expect(languageForText('你好', 'en-GB', 'zh-TW')).toBe('zh-TW');
    expect(languageForText('こんにちは', 'en-US', 'zh-CN')).toBe('ja-JP');
  });
});

describe('Chinese voice test phrase', () => {
  it('uses script appropriate for the selected variant', () => {
    expect(detectLanguage(chineseTestText('zh-CN'))).toBe('zh');
    expect(chineseTestText('zh-CN')).toContain('欢迎');
    expect(chineseTestText('zh-TW')).toContain('歡迎');
    expect(chineseTestText('zh-HK')).toContain('歡迎');
  });
});

describe('device voice help', () => {
  it('counts voices per language', () => {
    const summary = summariseVoices([voice('en-US'), voice('en-GB'), voice('zh-CN'), voice('cmn-TW'), voice('yue-HK'), voice('ja-JP')]);
    expect(summary).toEqual({ english: 2, chinese: 3, japanese: 1, korean: 0, total: 6 });
  });

  it('names the missing language in the help message', () => {
    expect(missingVoiceMessage('zh-CN')).toContain('Chinese');
    expect(missingVoiceMessage('ko-KR')).toContain('Korean');
  });
});
