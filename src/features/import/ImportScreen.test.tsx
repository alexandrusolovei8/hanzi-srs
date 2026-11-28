import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setupRepos, unwrap } from '../../db/test-utils/setup.ts';
import ImportScreen from './ImportScreen.tsx';

function csvFile(content: BlobPart[], name = 'lesson-1.csv') {
  return new File(content, name, { type: 'text/csv' });
}

async function renderScreen(
  setupDeck?: (repos: ReturnType<typeof setupRepos>['repos']) => Promise<void>,
) {
  const ctx = setupRepos();
  await setupDeck?.(ctx.repos);
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<ImportScreen repos={ctx.repos} onClose={onClose} />);
  // Wait until decks are loaded (the select becomes enabled).
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: '2. Deck' })).toBeEnabled();
  });
  return { ...ctx, user, onClose };
}

async function choose(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('1. CSV file'), file);
  await user.click(screen.getByRole('button', { name: 'Preview' }));
}

const rowFor = (hanzi: string) => {
  const cell = screen.getByRole('cell', { name: hanzi });
  const row = cell.closest('tr');
  if (!row) throw new Error(`no row for ${hanzi}`);
  return within(row);
};

describe('ImportScreen step 1', () => {
  it('offers a Safari/Files-friendly file picker and downloadable templates', async () => {
    await renderScreen();
    const input = screen.getByLabelText('1. CSV file');
    expect(input).toHaveAttribute('type', 'file');
    expect(input.getAttribute('accept')).toContain('.csv');
    expect(input.getAttribute('accept')).toContain('text/csv');
    const template = screen.getByRole('link', { name: 'Template (comma)' });
    expect(template).toHaveAttribute('download');
    expect(template.getAttribute('href')).toMatch(/templates\/hanzi-srs-template\.csv$/u);
  });

  it('defaults to a new deck named after the file when there are no decks', async () => {
    const { user } = await renderScreen();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    await user.upload(screen.getByLabelText('1. CSV file'), csvFile(['hanzi\n你好']));
    expect(screen.getByLabelText('New deck name')).toHaveValue('lesson-1');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
  });

  it('rejects a non-UTF-8 file with a clear message and imports nothing', async () => {
    const { user, db } = await renderScreen();
    await choose(user, csvFile(['hanzi\n', new Uint8Array([0xc4, 0xe3, 0xba, 0xc3])]));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('not UTF-8');
    expect(alert).toHaveTextContent('CSV UTF-8');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(await db.decks.count()).toBe(0);
  });

  it('explains a missing hanzi column', async () => {
    const { user } = await renderScreen();
    await choose(user, csvFile(['pinyin,meaning\nnǐ,you']));
    expect(await screen.findByRole('alert')).toHaveTextContent('no "hanzi" column');
  });
});

describe('ImportScreen step 2', () => {
  const sample = [
    '﻿hanzi;pinyin;meaning;tags',
    '你好;nǐ hǎo;hello;greeting|hsk1',
    '朋友;;friend;',
    '学习;xuéxi;to study;',
    'abc;;not chinese;',
    '你好;nǐ hǎo;again;',
  ].join('\r\n');

  it('shows every row with a text status, a summary, and imports into a new deck', async () => {
    const { user, repos } = await renderScreen();
    await choose(user, csvFile([sample]));

    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary: 5 rows' })).toBeInTheDocument();

    expect(rowFor('朋友').getByText('generated')).toBeInTheDocument();
    expect(rowFor('学习').getByText('Warning')).toBeInTheDocument();
    expect(rowFor('abc').getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Same hanzi as line 2; skipped.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 3 words' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Imported into lesson-1');
    expect(status).toHaveTextContent('Added: 3');

    const [deck] = await repos.decks.list();
    const words = await repos.words.listByDeck(deck?.id ?? '');
    expect(words.map((w) => [w.hanzi, w.pinyin])).toEqual([
      ['你好', 'nǐ hǎo'],
      ['朋友', 'péng yǒu'],
      ['学习', 'xuéxi'],
    ]);
  });

  it('uses the suggestion for one row on request', async () => {
    const { user } = await renderScreen();
    await choose(user, csvFile([sample]));
    await user.click(await screen.findByRole('button', { name: 'Use suggestion xué xí for 学习' }));

    const row = rowFor('学习');
    expect(row.getByText('xué xí')).toBeInTheDocument();
    expect(row.queryByText('Warning')).not.toBeInTheDocument();
    expect(row.queryByRole('button', { name: /Use suggestion/u })).not.toBeInTheDocument();
  });

  it('skips changed words unless "update the changed words" is ticked', async () => {
    let deckId = '';
    const { user, repos } = await renderScreen(async (r) => {
      deckId = unwrap(await r.decks.create('HSK 1')).id;
      unwrap(
        await r.imports.commit(
          { kind: 'existing', deckId },
          [
            {
              hanzi: '你好',
              pinyin: 'nǐ hǎo',
              meaning: 'hello',
              tags: [],
              provided: { pinyin: true, meaning: true, tags: true },
            },
          ],
          { updateChanged: false },
        ),
      );
    });
    expect(screen.getByRole('combobox', { name: '2. Deck' })).toHaveValue(deckId);

    await choose(user, csvFile(['hanzi,meaning\n你好,hi there']));
    expect(await rowFor('你好').findByText('Changed')).toBeInTheDocument();
    expect(screen.getByText('Already in this deck; differs in meaning.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 words' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Update the changed words \(1\)/u }));
    await user.click(screen.getByRole('button', { name: 'Import 1 word' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Updated: 1');
    expect((await repos.words.listByDeck(deckId))[0]?.meaning).toBe('hi there');
  });

  it('importing the same file twice creates no duplicates', async () => {
    const { user, db } = await renderScreen(async (r) => {
      unwrap(await r.decks.create('HSK 1'));
    });
    const file = csvFile(['hanzi,pinyin\n你好,nǐ hǎo\n谢谢,xièxie']);
    await choose(user, file);
    await user.click(await screen.findByRole('button', { name: 'Import 2 words' }));
    await user.click(await screen.findByRole('button', { name: 'Import another file' }));

    await choose(user, file);
    expect(await screen.findByRole('heading', { name: 'Summary: 2 rows' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 words' })).toBeDisabled();
    expect(await db.words.count()).toBe(2);
  });

  it('goes back to step 1 and closes', async () => {
    const { user, onClose } = await renderScreen();
    await choose(user, csvFile(['hanzi\n你好']));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows an error and stays on the preview when the commit fails', async () => {
    const { user, repos } = await renderScreen();
    await choose(user, csvFile(['hanzi\n你好']));
    vi.spyOn(repos.imports, 'commit').mockResolvedValueOnce({
      ok: false,
      error: { kind: 'not-found', id: 'x' },
    });
    await user.click(await screen.findByRole('button', { name: 'Import 1 word' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was imported');
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
  });
});
