/**
 * Pronunciation for every language the learner studies. The language is detected from the
 * text itself (Chinese characters are read with a Chinese voice, English with the chosen
 * accent), a matching voice is picked from the device, and a clear message is shown when
 * the device has no voice for that language.
 */

export type EnglishAccent = 'en-US' | 'en-GB';
export type ChineseVariant = 'zh-CN' | 'zh-TW' | 'zh-HK';
export type SpeechLang = EnglishAccent | ChineseVariant | 'ja-JP' | 'ko-KR';
export type TextLanguage = 'en' | 'zh' | 'ja' | 'ko';

export const ACCENT_KEY = 'vocabmaster.accent' as const;
export const CHINESE_VARIANT_KEY = 'vocabmaster.chineseVariant' as const;
export const SPEECH_NOTICE_EVENT = 'vocabmaster:speech-notice';

export const CHINESE_VARIANTS: Array<{ value: ChineseVariant; label: string }> = [
  { value: 'zh-CN', label: 'Mandarin, Simplified (China)' },
  { value: 'zh-TW', label: 'Mandarin, Traditional (Taiwan)' },
  { value: 'zh-HK', label: 'Cantonese (Hong Kong)' },
];

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

const HAN = /[㐀-䶿一-鿿豈-﫿]|[\ud840-\ud87f][\udc00-\udfff]/;
const KANA = /[぀-ヿㇰ-ㇿ]/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/** Which language a word or sentence is written in, judged by its script. */
export function detectLanguage(text: string): TextLanguage {
  if (KANA.test(text)) return 'ja';
  if (HANGUL.test(text)) return 'ko';
  if (HAN.test(text)) return 'zh';
  return 'en';
}

// Browsers and phones name the same voice differently (zh-CN, zh_CN, cmn-CN, zh-Hans...).
const ALIASES: Record<SpeechLang, string[]> = {
  'en-US': ['en-us'],
  'en-GB': ['en-gb'],
  'zh-CN': ['zh-cn', 'cmn-cn', 'zh-hans-cn', 'cmn-hans-cn', 'zh-hans'],
  'zh-TW': ['zh-tw', 'cmn-tw', 'zh-hant-tw', 'cmn-hant-tw', 'zh-hant'],
  'zh-HK': ['zh-hk', 'yue-hk', 'yue-hant-hk', 'zh-hant-hk', 'zh-yue', 'yue'],
  'ja-JP': ['ja-jp', 'ja'],
  'ko-KR': ['ko-kr', 'ko'],
};

const FAMILY_PREFIXES: Record<SpeechLang, string[]> = {
  'en-US': ['en'],
  'en-GB': ['en'],
  'zh-CN': ['zh', 'cmn'],
  'zh-TW': ['zh', 'cmn'],
  'zh-HK': ['zh', 'yue', 'cmn'],
  'ja-JP': ['ja'],
  'ko-KR': ['ko'],
};

const normalizeTag = (lang: string) => lang.replace(/_/g, '-').toLowerCase();

/**
 * Best voice for a language: an exact (or alias) match first, otherwise any voice of the
 * same language family, preferring voices installed on the device over network ones.
 */
export function findVoice<T extends VoiceLike>(voices: readonly T[], lang: SpeechLang): T | undefined {
  const rank = (voice: T) => (voice.localService ? 0 : 1);
  const sorted = [...voices].sort((a, b) => rank(a) - rank(b));

  const aliases = ALIASES[lang];
  for (const alias of aliases) {
    const match = sorted.find((voice) => normalizeTag(voice.lang) === alias);
    if (match) return match;
  }
  const family = FAMILY_PREFIXES[lang];
  return sorted.find((voice) => {
    const tag = normalizeTag(voice.lang);
    return family.some((prefix) => tag === prefix || tag.startsWith(`${prefix}-`));
  });
}

export function languageForText(text: string, english: EnglishAccent, chinese: ChineseVariant): SpeechLang {
  switch (detectLanguage(text)) {
    case 'zh': return chinese;
    case 'ja': return 'ja-JP';
    case 'ko': return 'ko-KR';
    default: return english;
  }
}

export function languageName(lang: SpeechLang): string {
  if (lang.startsWith('zh')) return 'Chinese';
  if (lang === 'ja-JP') return 'Japanese';
  if (lang === 'ko-KR') return 'Korean';
  return 'English';
}

export function missingVoiceMessage(lang: SpeechLang): string {
  const name = languageName(lang);
  return `This device has no ${name} voice installed, so it cannot read this aloud. ` +
    'Windows: Settings > Time & language > Speech > Add voices. ' +
    'iPhone or Mac: Settings > Accessibility > Spoken Content > Voices. ' +
    `Android: Settings > Text-to-speech > install ${name} voice data.`;
}

/** Voices load asynchronously in Chrome, so the first call may need to wait for them. */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = () => {
      synth.removeEventListener('voiceschanged', finish);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener('voiceschanged', finish);
  });
}

export function readSpeechPreferences(): { english: EnglishAccent; chinese: ChineseVariant } {
  if (typeof window === 'undefined') return { english: 'en-US', chinese: 'zh-CN' };
  const accent = window.localStorage.getItem(ACCENT_KEY);
  const variant = window.localStorage.getItem(CHINESE_VARIANT_KEY);
  return {
    english: accent === 'en-GB' ? 'en-GB' : 'en-US',
    chinese: variant === 'zh-TW' || variant === 'zh-HK' ? variant : 'zh-CN',
  };
}

export type SpeakResult = { status: 'spoken'; lang: SpeechLang } | { status: 'unsupported' } | { status: 'no-voice'; lang: SpeechLang };

let lastNoticeAt = 0;

function notify(message: string) {
  // Repeated taps should not stack up identical messages.
  if (Date.now() - lastNoticeAt < 8000) return;
  lastNoticeAt = Date.now();
  window.dispatchEvent(new CustomEvent(SPEECH_NOTICE_EVENT, { detail: message }));
}

/**
 * Reads text aloud in the language it is written in. When the device has no voice for that
 * language a notice is shown (see SpeechNotice) instead of staying silent.
 */
export async function speak(text: string, override?: SpeechLang): Promise<SpeakResult> {
  const value = text.trim();
  if (!value) return { status: 'spoken', lang: 'en-US' };
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (typeof window !== 'undefined') notify('Your browser does not support reading text aloud. Try Chrome, Edge or Safari.');
    return { status: 'unsupported' };
  }

  const { english, chinese } = readSpeechPreferences();
  const lang = override ?? languageForText(value, english, chinese);
  const voices = await loadVoices();
  const voice = findVoice(voices, lang);

  // English can still be spoken with the default voice, other languages need a matching one.
  if (!voice && !lang.startsWith('en') && voices.length > 0) {
    notify(missingVoiceMessage(lang));
    return { status: 'no-voice', lang };
  }

  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = voice?.lang ?? lang;
  if (voice) utterance.voice = voice;
  utterance.rate = lang.startsWith('zh') ? 0.9 : 1;
  synth.speak(utterance);
  return { status: 'spoken', lang };
}

/** What the device can read aloud, for the settings page. */
export function summariseVoices(voices: readonly VoiceLike[]): { english: number; chinese: number; japanese: number; korean: number; total: number } {
  const count = (family: readonly string[]) =>
    voices.filter((voice) => {
      const tag = normalizeTag(voice.lang);
      return family.some((prefix) => tag === prefix || tag.startsWith(`${prefix}-`));
    }).length;
  return { english: count(['en']), chinese: count(['zh', 'cmn', 'yue']), japanese: count(['ja']), korean: count(['ko']), total: voices.length };
}
