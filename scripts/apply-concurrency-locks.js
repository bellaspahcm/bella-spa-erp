#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load environment variables
const envFile = fs.existsSync('.env.test') ? '.env.test' : '.env.local';
console.log(`Loading env from ${envFile}`);
require('dotenv').config({ path: envFile });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('✗ Error: DATABASE_URL, SUPABASE_DATABASE_URL, or SUPABASE_DB_URL is not set.');
  process.exit(1);
}

const MIGRATION_VERSION = '20260816040000';
const MIGRATION_NAME = 'finance_cash_concurrency_locks';
const MIGRATION_FILE = `supabase/migrations/${MIGRATION_VERSION}_${MIGRATION_NAME}.sql`;

async function applyMigration() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected');

    console.log(`Applying migration ${MIGRATION_NAME} (${MIGRATION_FILE})...`);
    const sqlPath = path.resolve(process.cwd(), MIGRATION_FILE);
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await client.query('BEGIN;');
    await client.query(sqlContent);
    await client.query('COMMIT;');
    console.log('✓ Migration executed successfully.');

    // Record in history table
    try {
      await client.query(`
        INSERT INTO supabase_migrations.schema_migrations (version)
        VALUES ($1)
        ON CONFLICT (version) DO NOTHING;
      `, [MIGRATION_VERSION]);
      console.log(`✓ Migration ${MIGRATION_VERSION} recorded in history.\n`);
    } catch (histErr) {
      console.log('  (Migration history recording skipped or table not found)\n');
    }

    console.log('✓ Concurrency locks migration applied successfully!');
    return 0;
  } catch (error) {
    console.error('✗ Migration failed:');
    console.error(error.message);
    try {
      await client.query('ROLLBACK;');
    } catch (e) {
      // Ignore rollback failure if not in transaction
    }
    return 1;
  } finally {
    await client.end();
  }
}

applyMigration().then(code => process.exit(code));
