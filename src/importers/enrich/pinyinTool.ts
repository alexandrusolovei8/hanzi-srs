import { convert, pinyin } from 'pinyin-pro';

/** Port for pinyin generation, so the preview logic does not depend on pinyin-pro directly. */
export interface PinyinTool {
  /** Pinyin with tone marks for the Chinese characters of `hanzi`, syllables separated by spaces. */
  suggest(hanzi: string): string;
  /** Acceptable readings as syllable lists (tone sandhi variants; all readings of a single char). */
  readings(hanzi: string): string[][];
}

/** Keeps only Han characters: punctuation or Latin letters in the hanzi cell have no pinyin. */
export function hanOnly(text: string): string {
  return (text.match(/\p{Script=Han}/gu) ?? []).join('');
}

/**
 * Variant with the second of two identical consecutive characters in the neutral tone
 * (谢谢 xiè xie, 看看 kàn kan, 星星 xīng xing), which pinyin-pro does not always mark.
 * Returns undefined when the word has no such repetition.
 */
function reduplicatedNeutral(chars: readonly string[], syllables: readonly string[]) {
  const repeated = (i: number) => i > 0 && chars[i] === chars[i - 1];
  if (!syllables.some((_, i) => repeated(i))) return undefined;
  return syllables.map((syllable, i) =>
    repeated(i) ? convert(syllable, { format: 'toneNone' }) : syllable,
  );
}

/**
 * pinyin-pro adapter. Its default applies 一/不 tone sandhi (`bú shì`); textbooks write either
 * form, so the citation tones (`toneSandhi: false`) are accepted too. Neutral tones are accepted
 * only where a reading marks them: pinyin-pro's own (妈妈 mā ma) plus reduplicated characters.
 */
export const pinyinProTool: PinyinTool = {
  suggest(hanzi) {
    return pinyin(hanOnly(hanzi));
  },

  readings(hanzi) {
    const han = hanOnly(hanzi);
    if (han === '') return [];
    // Code points, not UTF-16 units: rare characters (Extension B+) take two units.
    const chars = Array.from(han);
    const variants = [
      pinyin(han, { type: 'array' }),
      pinyin(han, { type: 'array', toneSandhi: false }),
    ];
    for (const variant of [...variants]) {
      const neutral = reduplicatedNeutral(chars, variant);
      if (neutral) variants.push(neutral);
    }
    if (chars.length === 1) {
      variants.push(...pinyin(han, { type: 'array', multiple: true }).map((s) => [s]));
    }
    const unique = new Map(variants.map((v) => [v.join(' '), v]));
    return [...unique.values()];
  },
};
