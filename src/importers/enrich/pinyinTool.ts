import { pinyin } from 'pinyin-pro';

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
 * pinyin-pro adapter. Its default applies 一/不 tone sandhi (`bú shì`); textbooks write either
 * form, so the citation tones (`toneSandhi: false`) are accepted too.
 */
export const pinyinProTool: PinyinTool = {
  suggest(hanzi) {
    return pinyin(hanOnly(hanzi));
  },

  readings(hanzi) {
    const han = hanOnly(hanzi);
    if (han === '') return [];
    const variants = [
      pinyin(han, { type: 'array' }),
      pinyin(han, { type: 'array', toneSandhi: false }),
    ];
    // Count code points, not UTF-16 units: rare characters (Extension B+) take two units.
    if (Array.from(han).length === 1) {
      variants.push(...pinyin(han, { type: 'array', multiple: true }).map((s) => [s]));
    }
    const unique = new Map(variants.map((v) => [v.join(' '), v]));
    return [...unique.values()];
  },
};
