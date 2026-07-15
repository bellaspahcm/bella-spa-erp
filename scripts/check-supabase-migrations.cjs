const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const MIGRATION_FILE_PATTERN = /^(\d{14})_.+\.sql$/;

function listLocalMigrationVersions(migrationsDir = join(process.cwd(), 'supabase', 'migrations')) {
  return readdirSync(migrationsDir)
    .map((name) => name.match(MIGRATION_FILE_PATTERN)?.[1] || null)
    .filter(Boolean)
    .sort();
}

function parseSupabaseMigrationList(output) {
  const rows = [];

  for (const line of String(output || '').split(/\r?\n/)) {
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
    isSynced: pendingLocal.length === 0,
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

  const localVersions = listLocalMigrationVersions();
  if (localVersions.length === 0) {
    console.error('No local Supabase migrations found.');
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
    console.error('Run `npx supabase db push --linked --yes` or apply the missing migrations before deploy.');
    process.exit(1);
  }

  console.log('Supabase migrations are in sync.');
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeMigrationState,
  listLocalMigrationVersions,
  parseSupabaseMigrationList,
};
