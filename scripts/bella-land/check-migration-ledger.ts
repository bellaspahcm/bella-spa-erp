/**
 * Check Migration Ledger - Phase 2B Prerequisite
 * 
 * Verifies what migrations are pending before applying reconciliation
 * CRITICAL SAFETY CHECK before running db push
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readdirSync } from 'fs';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkMigrationLedger() {
  console.log('\n🔍 Migration Ledger Check - Phase 2B Prerequisite\n');
  console.log('═'.repeat(70));

  console.log('\n⚠️  CRITICAL SAFETY CHECK');
  console.log('   Before applying reconciliation migration, must verify:');
  console.log('   1. Which migrations are already applied');
  console.log('   2. What "npx supabase db push" will apply');
  console.log('   3. Risk of unintended cascade');

  // Step 1: Check if migration tracking table exists
  console.log('\n━'.repeat(70));
  console.log('STEP 1: Migration Tracking Table');
  console.log('━'.repeat(70));

  console.log('\n⚠️  Supabase client cannot directly query supabase_migrations schema.');
  console.log('   Migration history must be checked via:');
  console.log('   1. Supabase Dashboard > Database > Migrations');
  console.log('   2. Direct psql query');
  console.log('   3. Supabase CLI: npx supabase migration list');

  // Step 2: List local migration files
  console.log('\n━'.repeat(70));
  console.log('STEP 2: Local Migration Files');
  console.log('━'.repeat(70));

  const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('placeholder'))
    .sort();

  console.log(`\n📁 Total migration files in repo: ${migrationFiles.length}`);

  // Focus on recent real estate migrations
  const recentRealEstate = migrationFiles.filter(f => 
    f.startsWith('202608') || f.startsWith('202609')
  ).filter(f => 
    f.includes('real_estate') || f.includes('reservation') || f.includes('reconcile')
  );

  console.log(`\n🏢 Recent real estate migrations:`);
  recentRealEstate.forEach(f => {
    const isReconciliation = f.includes('reconcile');
    const marker = isReconciliation ? '🎯 ' : '   ';
    console.log(`${marker}${f}`);
  });

  // Step 3: Highlight reconciliation migration
  console.log('\n━'.repeat(70));
  console.log('STEP 3: Reconciliation Migration');
  console.log('━'.repeat(70));

  const reconciliationFile = '20260911000000_reconcile_reservations_schema.sql';
  const exists = migrationFiles.includes(reconciliationFile);

  if (exists) {
    console.log(`\n✅ Reconciliation migration exists:`);
    console.log(`   ${reconciliationFile}`);
  } else {
    console.log(`\n❌ Reconciliation migration NOT found`);
    process.exit(1);
  }

  // Step 4: Safety recommendations
  console.log('\n━'.repeat(70));
  console.log('STEP 4: Safety Recommendations');
  console.log('━'.repeat(70));

  console.log('\n🔍 BEFORE running "npx supabase db push":');
  console.log('');
  console.log('   1. Check applied migrations:');
  console.log('      Dashboard > Database > Migrations');
  console.log('      OR: npx supabase migration list --linked');
  console.log('');
  console.log('   2. Verify pending count:');
  console.log('      If 1 pending: Safe (only reconciliation)');
  console.log('      If >1 pending: REVIEW ALL before push');
  console.log('');
  console.log('   3. Alternative (safer for first time):');
  console.log('      Dashboard > SQL Editor');
  console.log('      Copy/paste reconciliation SQL manually');
  console.log('      Verify result before marking as applied');

  // Step 5: Cascade risk assessment
  console.log('\n━'.repeat(70));
  console.log('STEP 5: Cascade Risk Assessment');
  console.log('━'.repeat(70));

  console.log('\n📊 Migration Count Analysis:');
  console.log(`   Total in repo: ${migrationFiles.length}`);
  console.log(`   Recent real estate: ${recentRealEstate.length}`);
  console.log('');
  console.log('   🟢 LOW risk if: Only reconciliation pending');
  console.log('   🟡 MODERATE risk if: <10 pending, all reviewed');
  console.log('   🔴 HIGH risk if: Many pending, not reviewed');

  // Step 6: Manual verification required
  console.log('\n━'.repeat(70));
  console.log('STEP 6: Manual Verification Required');
  console.log('━'.repeat(70));

  console.log('\n⚠️  This script cannot determine:');
  console.log('   ❌ Which migrations are applied on live DB');
  console.log('   ❌ What db push will actually apply');
  console.log('   ❌ Dependencies between migrations');

  console.log('\n✅ Human must verify via:');
  console.log('   1. Supabase Dashboard (most reliable)');
  console.log('   2. Direct database query (if access available)');
  console.log('   3. CLI migration list (if linked to project)');

  // Step 7: SQL query template
  console.log('\n━'.repeat(70));
  console.log('STEP 7: Manual Query Template');
  console.log('━'.repeat(70));

  console.log('\n📝 If you have direct DB access:');
  console.log('');
  console.log('   -- Check applied migrations');
  console.log('   SELECT version, name, inserted_at');
  console.log('   FROM supabase_migrations.schema_migrations');
  console.log('   ORDER BY inserted_at DESC');
  console.log('   LIMIT 20;');
  console.log('');
  console.log('   -- Check reservation-related migrations');
  console.log(`   SELECT * FROM supabase_migrations.schema_migrations`);
  console.log(`   WHERE name LIKE '%reservation%'`);
  console.log(`      OR name LIKE '%2026080%'`);
  console.log(`      OR name LIKE '%2026091%'`);
  console.log(`   ORDER BY inserted_at;`);

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n✅ Reconciliation migration exists');
  console.log('⚠️  Applied migrations: UNKNOWN (check manually)');
  console.log('⚠️  Pending migrations: UNKNOWN (check manually)');
  console.log('⚠️  Cascade risk: UNKNOWN (check manually)');

  console.log('\n🚦 GO/NO-GO Decision:');
  console.log('   ✅ GO if: Only reconciliation pending');
  console.log('   🟡 REVIEW if: Multiple migrations pending');
  console.log('   🔴 NO-GO if: Cannot verify ledger state');

  console.log('\n📋 Next Steps:');
  console.log('   1. Check Supabase Dashboard > Migrations');
  console.log('   2. Confirm pending count');
  console.log('   3. Review any other pending migrations');
  console.log('   4. Choose safe application method');
  console.log('   5. Apply reconciliation migration');
  console.log('   6. Verify live schema post-application');

  console.log('\n' + '═'.repeat(70) + '\n');
}

checkMigrationLedger().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
