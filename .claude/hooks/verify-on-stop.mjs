// Stop hook: before Claude finishes a turn, type-check and run the tests related to changed files.
//
// Loop safety (see https://code.claude.com/docs/en/hooks#stop):
// - If nothing relevant changed since the last green run, exit immediately (cheap on chat-only turns).
// - First failure  -> {"decision":"block"} so Claude keeps working and fixes it.
// - If stop_hook_active is true (Claude is already continuing because of this hook) we still check,
//   but never block again: on failure we only warn the user (systemMessage). Max one forced retry.
// - Each tool has its own timeout below the hook timeout in settings.json, so we report instead of being killed.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { git, projectDir, readHookInput, runTool, tail } from './lib.mjs';

const CODE = /\.(ts|tsx|js|mjs|cjs)$/;
const SRC_CODE = /^src\/.*\.(ts|tsx)$/;
// Changes to these affect every test, so run the full suite instead of `vitest related`.
const GLOBAL_CONFIG =
  /^(package(-lock)?\.json|tsconfig(\.\w+)?\.json|vite\.config\.ts|src\/test\/setup\.ts)$/;
const STATE_FILE = path.join(projectDir, 'node_modules/.cache/claude-hooks/last-green.txt');

const input = await readHookInput();
const alreadyContinuing = input.stop_hook_active === true;

// Uncommitted changes = tracked diffs vs HEAD + untracked files (respects .gitignore).
const changed = [
  ...git(['diff', '--name-only', 'HEAD']).split('\n'),
  ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
]
  .map((f) => f.trim())
  .filter((f) => f !== '' && (CODE.test(f) || GLOBAL_CONFIG.test(f)));

if (changed.length === 0) process.exit(0);

// Fingerprint of the changed files (path + mtime + size). Same fingerprint as the last green run -> skip.
const fingerprint = createHash('sha256')
  .update(
    changed
      .sort()
      .map((f) => {
        try {
          const s = statSync(path.join(projectDir, f));
          return `${f}:${s.mtimeMs}:${s.size}`;
        } catch {
          return `${f}:deleted`;
        }
      })
      .join('\n'),
  )
  .digest('hex');

let lastGreen = '';
try {
  lastGreen = readFileSync(STATE_FILE, 'utf8').trim();
} catch {
  // first run
}
if (lastGreen === fingerprint) process.exit(0);

const failures = [];

const tsc = runTool('tsc', ['-b', '--pretty', 'false'], 90_000);
if (!tsc.ok) failures.push(`tsc -b failed:\n${tail(tsc.output)}`);

const runAll = changed.some((f) => GLOBAL_CONFIG.test(f));
const srcFiles = changed.filter((f) => SRC_CODE.test(f) && existsSync(path.join(projectDir, f)));
if (runAll || srcFiles.length > 0) {
  const args = runAll
    ? ['run', '--passWithNoTests']
    : ['related', '--run', '--passWithNoTests', ...srcFiles];
  const vitest = runTool('vitest', args, 120_000);
  if (!vitest.ok) failures.push(`vitest ${args[0]} failed:\n${tail(vitest.output)}`);
}

if (failures.length === 0) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, fingerprint);
  process.exit(0);
}

const report = failures.join('\n\n');
if (alreadyContinuing) {
  // Do not block twice in a row: hand control back to the user with a visible warning.
  process.stdout.write(
    JSON.stringify({
      systemMessage: `Stop hook: checks still failing after one automatic retry.\n${tail(report, 1500)}`,
    }),
  );
} else {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: `Type-check/tests failed for uncommitted changes. Fix them before finishing.\n\n${report}`,
    }),
  );
}
process.exit(0);
