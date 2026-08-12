#!/usr/bin/env node
/**
 * Apply care_journey_id nullable migration
 * 
 * This script executes the migration SQL directly using pg client
 * to bypass Supabase CLI migration tracking issues.
 */

const fs = require('fs');
const { Client } = require('pg');

require('dotenv').config({ path: '.env.test' });

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected\n');

    // Read migration file
    const migrationSQL = fs.readFileSync(
      'supabase/migrations/20260812010000_make_care_journey_id_nullable.sql',
      'utf8'
    );

    console.log('Applying migration...');
    console.log('=====================================\n');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('\n=====================================');
    console.log('✓ Migration applied successfully');

    // Verify the change
    const result = await client.query(`
      SELECT is_nullable 
      FROM information_schema.columns
      WHERE table_name = 'hc_encounters'
        AND column_name = 'care_journey_id';
    `);

    if (result.rows[0]?.is_nullable === 'YES') {
      console.log('✓ Verified: care_journey_id is now NULLABLE\n');
      
      // Record in migration history
      await client.query(`
        INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
        VALUES ('20260812010000', 'make_care_journey_id_nullable', ARRAY['ALTER TABLE hc_encounters ALTER COLUMN care_journey_id DROP NOT NULL'])
        ON CONFLICT (version) DO NOTHING;
      `);
      console.log('✓ Migration recorded in history\n');
      
      return 0;
    } else {
      console.error('✗ Verification failed: care_journey_id is still NOT NULL\n');
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
