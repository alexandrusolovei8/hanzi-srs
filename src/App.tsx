import { lazy, Suspense, useState } from 'react';
import type { Repositories } from './db/repositories/index.ts';
import { getRepositories } from './services.ts';

// Lazy: the importer chunk carries pinyin-pro, which the home screen does not need.
const ImportScreen = lazy(() => import('./features/import/ImportScreen.tsx'));

type Screen = 'home' | 'import';

interface AppProps {
  /** Injectable for tests; the real IndexedDB-backed repositories by default. */
  readonly repos?: Pick<Repositories, 'decks' | 'imports'>;
}

export function App({ repos }: AppProps) {
  const [screen, setScreen] = useState<Screen>('home');

  if (screen === 'import') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col p-4">
        <Suspense fallback={<p role="status">Loading importer…</p>}>
          <ImportScreen
            repos={repos ?? getRepositories()}
            onClose={() => {
              setScreen('home');
            }}
          />
        </Suspense>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-3xl font-bold">Hanzi SRS</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-300">汉字 · spaced repetition</p>
      <button
        type="button"
        onClick={() => {
          setScreen('import');
        }}
        className="min-h-11 rounded-lg bg-red-700 px-6 font-semibold text-white"
      >
        Import words
      </button>
    </main>
  );
}
