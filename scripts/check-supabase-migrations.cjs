/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const MIGRATION_FILE_PATTERN = /^(\d{14})_.+\.sql$/;
const SQL_FILE_PATTERN = /\.sql$/;

function listLocalMigrationFiles(migrationsDir = join(process.cwd(), 'supabase', 'migrations')) {
  return readdirSync(migrationsDir)
    .filter((name) => SQL_FILE_PATTERN.test(name))
    .sort();
}

function listLocalMigrationVersions(migrationsDir = join(process.cwd(), 'supabase', 'migrations')) {
  return listLocalMigrationFiles(migrationsDir)
    .map((name) => name.match(MIGRATION_FILE_PATTERN)?.[1] || null)
    .filter(Boolean)
    .sort();
}

function findInvalidMigrationFilenames(filenames) {
  return filenames
    .filter((name) => !MIGRATION_FILE_PATTERN.test(name))
    .sort();
}

function findDuplicateMigrationVersions(versions) {
  const counts = new Map();
  for (const version of versions) {
    counts.set(version, (counts.get(version) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([version]) => version)
    .sort();
}

function parseSupabaseMigrationList(output) {
  const text = String(output || '').trim();
  if (!text) return [];

  const jsonStart = text.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      if (Array.isArray(parsed.migrations)) {
        return parsed.migrations.map((row) => ({
          local: row.local || null,
          remote: row.remote || null,
        }));
      }
    } catch {
      // Fall back to the legacy pipe-table parser below.
    }
  }

  const rows = [];

  for (const line of text.split(/\r?\n/)) {
    const columns = line.split('|').map((column) => column.trim());
    if (columns.length < 2) continue;

    const localMatch = columns[0].match(/^(\d{14})/);
    const remoteMatch = columns[1].match(/^(\d{14})/);
    const local = localMatch ? localMatch[1] : null;
    const remote = remoteMatch ? remoteMatch[1] : null;
    if (!local && !remote) continue;

    rows.push({ local, remote });
  }

  return rows;
}

function analyzeMigrationState(localVersions, remoteVersions) {
  const localSet = new Set(localVersions);
  const remoteSet = new Set(remoteVersions);
  const pendingLocal = localVersions.filter((version) => !remoteSet.has(version));
  const remoteOnly = remoteVersions.filter((version) => !localSet.has(version));

  return {
    latestLocal: localVersions.at(-1) || null,
    latestRemote: remoteVersions.at(-1) || null,
    pendingLocal,
    remoteOnly,
    isSynced: pendingLocal.length === 0 && remoteOnly.length === 0,
  };
}

function getNpxInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx.cmd', ...args],
    };
  }

  return {
    command: 'npx',
    args,
  };
}

function getSupabaseMigrationListArgs() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  const args = ['--yes', 'supabase', 'migration', 'list'];

  if (dbUrl) {
    return [...args, '--db-url', dbUrl];
  }

  return [...args, '--linked'];
}

function runSupabaseMigrationList() {
  const invocation = getNpxInvocation(getSupabaseMigrationListArgs());
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    throw new Error(output || result.error?.message || 'Supabase migration list failed');
  }

  return output;
}

function printState(state) {
  console.log(`Local latest migration: ${state.latestLocal || 'none'}`);
  console.log(`Remote latest migration: ${state.latestRemote || 'none'}`);
}

function main() {
  const hasDbUrl = Boolean(process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL);
  const optional = process.env.DB_MIGRATION_CHECK_OPTIONAL === '1';

  if (!hasDbUrl && optional) {
    console.log('Supabase migration check skipped: SUPABASE_DB_URL is not configured.');
    return;
  }

  const localFiles = listLocalMigrationFiles();
  if (localFiles.length === 0) {
    console.error('No local Supabase migrations found.');
    process.exit(1);
  }

  const invalidLocalFilenames = findInvalidMigrationFilenames(localFiles);
  if (invalidLocalFilenames.length > 0) {
    console.error('Local Supabase migrations use invalid filenames. Expected YYYYMMDDHHMMSS_name.sql:');
    for (const filename of invalidLocalFilenames) {
      console.error(`- ${filename}`);
    }
    process.exit(1);
  }

  const localVersions = listLocalMigrationVersions();
  const duplicateLocalVersions = findDuplicateMigrationVersions(localVersions);
  if (duplicateLocalVersions.length > 0) {
    console.error('Local Supabase migrations contain duplicate versions:');
    for (const version of duplicateLocalVersions) {
      console.error(`- ${version}`);
    }
    process.exit(1);
  }

  let rows;
  try {
    rows = parseSupabaseMigrationList(runSupabaseMigrationList());
  } catch (error) {
    console.error('Could not read remote Supabase migrations.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const remoteVersions = rows.map((row) => row.remote).filter(Boolean).sort();
  const state = analyzeMigrationState(localVersions, remoteVersions);
  printState(state);

  if (state.pendingLocal.length > 0) {
    console.error('Remote Supabase database is missing local migrations:');
    for (const version of state.pendingLocal) {
      console.error(`- ${version}`);
    }
  }

  if (state.remoteOnly.length > 0) {
    console.error('Remote Supabase database has migrations missing from this repository:');
    for (const version of state.remoteOnly) {
      console.error(`- ${version}`);
    }
  }

  if (!state.isSynced) {
    console.error('Reconcile local filenames/versions, remote migration history, and remote schema reality before applying or repairing migrations.');
    process.exit(1);
  }

  console.log('Supabase migrations are in sync.');
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeMigrationState,
  findDuplicateMigrationVersions,
  findInvalidMigrationFilenames,
  listLocalMigrationFiles,
  listLocalMigrationVersions,
  parseSupabaseMigrationList,
};