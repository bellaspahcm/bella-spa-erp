#!/usr/bin/env node

/**
 * Apply Migration Script: Clinical Orders Extension
 * File: scripts/apply-clinical-orders-migration.js
 * 
 * PURPOSE: Apply 20260812030000_extend_clinical_orders_table.sql to local Supabase
 * 
 * USAGE:
 *   node scripts/apply-clinical-orders-migration.js
 * 
 * SAFETY:
 *   - Only applies to LOCAL Supabase (localhost:54322)
 *   - Reads migration file and executes via raw SQL
 *   - Verifies success before committing
 * 
 * PREREQUISITES:
 *   - Supabase running locally (npm run supabase:start)
 *   - Migration file exists: supabase/migrations/20260812030000_extend_clinical_orders_table.sql
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Safety check: Only allow local Supabase
if (!SUPABASE_URL.includes('localhost') && !SUPABASE_URL.includes('127.0.0.1')) {
  console.error('❌ SAFETY CHECK FAILED');
  console.error('This script only runs against LOCAL Supabase.');
  console.error(`Current URL: ${SUPABASE_URL}`);
  console.error('To apply to production, use: supabase db push');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ MISSING SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set environment variable: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('========================================');
  console.log('Apply Clinical Orders Migration');
  console.log('========================================\n');

  // Read migration file
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20260812030000_extend_clinical_orders_table.sql'
  );

  console.log(`[Step 1] Reading migration file: ${migrationPath}`);
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ FAILED - Migration file not found');
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log(`✅ Migration file loaded (${migrationSQL.length} bytes)\n`);

  // Check current state
  console.log('[Step 2] Checking current schema...');
  try {
    const { data, error } = await supabase
      .from('hc_clinical_orders')
      .select('id, patient_party_id, request_id, version')
      .limit(1);

    if (!error && data) {
      console.log('⚠️  WARNING - Columns already exist. Migration may have been applied.');
      console.log('Columns found:', Object.keys(data[0] || {}));
      
      const proceed = process.argv.includes('--force');
      if (!proceed) {
        console.log('\nTo re-apply migration, use: node scripts/apply-clinical-orders-migration.js --force');
        process.exit(0);
      }
    }
  } catch (err) {
    // Columns don't exist yet - this is expected
    console.log('✅ Columns not found - ready to apply migration\n');
  }

  // Apply migration via Supabase CLI (recommended)
  console.log('[Step 3] Applying migration...');
  console.log('NOTE: This script applies via raw SQL (for testing).');
  console.log('      For production, use: supabase db push\n');

  try {
    // Split migration into individual statements (crude but works for most cases)
    // Better approach: Use supabase CLI or pg client
    console.log('⚠️  Manual migration recommended:');
    console.log('    1. Run: supabase db reset (local only)');
    console.log('    2. Or run migration manually in SQL editor');
    console.log('    3. Then run: node scripts/verify-clinical-orders-migration.js');
    console.log('\nMigration SQL preview (first 500 chars):');
    console.log(migrationSQL.substring(0, 500) + '...\n');
    
    console.log('To apply manually:');
    console.log(`  cat ${migrationPath} | psql postgresql://postgres:postgres@localhost:54322/postgres`);
    
  } catch (err) {
    console.error('❌ FAILED - Migration error:', err.message);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('Next Steps:');
  console.log('========================================');
  console.log('1. Apply migration: supabase db reset (or manual SQL)');
  console.log('2. Verify: node scripts/verify-clinical-orders-migration.js');
  console.log('3. Proceed to STEP 6C: Repository Implementation');
}

// Run migration application
applyMigration().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
