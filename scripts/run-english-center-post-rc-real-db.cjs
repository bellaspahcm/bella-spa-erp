const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');

const dotenv = require('dotenv');

const CANONICAL_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';

function loadEnvFile(filePath, { required }) {
  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    if (!required) {
      return '';
    }

    throw new Error(`English Real DB env file not found: ${filePath}`);
  }

  const result = dotenv.config({
    path: resolvedPath,
    override: true,
    quiet: true,
  });

  if (result.error) {
    throw new Error(`Failed to load English Real DB env file ${filePath}: ${result.error.message}`);
  }

  return resolvedPath;
}

function loadE2eEnv() {
  if (process.env.E2E_ENV_FILE) {
    return loadEnvFile(process.env.E2E_ENV_FILE, { required: true });
  }

  const tempE2eEnvPath = resolve(tmpdir(), 'bella-spa-e2e.env');
  if (existsSync(tempE2eEnvPath)) {
    return loadEnvFile(tempE2eEnvPath, { required: true });
  }

  return loadEnvFile('.env.e2e', { required: false });
}

function projectRefFromSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const [projectRef] = url.hostname.split('.');
    return projectRef || '';
  } catch {
    return '';
  }
}

function dbUrlTargetsProject(value, projectRef) {
  try {
    const url = new URL(value);
    return url.hostname.includes(projectRef) || decodeURIComponent(url.username).includes(projectRef);
  } catch {
    return false;
  }
}

function runnableDbUrl() {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DB_URL ||
    '';

  if (process.env.DB_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DB_URL;
  }

  if (process.env.SUPABASE_DB_URL && !process.env.SUPABASE_DATABASE_URL) {
    process.env.SUPABASE_DATABASE_URL = process.env.SUPABASE_DB_URL;
  }

  if (!dbUrl.trim()) {
    throw new Error(
      [
        'Missing English Real DB Postgres URL for canonical E2E project.',
        'Provide DATABASE_URL or SUPABASE_DATABASE_URL for Supabase project bmnbqbcdbuklhopfbopv via secure local env.',
        'Do not commit the connection string.',
      ].join(' ')
    );
  }

  if (!dbUrlTargetsProject(dbUrl, CANONICAL_E2E_PROJECT_REF)) {
    throw new Error(
      [
        'Refusing to run English Real DB validation against a non-canonical database target.',
        `Expected Postgres URL for Supabase project ${CANONICAL_E2E_PROJECT_REF}.`,
      ].join(' ')
    );
  }

  return dbUrl;
}

const loadedEnvPath = loadE2eEnv();
const supabaseProjectRef = projectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');

if (supabaseProjectRef !== CANONICAL_E2E_PROJECT_REF) {
  throw new Error(
    [
      'Refusing to run English Real DB validation against a non-canonical Supabase API target.',
      `Expected ${CANONICAL_E2E_PROJECT_REF}, got ${supabaseProjectRef || 'unknown'}.`,
    ].join(' ')
  );
}

console.log(`English Real DB env: ${loadedEnvPath || 'process environment'}`);
console.log(`English Real DB target project: ${CANONICAL_E2E_PROJECT_REF}`);

runnableDbUrl();

const result = spawnSync(
  'npx',
  [
    'jest',
    '--config',
    'jest.real-db.config.ts',
    'src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts',
    '--runInBand',
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
