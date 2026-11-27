// PostToolUse hook (Edit|Write): format the edited file with Prettier, then ESLint --fix it.
// Exit 0 = clean. Exit 2 = lint errors remain; stderr is shown to Claude so it fixes them.
// PostToolUse cannot undo the edit; it only reports.
import { readHookInput, runTool, tail, toProjectRelative } from './lib.mjs';

const LINTABLE = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIP = /^(node_modules|dist|dev-dist|coverage)\//;

const input = await readHookInput();
const file = toProjectRelative(input.tool_input?.file_path);

if (file === null || SKIP.test(file)) process.exit(0);

// --ignore-unknown: silently skip file types Prettier can't format; .prettierignore is honored.
const prettier = runTool(
  'prettier',
  ['--write', '--ignore-unknown', '--log-level', 'warn', file],
  30_000,
);
if (!prettier.ok) {
  process.stderr.write(`Prettier failed on ${file}:\n${tail(prettier.output)}\n`);
  process.exit(2);
}

if (LINTABLE.test(file)) {
  const eslint = runTool(
    'eslint',
    ['--fix', '--max-warnings', '0', '--no-warn-ignored', file],
    45_000,
  );
  if (!eslint.ok) {
    process.stderr.write(
      `ESLint problems remain in ${file} after --fix:\n${tail(eslint.output)}\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
