import { Vocabulary } from '@/types';
import { normalizeWord } from './normalizeWord';

export type CardMode = 'classic' | 'reverse' | 'cloze' | 'typing';
export type StudyMode = CardMode | 'mixed';

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  mixed: 'Mixed (recommended)',
  classic: 'Word → meaning',
  reverse: 'Meaning → word',
  cloze: 'Fill in the blank',
  typing: 'Type the word',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches the word (and simple inflections for single words) inside its example. */
function wordPattern(word: string): RegExp {
  const parts = word.trim().split(/\s+/).map(escapeRegExp);
  const body = parts.length === 1 ? `${parts[0]}\\w{0,3}` : parts.join('\\s+');
  return new RegExp(`\\b${body}\\b`, 'i');
}

/** Returns the example with the target word replaced by a blank, or null if it does not appear. */
export function maskExample(vocab: Vocabulary): string | null {
  if (!vocab.example) return null;
  const pattern = wordPattern(vocab.word);
  return pattern.test(vocab.example) ? vocab.example.replace(pattern, '_____') : null;
}

export function isCorrectAnswer(input: string, vocab: Vocabulary): boolean {
  return normalizeWord(input) === normalizeWord(vocab.word);
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result;
}

/** Picks how a card is presented. Mixed mode keeps brand-new words simple, then rotates formats. */
export function pickCardMode(vocab: Vocabulary, mode: StudyMode): CardMode {
  const resolved: CardMode = mode === 'mixed'
    ? vocab.repetitions === 0
      ? 'classic'
      : (['reverse', 'cloze', 'typing', 'classic'] as const)[hash(`${vocab.id}:${vocab.repetitions}`) % 4]
    : mode;
  if (resolved === 'cloze' && !maskExample(vocab)) return 'reverse';
  return resolved;
}
