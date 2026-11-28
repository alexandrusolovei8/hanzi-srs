import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { setupRepos } from './db/test-utils/setup.ts';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hanzi SRS' })).toBeInTheDocument();
  });

  it('opens the lazily loaded import screen and returns home', async () => {
    const user = userEvent.setup();
    render(<App repos={setupRepos().repos} />);
    await user.click(screen.getByRole('button', { name: 'Import words' }));
    expect(await screen.findByRole('heading', { name: 'Import words' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('heading', { name: 'Hanzi SRS' })).toBeInTheDocument();
  });
});
