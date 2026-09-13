import { spawnSync } from 'node:child_process';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const EXCLUDED_PATTERNS = [
  /^scripts\//,
  /^\.github\//,
  /^src\/__tests__\//,
  /^tests\//,
  /\.(test|spec)\.(ts|tsx|js|jsx)$/,
];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
}

function gitOutput(args) {
  const result = run('git', args);
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

function resolveChangedFiles() {
  if (process.argv.length > 2) {
    return process.argv.slice(2);
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  const baseRef = process.env.GITHUB_BASE_REF;

  if (eventName === 'pull_request' && baseRef) {
    run('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseRef], { stdio: 'ignore' });
    const diff = gitOutput(['diff', '--name-only', `origin/${baseRef}...HEAD`]);
    return diff ? diff.split(/\r?\n/) : [];
  }

  const originMain = gitOutput(['rev-parse', '--verify', 'origin/main']);
  if (originMain) {
    const diff = gitOutput(['diff', '--name-only', 'origin/main...HEAD']);
    if (diff) {
      return diff.split(/\r?\n/);
    }
  }

  const previousCommit = gitOutput(['rev-parse', '--verify', 'HEAD^']);
  if (previousCommit) {
    const diff = gitOutput(['diff', '--name-only', 'HEAD^', 'HEAD']);
    return diff ? diff.split(/\r?\n/) : [];
  }

  return [];
}

const lintFiles = resolveChangedFiles().filter((file) => (
  CODE_FILE_PATTERN.test(file)
  && !EXCLUDED_PATTERNS.some((pattern) => pattern.test(file))
));

if (lintFiles.length === 0) {
  console.log('No changed application TypeScript/JavaScript files to lint.');
  process.exit(0);
}

console.log(`Linting ${lintFiles.length} changed application file(s):`);
for (const file of lintFiles) {
  console.log(`- ${file}`);
}

const eslint = run('npx', ['eslint', ...lintFiles], { stdio: 'inherit' });
process.exit(eslint.status ?? 1);
