#!/usr/bin/env node
/**
 * Apply Bella Finance OS database migrations
 * 
 * This script executes both F1 migrations sequentially using the pg client.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Determine env file to load
const envFile = fs.existsSync('.env.test') ? '.env.test' : '.env.local';
console.log(`Loading env from ${envFile}`);
require('dotenv').config({ path: envFile });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('✗ Error: DATABASE_URL, SUPABASE_DATABASE_URL, or SUPABASE_DB_URL is not set.');
  process.exit(1);
}

async function applyMigrations() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected\n');

    const migrations = [
      {
        version: '20260815000000',
        name: 'finance_kernel_v1',
        file: 'supabase/migrations/20260815000000_finance_kernel_v1.sql'
      },
      {
        version: '20260815005000',
        name: 'finance_kernel_v1_schema_fix',
        file: 'supabase/migrations/20260815005000_finance_kernel_v1_schema_fix.sql'
      },
      {
        version: '20260815010000',
        name: 'finance_ledger_rpcs',
        file: 'supabase/migrations/20260815010000_finance_ledger_rpcs.sql'
      },
      {
        version: '20260815011000',
        name: 'finance_reversal_period_fix',
        file: 'supabase/migrations/20260815011000_finance_reversal_period_fix.sql'
      },
      {
        version: '20260815020000',
        name: 'finance_service_role_grants',
        file: 'supabase/migrations/20260815020000_finance_service_role_grants.sql'
      },
      {
        version: '20260815030000',
        name: 'finance_db_constraint_audit',
        file: 'supabase/migrations/20260815030000_finance_db_constraint_audit.sql'
      },
      {
        version: '20260815040000',
        name: 'finance_trigger_reversal_fix',
        file: 'supabase/migrations/20260815040000_finance_trigger_reversal_fix.sql'
      },
      {
        version: '20260816050000',
        name: 'finance_f3_proof_setup',
        file: 'supabase/migrations/20260816050000_finance_f3_proof_setup.sql'
      },
      {
        version: '20260817000000',
        name: 'finance_ar_engine_v1',
        file: 'supabase/migrations/20260817000000_finance_ar_engine_v1.sql'
      },
      {
        version: '20260817010000',
        name: 'finance_invoice_lifecycle_rpcs',
        file: 'supabase/migrations/20260817010000_finance_invoice_lifecycle_rpcs.sql'
      },
      {
        version: '20260817020000',
        name: 'finance_payment_allocation_rpcs',
        file: 'supabase/migrations/20260817020000_finance_payment_allocation_rpcs.sql'
      }
    ];

    // Query applied migrations from Supabase history
    let appliedVersions = new Set();
    try {
      const res = await client.query('SELECT version FROM supabase_migrations.schema_migrations');
      appliedVersions = new Set(res.rows.map(r => String(r.version)));
      console.log(`Found ${appliedVersions.size} already applied migrations in history.`);
    } catch (err) {
      console.log('No migration history table found or accessible, running migrations as needed.');
    }

    for (const m of migrations) {
      if (appliedVersions.has(m.version)) {
        console.log(`Migration ${m.name} (${m.version}) is already applied. Skipping.`);
        continue;
      }

      console.log(`Applying migration ${m.name} (${m.file})...`);
      const sqlPath = path.resolve(process.cwd(), m.file);
      if (!fs.existsSync(sqlPath)) {
        throw new Error(`Migration file not found: ${sqlPath}`);
      }

      const sqlContent = fs.readFileSync(sqlPath, 'utf8');

      // Execute migration inside transaction
      await client.query('BEGIN;');
      await client.query(sqlContent);
      await client.query('COMMIT;');
      console.log(`✓ Migration ${m.name} applied successfully.`);

      // Record in migration history table if it exists
      try {
        await client.query(`
          INSERT INTO supabase_migrations.schema_migrations (version)
          VALUES ($1)
          ON CONFLICT (version) DO NOTHING;
        `, [m.version]);
        console.log(`✓ Migration ${m.version} recorded in history.\n`);
      } catch (histErr) {
        // If history table doesn't exist, ignore
        console.log('  (Migration history recording skipped)\n');
      }
    }

    console.log('✓ All Finance migrations applied successfully!');
    return 0;
  } catch (error) {
    console.error('✗ Migration failed:');
    console.error(error.message);
    if (error.code) console.error(`Error code: ${error.code}`);
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

applyMigrations().then(code => process.exit(code));
