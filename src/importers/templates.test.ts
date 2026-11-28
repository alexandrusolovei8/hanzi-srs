import { describe, expect, it } from 'vitest';
import { decodeUtf8 } from './decode.ts';
import { csvImporter } from './csv/csvImporter.ts';
import commaTemplate from '../../public/templates/hanzi-srs-template.csv?raw';
import semicolonTemplate from '../../public/templates/hanzi-srs-template-semicolon.csv?raw';

// The downloadable templates must always import cleanly (guards against format drift).
describe('downloadable templates', () => {
  it.each([
    ['comma', commaTemplate],
    ['semicolon', semicolonTemplate],
  ])('%s template has a BOM and imports without errors', (_, text) => {
    expect(text.startsWith('\uFEFF')).toBe(true);
    const decoded = decodeUtf8(new TextEncoder().encode(text));
    const result = decoded.ok ? csvImporter.parse(decoded.value) : decoded;
    expect(result).toEqual({
      ok: true,
      value: [
        { line: 2, hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', tags: ['greeting', 'hsk1'] },
        { line: 3, hanzi: '谢谢', pinyin: 'xièxie', meaning: 'thank you' },
        { line: 4, hanzi: '朋友', meaning: 'friend', tags: ['people'] },
      ],
    });
  });
});
