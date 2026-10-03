const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { basename } = require('node:path');
const { Client } = require('pg');

const MIGRATION_PATH = /^supabase\/migrations\/(\d{14})_(.+)\.sql$/;

function parseArgs(argv) {
  const baseIndex = argv.indexOf('--base');
  const dryRun = argv.includes('--dry-run');
  return {
    baseRef: baseIndex >= 0 ? argv[baseIndex + 1] : process.env.BASE_REF || 'HEAD^',
    dryRun,
  };
}

function gitLines(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listChangedMigrationFiles(baseRef) {
  if (!baseRef) throw new Error('A migration comparison base is required.');

  const lines = gitLines(['diff', '--name-status', '--diff-filter=ACMR', baseRef, 'HEAD', '--', 'supabase/migrations']);
  return lines
    .map((line) => {
      const parts = line.split(/\s+/);
      return parts.at(-1)?.replace(/\\/g, '/') ?? '';
    })
    .filter((file) => MIGRATION_PATH.test(file))
    .sort();
}

function parseMigration(file) {
  const match = file.match(MIGRATION_PATH);
  if (!match) throw new Error(`Invalid migration file path: ${file}`);
  return {
    file,
    version: match[1],
    name: basename(file).replace(/^\d{14}_/, '').replace(/\.sql$/, ''),
    sql: readFileSync(file, 'utf8'),
  };
}

async function ensureMigrationHistory(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
  await client.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version TEXT PRIMARY KEY,
      statements TEXT[],
      name TEXT
    )
  `);
}

async function getMigrationHistoryColumns(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations'
      AND table_name = 'schema_migrations'
  `);
  return new Set(result.rows.map((row) => row.column_name));
}

async function hasRecordedMigration(client, version) {
  const result = await client.query(
    'SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1 LIMIT 1',
    [version],
  );
  return result.rowCount > 0;
}

async function recordMigration(client, migration) {
  const columns = await getMigrationHistoryColumns(client);
  const insertColumns = ['version'];
  const placeholders = ['$1'];
  const values = [migration.version];

  if (columns.has('name')) {
    insertColumns.push('name');
    values.push(migration.name);
    placeholders.push(`$${values.length}`);
  }

  if (columns.has('statements')) {
    insertColumns.push('statements');
    values.push(['-- Applied by scripts/apply-e2e-pr-migrations.cjs for isolated E2E proof']);
    placeholders.push(`$${values.length}`);
  }

  await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (version) DO NOTHING`,
    values,
  );
}

async function applyMigration(client, migration) {
  if (await hasRecordedMigration(client, migration.version)) {
    console.log(`Skipping already-recorded E2E migration ${migration.version} (${migration.name}).`);
    return;
  }

  console.log(`Applying E2E migration ${migration.version} (${migration.name}).`);
  await client.query(migration.sql);
  await recordMigration(client, migration);
}

async function main() {
  const { baseRef, dryRun } = parseArgs(process.argv.slice(2));
  const files = listChangedMigrationFiles(baseRef);

  if (files.length === 0) {
    console.log('No changed Supabase migrations to apply to isolated E2E database.');
    return;
  }

  console.log(`Changed Supabase migrations since ${baseRef}:`);
  for (const file of files) {
    console.log(`- ${file}`);
  }

  if (dryRun) {
    console.log('Dry run complete; no E2E database mutation performed.');
    return;
  }

  if (process.env.ALLOW_E2E_MIGRATION_APPLY !== '1') {
    throw new Error('Refusing to apply migrations without ALLOW_E2E_MIGRATION_APPLY=1.');
  }

  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL or SUPABASE_DATABASE_URL is required for isolated E2E migration apply.');
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await ensureMigrationHistory(client);
    for (const file of files) {
      await applyMigration(client, parseMigration(file));
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  listChangedMigrationFiles,
  parseMigration,
};
