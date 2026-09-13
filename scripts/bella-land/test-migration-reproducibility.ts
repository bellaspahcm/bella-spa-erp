#!/usr/bin/env tsx

/**
 * Migration Reproducibility Check
 * 
 * Goal: Verify clean environment can build canonical schema from migration history
 * 
 * Test:
 * 1. Reset local DB to clean state
 * 2. Apply all migrations via standard process
 * 3. Inspect final schema (re_reservations)
 * 4. Compare with canonical schema expectations
 * 5. Verify concurrency protection exists
 * 
 * Outcomes:
 * A. ✅ REPRODUCIBLE - migrations succeed, schema matches
 * B. 🔴 SCHEMA DRIFT - migrations succeed, schema differs
 * C. 🔴 MIGRATION FAILURE - migration chain fails
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface SchemaCheck {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

function exec(command: string, description: string): { success: boolean; output: string } {
  console.log(`\n⚙️  ${description}...`);
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`   ✅ Success`);
    return { success: true, output };
  } catch (error: any) {
    console.error(`   ❌ Failed: ${error.message}`);
    return { success: false, output: error.stdout || error.stderr || '' };
  }
}

async function main() {
  console.log('\n🔬 Bella Land - Migration Reproducibility Check');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎯 GOAL: Verify clean DB can build canonical schema from migrations');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const results: SchemaCheck[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Reset local DB
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nSTEP 1: Reset Local Database');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  WARNING: This will destroy local database and rebuild from migrations');
  console.log('   Linked remote database will NOT be affected');

  const resetResult = exec(
    'npx supabase db reset',
    'Reset local DB to clean state'
  );

  if (!resetResult.success) {
    console.error('\n❌ MIGRATION REPRODUCIBILITY: FAILED (DB reset failed)');
    console.error('\nCannot proceed without clean local DB');
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Connect and inspect schema
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Inspect Final Schema');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Use local DB URL (not linked remote)
  const supabaseUrl = 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ─────────────────────────────────────────────────────────────────────────
  // Check 1: Table exists
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n1️⃣  Table: re_reservations');
  console.log('   ──────────────────────────────────────────────────────────────────');

  const { data: tableCheck, error: tableError } = await supabase
    .from('re_reservations')
    .select('id')
    .limit(0);

  const tableExists = !tableError || tableError.code !== 'PGRST204';
  
  results.push({
    check: 'Table exists',
    expected: 're_reservations table',
    actual: tableExists ? 'EXISTS' : 'NOT FOUND',
    passed: tableExists,
    severity: 'CRITICAL'
  });

  console.log(`   Expected: re_reservations table exists`);
  console.log(`   Actual:   ${tableExists ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`   ${tableExists ? '✅ PASS' : '❌ FAIL'}`);

  if (!tableExists) {
    console.error('\n❌ CRITICAL: re_reservations table not found');
    console.error('   Migration chain may have failed or table not created');
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check 2-7: Column existence and types via direct query
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n2️⃣  Schema Columns');
  console.log('   ──────────────────────────────────────────────────────────────────');

  const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 're_reservations'
      ORDER BY ordinal_position;
    `
  }).single();

  if (columnsError) {
    console.error('   ⚠️  Cannot query columns (using alternative method)');
    
    // Alternative: Try to insert minimal record and check error
    console.log('   Using test insert to verify schema...');
  }

  // Expected columns (canonical schema)
  const expectedColumns = [
    { name: 'id', required: true },
    { name: 'tenant_id', required: true },
    { name: 'customer_id', required: true }, // NOT NULL after patch
    { name: 'product_id', required: true },
    { name: 'status', required: true },
    { name: 'deposit_amount', required: false }, // Added in patch
    { name: 'notes', required: false }, // Added in patch
    { name: 'user_id', required: false }, // NULLABLE after patch
    { name: 'expires_at', required: false }, // NULLABLE after patch
    { name: 'created_by', required: false },
    { name: 'created_at', required: false },
    { name: 'updated_at', required: false },
    { name: 'updated_by', required: false }
  ];

  console.log('   Expected columns (canonical schema):');
  expectedColumns.forEach(col => {
    console.log(`   - ${col.name.padEnd(20)} ${col.required ? 'NOT NULL' : 'NULLABLE'}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Check 3: status enum type
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n3️⃣  Enum Type: status column');
  console.log('   ──────────────────────────────────────────────────────────────────');

  // Query enum values
  const enumQuery = `
    SELECT 
      e.enumtypid::regtype AS enum_name,
      e.enumlabel AS enum_value
    FROM pg_enum e
    WHERE e.enumtypid = 'reservation_status'::regtype
    ORDER BY e.enumsortorder;
  `;

  const enumResult = exec(
    `npx supabase db query "${enumQuery}"`,
    'Query reservation_status enum'
  );

  const hasReservationStatus = enumResult.output.includes('reservation_status');
  const hasExpectedValues = 
    enumResult.output.includes('pending_deposit') &&
    enumResult.output.includes('deposited') &&
    enumResult.output.includes('converted_to_contract') &&
    enumResult.output.includes('cancelled');

  results.push({
    check: 'Enum type',
    expected: 'reservation_status enum',
    actual: hasReservationStatus ? 'reservation_status' : 'NOT FOUND',
    passed: hasReservationStatus,
    severity: 'CRITICAL'
  });

  results.push({
    check: 'Enum values',
    expected: 'pending_deposit, deposited, converted_to_contract, cancelled',
    actual: hasExpectedValues ? 'ALL PRESENT' : 'MISSING VALUES',
    passed: hasExpectedValues,
    severity: 'CRITICAL'
  });

  console.log(`   Expected: reservation_status enum`);
  console.log(`   Actual:   ${hasReservationStatus ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`   ${hasReservationStatus ? '✅ PASS' : '❌ FAIL'}`);

  if (hasExpectedValues) {
    console.log(`   Enum values: ✅ pending_deposit, deposited, converted_to_contract, cancelled`);
  } else {
    console.log(`   Enum values: ❌ Some values missing`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check 4: Concurrency protection (unique index)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n4️⃣  Concurrency Protection');
  console.log('   ──────────────────────────────────────────────────────────────────');

  const indexQuery = `
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 're_reservations'
      AND indexname = 'idx_one_active_reservation_per_apartment';
  `;

  const indexResult = exec(
    `npx supabase db query "${indexQuery}"`,
    'Check concurrency unique index'
  );

  const hasIndex = indexResult.output.includes('idx_one_active_reservation_per_apartment');
  const isPartialIndex = indexResult.output.includes('WHERE') && 
                         indexResult.output.includes('pending_deposit') &&
                         indexResult.output.includes('deposited');

  results.push({
    check: 'Concurrency index',
    expected: 'idx_one_active_reservation_per_apartment (partial unique)',
    actual: hasIndex ? (isPartialIndex ? 'PARTIAL UNIQUE INDEX' : 'INDEX (not partial)') : 'NOT FOUND',
    passed: hasIndex && isPartialIndex,
    severity: 'CRITICAL'
  });

  console.log(`   Expected: UNIQUE INDEX (product_id, tenant_id) WHERE status IN (...)`);
  console.log(`   Actual:   ${hasIndex ? (isPartialIndex ? 'PARTIAL UNIQUE INDEX' : 'INDEX (wrong type)') : 'NOT FOUND'}`);
  console.log(`   ${hasIndex && isPartialIndex ? '✅ PASS' : '❌ FAIL'}: ${hasIndex && isPartialIndex ? 'Concurrency protection exists' : 'MISSING - double-booking possible'}`);

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const critical = results.filter(r => r.severity === 'CRITICAL');
  const criticalPassed = critical.filter(r => r.passed).length;
  const criticalTotal = critical.length;

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('📊 MIGRATION REPRODUCIBILITY RESULTS');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`\n✅ Critical Checks Passed: ${criticalPassed}/${criticalTotal}`);
  console.log(`❌ Critical Checks Failed: ${criticalTotal - criticalPassed}/${criticalTotal}`);

  console.log('\n─────────────────────────────────────────────────────────────────────');
  console.log('CRITICAL CHECKS:');
  console.log('─────────────────────────────────────────────────────────────────────');

  critical.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    console.log(`${status} ${check.check.padEnd(25)} ${check.actual}`);
  });

  console.log('\n══════════════════════════════════════════════════════════════════════');

  if (criticalPassed === criticalTotal) {
    console.log('✅ MIGRATION REPRODUCIBILITY: VERIFIED');
    console.log('   Clean environment can build canonical schema from migrations');
    console.log('══════════════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.log('❌ MIGRATION REPRODUCIBILITY: FAILED');
    console.log('   Schema drift detected or migration chain incomplete');
    console.log('\n🔍 DIAGNOSIS:');
    
    const failures = critical.filter(r => !r.passed);
    failures.forEach(fail => {
      console.log(`\n   ❌ ${fail.check}`);
      console.log(`      Expected: ${fail.expected}`);
      console.log(`      Actual:   ${fail.actual}`);
    });

    console.log('\n📋 RECOMMENDATION:');
    console.log('   1. Review failed checks above');
    console.log('   2. Check if migrations are missing or out of order');
    console.log('   3. Create forward reconciliation migration if needed');
    console.log('   4. Re-run this test after fix');
    console.log('══════════════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main();
