// Shared helpers for Claude Code hooks. Plain Node (no deps) so hooks run the same on Windows and Linux.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());

/** Reads the hook input JSON from stdin. Returns {} if stdin is empty or not JSON. */
export async function readHookInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Project-relative path with forward slashes, or null if the file is outside the project. */
export function toProjectRelative(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return null;
  const rel = path.relative(projectDir, path.resolve(projectDir, filePath));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

const BINS = {
  eslint: 'node_modules/eslint/bin/eslint.js',
  prettier: 'node_modules/prettier/bin/prettier.cjs',
  tsc: 'node_modules/typescript/bin/tsc',
  vitest: 'node_modules/vitest/vitest.mjs',
};

/**
 * Runs a local dev tool with the current Node binary (no shell, no .cmd shims).
 * Returns { ok, output, timedOut }. Never throws.
 */
export function runTool(tool, args, timeoutMs) {
  const bin = path.join(projectDir, BINS[tool]);
  if (!existsSync(bin)) {
    return { ok: false, timedOut: false, output: `${tool} not installed (run npm ci)` };
  }
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const timedOut = result.error?.code === 'ETIMEDOUT';
  if (timedOut) return { ok: false, timedOut, output: `${tool} timed out after ${timeoutMs} ms` };
  return { ok: result.status === 0, timedOut, output };
}

/** Runs git and returns trimmed stdout ('' on failure). */
export function git(args) {
  const result = spawnSync('git', args, { cwd: projectDir, encoding: 'utf8', timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim() : '';
}

/** Keeps the tail of long tool output so hook messages stay readable. */
export function tail(text, maxChars = 4000) {
  return text.length <= maxChars ? text : `…(truncated)\n${text.slice(-maxChars)}`;
}
