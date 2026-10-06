const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { basename } = require('node:path');
const { Client } = require('pg');

const MIGRATION_PATH = /^supabase\/migrations\/(\d{14})_(.+)\.sql$/;
const FOUNDATION_ORG_PEOPLE_SCHEMA_MIGRATION =
  'supabase/migrations/20260801030000_foundation_org_people_schema.sql';
const BLUEPRINT_CORE_SCHEMA_MIGRATION = 'supabase/migrations/20260806000000_blueprint_core_schema.sql';
const EDUCATION_SCHEMA_MIGRATION = 'supabase/migrations/20260812060000_create_education_schema.sql';
const EDUCATION_ENROLLMENT_RPC_MIGRATION = 'supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql';
const PRESCHOOL_GUARDIAN_AUTHORIZATION_MIGRATION =
  'supabase/migrations/20260927010000_preschool_guardian_pickup_authorizations.sql';
const USER_ORG_UNIT_ACCESS_PROJECTION_MIGRATION =
  'supabase/migrations/20260914_create_user_org_unit_access_projection.sql';
const PLATFORM_RULE_DOMAIN_TYPE_SQL = `
DO $$ BEGIN
  CREATE TYPE public.platform_rule_domain AS ENUM (
    'spa.booking',
    'spa.commission',
    'spa.notification',
    'finance.commission',
    'finance.payment',
    'hr.payroll',
    'notification.routing',
    'crm.sla',
    'bella_auto.sales',
    'babycare.booking',
    'platform.system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

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

async function relationExists(client, schemaName, relationName) {
  const result = await client.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`${schemaName}.${relationName}`],
  );
  return result.rows[0]?.exists === true;
}

async function columnExists(client, schemaName, tableName, columnName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = $3
      LIMIT 1
    `,
    [schemaName, tableName, columnName],
  );
  return result.rowCount > 0;
}

async function functionExists(client, schemaName, functionName) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1
        AND p.proname = $2
      LIMIT 1
    `,
    [schemaName, functionName],
  );
  return result.rowCount > 0;
}

async function typeExists(client, schemaName, typeName) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1
        AND t.typname = $2
      LIMIT 1
    `,
    [schemaName, typeName],
  );
  return result.rowCount > 0;
}

function needsEducationRuntimeBaseline(migrations) {
  return migrations.some((migration) => (
    migration.sql.includes('public.edu_courses')
    || migration.sql.includes('public.edu_enrollments')
    || migration.sql.includes('preschool_chain_')
  ));
}

function needsPreschoolAdmissionBaseline(migrations) {
  return migrations.some((migration) => migration.sql.includes('preschool_chain_'));
}

async function canonicalMigrationIsNeeded(client, file) {
  if (file === FOUNDATION_ORG_PEOPLE_SCHEMA_MIGRATION) {
    return !(await relationExists(client, 'public', 'org_units'))
      || !(await relationExists(client, 'public', 'org_relationships'))
      || !(await relationExists(client, 'public', 'people_directory'));
  }

  if (file === BLUEPRINT_CORE_SCHEMA_MIGRATION) {
    return !(await relationExists(client, 'public', 'party_parties'));
  }

  if (file === EDUCATION_SCHEMA_MIGRATION) {
    return !(await relationExists(client, 'public', 'edu_courses'))
      || !(await relationExists(client, 'public', 'edu_enrollments'));
  }

  if (file === EDUCATION_ENROLLMENT_RPC_MIGRATION) {
    return !(await columnExists(client, 'public', 'edu_courses', 'current_enrollment'))
      || !(await columnExists(client, 'public', 'edu_enrollments', 'request_id'))
      || !(await functionExists(client, 'public', 'edu_enroll_student_v3'));
  }

  if (file === PRESCHOOL_GUARDIAN_AUTHORIZATION_MIGRATION) {
    return !(await relationExists(client, 'public', 'edu_preschool_pickup_authorizations'));
  }

  if (file === USER_ORG_UNIT_ACCESS_PROJECTION_MIGRATION) {
    return !(await relationExists(client, 'public', 'user_org_unit_access'));
  }

  throw new Error(`Unsupported E2E baseline repair migration: ${file}`);
}

async function ensurePlatformRuleDomainType(client) {
  if (await typeExists(client, 'public', 'platform_rule_domain')) {
    return;
  }

  console.log(
    'Repairing isolated E2E baseline with canonical type public.platform_rule_domain '
    + 'from migration 20260808000012 (create_rule_engine_tables): required by Education enrollment RPC.',
  );
  await client.query(PLATFORM_RULE_DOMAIN_TYPE_SQL);
}

async function applyCanonicalBaselineMigration(client, file, reason) {
  if (!(await canonicalMigrationIsNeeded(client, file))) {
    return;
  }

  const migration = parseMigration(file);
  const recorded = await hasRecordedMigration(client, migration.version);
  const historyState = recorded ? 'recorded migration history exists' : 'migration history missing';
  console.log(
    `Repairing isolated E2E baseline with canonical migration ${migration.version} (${migration.name}): `
    + `${reason}; ${historyState}.`,
  );

  await client.query(migration.sql);
  await recordMigration(client, migration);
}

async function ensureRequiredE2eBaseline(client, migrations) {
  if (needsEducationRuntimeBaseline(migrations)) {
    await applyCanonicalBaselineMigration(
      client,
      FOUNDATION_ORG_PEOPLE_SCHEMA_MIGRATION,
      'required by canonical Platform branch/org-unit dependencies',
    );
    await applyCanonicalBaselineMigration(
      client,
      BLUEPRINT_CORE_SCHEMA_MIGRATION,
      'required by canonical Education student party dependency',
    );
    await applyCanonicalBaselineMigration(
      client,
      EDUCATION_SCHEMA_MIGRATION,
      'required by canonical Education course/enrollment dependencies',
    );
    await ensurePlatformRuleDomainType(client);
    await applyCanonicalBaselineMigration(
      client,
      EDUCATION_ENROLLMENT_RPC_MIGRATION,
      'required by canonical Education enrollment idempotency RPC',
    );
  }

  if (needsPreschoolAdmissionBaseline(migrations)) {
    await applyCanonicalBaselineMigration(
      client,
      PRESCHOOL_GUARDIAN_AUTHORIZATION_MIGRATION,
      'required by Preschool admission guardian authorization flow',
    );
    await applyCanonicalBaselineMigration(
      client,
      USER_ORG_UNIT_ACCESS_PROJECTION_MIGRATION,
      'required by Platform branch authorization read-back',
    );
  }
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
    const migrations = files.map((file) => parseMigration(file));
    await ensureRequiredE2eBaseline(client, migrations);
    for (const migration of migrations) {
      await applyMigration(client, migration);
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
  canonicalMigrationIsNeeded,
  ensureRequiredE2eBaseline,
  listChangedMigrationFiles,
  parseMigration,
};
