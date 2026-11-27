import { describe, expect, it } from 'vitest';
import { fakeDeps } from '../domain/test-utils/fakes.ts';
import { createWord, type Word } from '../domain/word.ts';
import { csvImporter } from './csv/csvImporter.ts';
import pinyinErrors from './csv/__fixtures__/pinyin-errors.csv?raw';
import rowProblems from './csv/__fixtures__/row-problems.csv?raw';
import { pinyinProTool } from './enrich/pinyinTool.ts';
import {
  buildPreview,
  candidatesToCommit,
  pinyinSuggestion,
  withPinyin,
  type PreviewContext,
} from './preview.ts';
import type { RawEntry } from './types.ts';

function parse(text: string): RawEntry[] {
  const result = csvImporter.parse(text);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const deps = fakeDeps();

function word(hanzi: string, pinyin: string, meaning: string, tags: string[] = []): Word {
  const w = createWord(deps, {
    deckId: 'deck',
    hanzi,
    pinyin,
    meaning,
    meaningSource: 'user',
    tags,
  });
  if (!w.ok) throw new Error('fixture');
  return w.value;
}

function ctx(overrides: Partial<PreviewContext> = {}): PreviewContext {
  return { existing: [], deletedHanzi: new Set(), pinyin: pinyinProTool, ...overrides };
}

describe('buildPreview: pinyin quality', () => {
  const rows = buildPreview(parse(pinyinErrors), ctx()).rows;
  const warningsOf = (hanzi: string) => rows.find((r) => r.entry.hanzi === hanzi)?.warnings;

  it('flags pinyin of another word, with the suggestion', () => {
    expect(warningsOf('你好')).toEqual([{ kind: 'pinyin-mismatch', suggested: 'nǐ hǎo' }]);
  });

  it('flags pinyin without tone marks', () => {
    expect(warningsOf('谢谢')).toEqual([{ kind: 'pinyin-no-tones', suggested: 'xiè xiè' }]);
  });

  it('flags an omitted syllable and a wrong tone', () => {
    expect(warningsOf('学生')).toEqual([{ kind: 'pinyin-mismatch', suggested: 'xué shēng' }]);
    expect(warningsOf('朋友')).toEqual([{ kind: 'pinyin-mismatch', suggested: 'péng yǒu' }]);
  });

  it('accepts both tone-sandhi forms of 不 and 一, and numbered pinyin', () => {
    for (const hanzi of ['不是', '不对', '一个', '一天', '你们']) {
      expect(warningsOf(hanzi), hanzi).toEqual([]);
    }
  });

  it('accepts a neutral tone only where the reference marks it', () => {
    expect(warningsOf('妈妈')).toEqual([]);
    expect(warningsOf('学习')).toEqual([{ kind: 'pinyin-mismatch', suggested: 'xué xí' }]);
    const [xiexie] = buildPreview(parse('hanzi,pinyin\n谢谢,xièxie'), ctx()).rows;
    expect(xiexie?.warnings).toEqual([]);
  });

  it('never overwrites the pinyin from the file', () => {
    const row = rows.find((r) => r.entry.hanzi === '你好');
    expect(row?.candidate?.pinyin).toBe('xièxie');
    expect(row?.pinyinGenerated).toBe(false);
  });
});

describe('buildPreview: row problems', () => {
  const preview = buildPreview(parse(rowProblems), ctx());
  const byLine = (line: number) => preview.rows.find((r) => r.entry.line === line);

  it('marks rows without hanzi or without Chinese characters as errors', () => {
    expect(byLine(2)).toMatchObject({ status: 'error', errors: [{ kind: 'missing-hanzi' }] });
    expect(byLine(3)).toMatchObject({
      status: 'error',
      errors: [{ kind: 'no-han', hanzi: 'hello' }],
    });
    expect(byLine(2)?.candidate).toBeUndefined();
  });

  it('warns about non-Chinese characters but still imports the row', () => {
    expect(byLine(4)).toMatchObject({
      status: 'new',
      warnings: [{ kind: 'non-han', chars: ['!'] }],
      candidate: { hanzi: '你好!', pinyin: 'nǐ hǎo' },
    });
  });

  it('keeps the first of two rows with the same hanzi', () => {
    expect(byLine(5)?.status).toBe('new');
    expect(byLine(6)).toMatchObject({ status: 'duplicate', duplicateOfLine: 5 });
    expect(byLine(6)?.candidate).toBeUndefined();
  });

  it('rejects rows with cells beyond the header', () => {
    expect(byLine(7)).toMatchObject({
      status: 'error',
      errors: [{ kind: 'extra-cells', count: 2 }],
    });
  });

  it('generates missing pinyin and leaves a missing meaning empty', () => {
    expect(byLine(8)).toMatchObject({
      status: 'new',
      pinyinGenerated: true,
      warnings: [],
      candidate: {
        hanzi: '朋友',
        pinyin: 'péng yǒu',
        meaning: '',
        tags: [],
        provided: { pinyin: false, meaning: false, tags: false },
      },
    });
  });

  it('summarizes the statuses', () => {
    expect(preview.summary).toEqual({
      total: 7,
      byStatus: { new: 3, restore: 0, duplicate: 1, changed: 0, error: 3 },
      withWarnings: 1,
    });
  });
});

describe('buildPreview: against saved words', () => {
  const saved = word('你好', 'nǐ hǎo', 'hello', ['hsk1']);
  const context = ctx({ existing: [saved], deletedHanzi: new Set(['学生']) });

  it('marks an identical saved word as duplicate', () => {
    const [row] = buildPreview(parse('hanzi,pinyin,meaning\n 你好 ,ni3hao3,hello'), context).rows;
    expect(row).toMatchObject({ status: 'duplicate', existingWordId: saved.id });
  });

  it('ignores fields the file leaves empty (no overwrite with generated pinyin)', () => {
    const [row] = buildPreview(parse('hanzi,pinyin,meaning\n你好,,'), context).rows;
    expect(row?.status).toBe('duplicate');
  });

  it('marks a saved word with different data as changed, listing the fields', () => {
    const [row] = buildPreview(parse('hanzi,meaning,tags\n你好,hi,hsk1|greeting'), context).rows;
    expect(row).toMatchObject({
      status: 'changed',
      changedFields: ['meaning', 'tags'],
      existingWordId: saved.id,
    });
  });

  it('marks a soft-deleted word as restore', () => {
    const [row] = buildPreview(parse('hanzi\n学生'), context).rows;
    expect(row?.status).toBe('restore');
  });
});

describe('candidatesToCommit', () => {
  const saved = word('你好', 'nǐ hǎo', 'hello');
  const preview = buildPreview(
    parse('hanzi,meaning\n你好,hi\n谢谢,thanks\n学生,student\nabc,x\n谢谢,again'),
    ctx({ existing: [saved], deletedHanzi: new Set(['学生']) }),
  );

  it('takes new and restored rows, skipping changed ones by default', () => {
    expect(candidatesToCommit(preview, { updateChanged: false }).map((c) => c.hanzi)).toEqual([
      '谢谢',
      '学生',
    ]);
  });

  it('includes changed rows when the user opts in', () => {
    expect(candidatesToCommit(preview, { updateChanged: true }).map((c) => c.hanzi)).toEqual([
      '你好',
      '谢谢',
      '学生',
    ]);
  });
});

describe('use suggestion', () => {
  it('replaces the pinyin of one row so its warning disappears', () => {
    const entries = parse('hanzi,pinyin\n你好,xièxie\n谢谢,xie xie\n朋友,péng yǒu');
    const preview = buildPreview(entries, ctx());
    const [first, second, third] = preview.rows;
    expect(first && pinyinSuggestion(first)).toBe('nǐ hǎo');
    expect(second && pinyinSuggestion(second)).toBe('xiè xiè');
    expect(third && pinyinSuggestion(third)).toBeUndefined();

    const fixed = withPinyin(entries, 2, 'nǐ hǎo');
    expect(fixed[1]).toEqual(entries[1]);
    const rebuilt = buildPreview(fixed, ctx()).rows[0];
    expect(rebuilt?.warnings).toEqual([]);
    expect(rebuilt?.candidate?.pinyin).toBe('nǐ hǎo');
  });
});
