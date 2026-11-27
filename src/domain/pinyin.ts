/**
 * Pure pinyin comparison helpers (no dictionary here: readings are passed in by the caller).
 *
 * Pinyin is reduced to a format-independent form: lowercase base letters (ü → `v`) plus the
 * positions of tone marks. That makes `nǐ hǎo`, `Ni3 hao3`, `nǐhǎo` and `ni3hao3` all equal.
 */

const TONE_VOWELS: Readonly<Record<string, readonly [string, number]>> = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['v', 1], ǘ: ['v', 2], ǚ: ['v', 3], ǜ: ['v', 4],
  ü: ['v', 0],
}; // prettier-ignore

/** Characters that separate syllables but carry no sound. */
const SEPARATORS = /[\s'’\-.·]/u;

export interface ToneMark {
  /** Index into `letters` of the letter the tone belongs to. */
  readonly index: number;
  readonly tone: number;
}

export interface ParsedPinyin {
  /** Base letters only, lowercase, `ü` as `v`, no separators. */
  readonly letters: string;
  /** Tones 1–4 in order. Neutral tone (no mark, `0` or `5`) is not recorded. */
  readonly tones: readonly ToneMark[];
}

/** Parses pinyin written with tone marks or tone numbers. Unknown characters are kept as letters. */
export function parsePinyin(text: string): ParsedPinyin {
  const input = text.normalize('NFC').toLowerCase().replaceAll('u:', 'ü');
  let letters = '';
  const tones: ToneMark[] = [];

  for (const char of input) {
    const marked = TONE_VOWELS[char];
    if (marked) {
      letters += marked[0];
      if (marked[1] > 0) tones.push({ index: letters.length - 1, tone: marked[1] });
    } else if (char >= '1' && char <= '4') {
      // Tone number closes the syllable: attach it to the previous letter.
      if (letters.length > 0) tones.push({ index: letters.length - 1, tone: Number(char) });
    } else if (char === '0' || char === '5' || SEPARATORS.test(char)) {
      continue;
    } else {
      letters += char;
    }
  }
  return { letters, tones };
}

/** True if both strings spell the same syllables with the same tones, ignoring format. */
export function samePinyin(a: string, b: string): boolean {
  const pa = parsePinyin(a);
  const pb = parsePinyin(b);
  return (
    pa.letters === pb.letters &&
    pa.tones.length === pb.tones.length &&
    pa.tones.every((t, i) => t.tone === pb.tones[i]?.tone)
  );
}

export type PinyinCheck = 'match' | 'no-tones' | 'mismatch';

/**
 * Compares user-provided pinyin against candidate readings (each a list of syllables, e.g.
 * `[['bú', 'shì'], ['bù', 'shì']]`). Never changes anything: the caller decides how to warn.
 *
 * - `no-tones`: same syllables as a reading, but no tone marks at all.
 * - `match`: same syllables and tones as some reading. A missing tone on a non-first syllable is
 *   accepted, because textbooks write the neutral tone there (`xièxie`, `péngyou`).
 * - `mismatch`: anything else (wrong syllable, missing syllable, wrong tone).
 */
export function checkPinyin(
  received: string,
  readings: readonly (readonly string[])[],
): PinyinCheck {
  const r = parsePinyin(received);
  if (readings.some((syllables) => matchesReading(r, syllables))) return 'match';
  if (r.tones.length > 0) return 'mismatch';
  const lettersMatch = readings.some(
    (syllables) => syllables.map((s) => parsePinyin(s).letters).join('') === r.letters,
  );
  return lettersMatch ? 'no-tones' : 'mismatch';
}

function matchesReading(received: ParsedPinyin, syllables: readonly string[]): boolean {
  let start = 0;
  let letters = '';
  const expected: { start: number; end: number; tone: number | undefined }[] = [];
  for (const syllable of syllables) {
    const parsed = parsePinyin(syllable);
    letters += parsed.letters;
    expected.push({ start, end: letters.length, tone: parsed.tones[0]?.tone });
    start = letters.length;
  }
  if (letters !== received.letters) return false;

  return expected.every((syl, i) => {
    const tones = received.tones.filter((t) => t.index >= syl.start && t.index < syl.end);
    if (tones.length > 1) return false;
    const tone = tones[0]?.tone;
    if (tone === undefined) return syl.tone === undefined || i > 0;
    return tone === syl.tone;
  });
}
