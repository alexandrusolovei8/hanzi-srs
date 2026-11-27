import type { Word } from './word.ts';

/**
 * A single Han character, derived from Words (not user-edited, not exported in backups).
 * `inStrokeData` is filled in M5 when Hanzi Writer data availability is checked.
 */
export interface Character {
  readonly hanzi: string;
  readonly pinyin: readonly string[];
  readonly inStrokeData: boolean;
}

const HAN = /\p{Script=Han}/u;

/**
 * Builds one Character per distinct Han character in the given (non-deleted) words.
 * Pinyin is assigned per character only when the word's pinyin has exactly one syllable
 * per Han character (e.g. 你好 / "nǐ hǎo"); otherwise the reading is unknown and skipped.
 * Results are sorted by hanzi for deterministic output.
 */
export function deriveCharacters(words: readonly Word[]): Character[] {
  const readings = new Map<string, Set<string>>();

  for (const word of words) {
    if (word.deletedAt !== undefined) continue;
    // Code-point iteration is correct here: every Han character is a single code point
    // (including astral Extension B+), and non-Han code points are filtered out.
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    const chars = [...word.hanzi].filter((c) => HAN.test(c));
    const syllables = word.pinyin.split(/\s+/).filter((s) => s !== '');
    const aligned = syllables.length === chars.length;

    chars.forEach((char, i) => {
      const set = readings.get(char) ?? new Set<string>();
      const syllable = syllables[i];
      if (aligned && syllable !== undefined) set.add(syllable.toLowerCase());
      readings.set(char, set);
    });
  }

  return [...readings.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([hanzi, pinyin]) => ({ hanzi, pinyin: [...pinyin], inStrokeData: false }));
}
