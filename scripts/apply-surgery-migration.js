#!/usr/bin/env node
/**
 * Apply surgery schema migration
 */

const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

// Load environment variables (fallback to test, then local)
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.test') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL or SUPABASE_DB_URL is not configured in environment files');
    return 1;
  }

  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected\n');

    // Read migration file
    const migrationSQL = fs.readFileSync(
      'supabase/migrations/20260812070000_create_surgery_schema.sql',
      'utf8'
    );

    console.log('Applying migration...');
    console.log('=====================================\n');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('\n=====================================');
    console.log('✓ Migration applied successfully');

    // Verify the table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_name = 'hc_surgical_cases'
      );
    `);

    if (result.rows[0]?.exists) {
      console.log('✓ Verified: table public.hc_surgical_cases exists\n');
      
      // Record in migration history
      await client.query(`
        INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
        VALUES ('20260812070000', 'create_surgery_schema', ARRAY['create table hc_surgical_cases'])
        ON CONFLICT (version) DO NOTHING;
      `);
      console.log('✓ Migration recorded in history\n');
      
      return 0;
    } else {
      console.error('✗ Verification failed: table public.hc_surgical_cases not found\n');
      return 1;
    }

  } catch (error) {
    console.error('✗ Migration failed:');
    console.error(error.message);
    if (error.code) console.error(`Error code: ${error.code}`);
    return 1;
  } finally {
    await client.end();
  }
}

applyMigration().then(code => process.exit(code));
