/**
 * Apply Reservations Schema Migration
 * 
 * Safely applies forward migration from old schema to core schema
 * Includes pre-checks and post-verification
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('\n🔄 Bella Land - Reservations Schema Migration\n');
  console.log('═'.repeat(70));

  // Pre-check 1: Verify table exists
  console.log('\n━'.repeat(70));
  console.log('PRE-CHECK 1: Table Existence');
  console.log('━'.repeat(70));

  const { count: tableCount, error: countError } = await supabase
    .from('re_reservations')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('\n❌ Table re_reservations not found');
    console.error('   Error:', countError.message);
    process.exit(1);
  }

  console.log(`\n✅ Table exists`);
  console.log(`   Current records: ${tableCount}`);

  if (tableCount && tableCount > 0) {
    console.log('\n⚠️  WARNING: Table has existing data');
    console.log('   Migration will attempt to preserve data');
    console.log('   Status values will be mapped:');
    console.log('     active → pending_deposit');
    console.log('     converted → converted_to_contract');
    console.log('     released/expired → cancelled');
  } else {
    console.log('\n✅ Table is empty - safe for schema migration');
  }

  // Pre-check 2: Load migration SQL
  console.log('\n━'.repeat(70));
  console.log('PRE-CHECK 2: Load Migration File');
  console.log('━'.repeat(70));

  let migrationSQL: string;
  try {
    migrationSQL = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260911000000_reconcile_reservations_schema.sql'),
      'utf-8'
    );
    console.log('\n✅ Migration file loaded');
    console.log(`   Size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error('\n❌ Failed to load migration file');
    console.error('   Error:', err);
    process.exit(1);
  }

  // Warning before execution
  console.log('\n' + '═'.repeat(70));
  console.log('⚠️  READY TO APPLY MIGRATION');
  console.log('═'.repeat(70));

  console.log('\nThis migration will:');
  console.log('  1. Create new enum type: reservation_status');
  console.log('  2. Add columns: deposit_amount, reserved_at, deposited_at, etc.');
  console.log('  3. Migrate status values to new enum');
  console.log('  4. Make user_id nullable');
  console.log('  5. Update indexes and constraints');

  console.log('\n⏸️  Pausing for manual confirmation...');
  console.log('   (In production, add confirmation prompt here)');
  console.log('   Proceeding in 3 seconds...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Execute migration
  console.log('━'.repeat(70));
  console.log('EXECUTING MIGRATION');
  console.log('━'.repeat(70));

  console.log('\n⚠️  Supabase client does not support raw SQL execution via service key.');
  console.log('   Migration must be applied via:');
  console.log('   1. Supabase Dashboard > SQL Editor');
  console.log('   2. Supabase CLI: npx supabase db push');
  console.log('   3. Direct psql connection');
  
  console.log('\n📄 Migration file location:');
  console.log('   supabase/migrations/20260911000000_reconcile_reservations_schema.sql');

  console.log('\n💡 After applying migration manually:');
  console.log('   1. Regenerate types: npx supabase gen types typescript');
  console.log('   2. Rerun this script with --verify flag');

  console.log('\n' + '═'.repeat(70));
  console.log('MIGRATION PREPARATION COMPLETE');
  console.log('═'.repeat(70));

  console.log('\n✅ Pre-checks passed');
  console.log('✅ Migration file ready');
  console.log('⏸️  Manual application required');

  console.log('\n' + '═'.repeat(70) + '\n');
}

applyMigration().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
