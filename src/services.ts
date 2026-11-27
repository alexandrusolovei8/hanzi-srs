// Composition root: wires the real database and platform ports. Tests build their own repositories.
import { createDb } from './db/database.ts';
import { createRepositories, type Repositories } from './db/repositories/index.ts';
import { systemDeps } from './platform/system.ts';

let repositories: Repositories | undefined;

/** The app-wide repositories, created on first use (opening IndexedDB is lazy anyway). */
export function getRepositories(): Repositories {
  repositories ??= createRepositories(createDb(), systemDeps);
  return repositories;
}
