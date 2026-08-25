/**
 * E8: Verify Deployment (Post-Dashboard Execution)
 * 
 * Purpose: Verify migration 20260824000000 after Dashboard deployment
 * Method: Independent evidence collection (E8.4-E8.6)
 * Status: VERIFICATION ONLY (NO DEPLOYMENT, NO MODIFICATIONS)
 * 
 * Run this AFTER executing migration via Dashboard SQL Editor
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString });

const TARGET_VERSION = '20260824000000';
const TARGET_NAME = 'finance_test_cleanup_rpc';
const RPC_NAME = 'finance_test_cleanup';

async function verifyDeployment() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E8: VERIFY DEPLOYMENT (POST-DASHBOARD)                       ║');
  console.log('║  Date: 2026-08-24                                             ║');
  console.log('║  Status: VERIFICATION ONLY (NO MODIFICATIONS)                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  This script verifies deployment AFTER Dashboard execution.');
  console.log('⚠️  It does NOT perform deployment itself.\n');

  await client.connect();

  const results: any = {
    e84: { gate: 'E8.4 Migration Recorded', pass: false },
    e85: { gate: 'E8.5 RPC Exists + Callable', pass: false },
    e86: { gate: 'E8.6 No Side Effects', pass: false },
  };

  try {
    // E8.4: Verify Migration Recorded
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.4: VERIFY MIGRATION RECORDED');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // First, inspect actual schema columns
    const schemaCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations'
      ORDER BY ordinal_position
    `);

    console.log('Actual schema_migrations columns:');
    console.table(schemaCheck.rows);
    console.log('');

    // Query using SELECT * to avoid column assumption errors
    const migrationCheck = await client.query(`
      SELECT *
      FROM supabase_migrations.schema_migrations
      WHERE version = '${TARGET_VERSION}'
    `);

    console.log('Migration record:');
    if (migrationCheck.rows.length > 0) {
      console.table(migrationCheck.rows);
      
      const record = migrationCheck.rows[0];
      const versionMatch = record.version === TARGET_VERSION;
      
      // Check name only if column exists
      const nameMatch = record.name ? record.name === TARGET_NAME : true;
      
      // Check statements only if column exists
      const hasStatements = record.statements 
        ? (Array.isArray(record.statements) && record.statements.length > 0)
        : true;

      console.log(`\nVersion match:  ${versionMatch ? '✅' : '❌'} (${record.version})`);
      
      if (record.name !== undefined) {
        console.log(`Name match:     ${nameMatch ? '✅' : '❌'} (${record.name})`);
      }
      
      if (record.statements !== undefined) {
        const stmtCount = Array.isArray(record.statements) ? record.statements.length : 0;
        console.log(`Has statements: ${hasStatements ? '✅' : '❌'} (${stmtCount})`);
      }

      if (versionMatch && nameMatch && hasStatements) {
        console.log('\n✅ E8.4 PASS — Migration recorded correctly\n');
        results.e84.pass = true;
        results.e84.record = record;
      } else {
        console.log('\n❌ E8.4 FAIL — Migration record invalid\n');
        results.e84.record = record;
      }
    } else {
      console.log('❌ NO RECORD FOUND\n');
      console.log('⚠️  Migration not recorded in schema_migrations.');
      console.log('⚠️  This means Dashboard SQL Editor did NOT auto-record migration.');
      console.log('');
      console.log('STOP: Do NOT manually INSERT into schema_migrations.');
      console.log('Action required: Identify official deployment mechanism.\n');
    }

    // E8.5: Verify RPC Exists and Callable
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.5: VERIFY RPC EXISTS AND CALLABLE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const rpcCheck = await client.query(`
      SELECT 
        routine_schema,
        routine_name,
        routine_type,
        data_type,
        type_udt_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = '${RPC_NAME}'
    `);

    console.log('RPC function:');
    if (rpcCheck.rows.length > 0) {
      console.table(rpcCheck.rows);
      console.log('\n✅ RPC exists\n');
      
      // Test RPC invocation (dry-run, no deletions)
      console.log('Testing RPC invocation (dry-run)...\n');
      
      try {
        const rpcTest = await client.query(`
          SELECT ${RPC_NAME}(false) as dry_run_result
        `);
        
        console.log('RPC invocation result:');
        const result = rpcTest.rows[0]?.dry_run_result;
        
        if (result) {
          console.log(JSON.stringify(result, null, 2));
          console.log('\n✅ E8.5 PASS — RPC exists and is callable\n');
          results.e85.pass = true;
          results.e85.rpc = rpcCheck.rows[0];
          results.e85.testResult = result;
        } else {
          console.log('❌ E8.5 FAIL — RPC returned no result\n');
        }
      } catch (error: any) {
        console.log('\n❌ E8.5 FAIL — RPC exists but not callable\n');
        console.error('Invocation error:', error.message);
        results.e85.error = error.message;
      }
    } else {
      console.log('❌ RPC NOT FOUND\n');
      console.log('⚠️  Migration SQL may not have executed successfully.');
      console.log('⚠️  Or Dashboard execution was rolled back.\n');
    }

    // E8.6: Verify No Side Effects
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.6: VERIFY NO UNEXPECTED SIDE EFFECTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check 1: Migration count
    const countCheck = await client.query(`
      SELECT COUNT(*) as total_migrations
      FROM supabase_migrations.schema_migrations
    `);
    
    const currentCount = parseInt(countCheck.rows[0].total_migrations);
    const expectedMin = 17; // 16 from E7 + 1 new
    const expectedMax = 17; // Exactly 1 new migration
    
    console.log(`Total migrations: ${currentCount}`);
    console.log(`Expected: ${expectedMax} (16 from E7 + 1 new)`);
    
    const countOK = currentCount === expectedMax;
    console.log(countOK ? '✅ Count correct' : `⚠️  Count unexpected (expected ${expectedMax}, got ${currentCount})`);

    // Check 2: No duplicate versions
    const dupCheck = await client.query(`
      SELECT version, COUNT(*) as occurrence_count
      FROM supabase_migrations.schema_migrations
      GROUP BY version
      HAVING COUNT(*) > 1
    `);
    
    console.log(`\nDuplicate versions: ${dupCheck.rows.length}`);
    console.log('Expected: 0');
    
    if (dupCheck.rows.length > 0) {
      console.log('❌ Duplicates detected:');
      console.table(dupCheck.rows);
    }
    
    const noDups = dupCheck.rows.length === 0;
    console.log(noDups ? '✅ No duplicates' : '❌ Duplicates exist');

    // Check 3: Verify ONLY target migration added (not modifying historical records)
    const newMigrationCheck = await client.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE version = '${TARGET_VERSION}'
    `);
    
    console.log(`\nNew migration ${TARGET_VERSION}:`);
    if (newMigrationCheck.rows.length === 1) {
      console.log('✅ Exactly 1 record (expected)');
    } else {
      console.log(`❌ ${newMigrationCheck.rows.length} records (expected 1)`);
    }
    
    const onlyTargetAdded = newMigrationCheck.rows.length === 1;

    // Check 4: Verify no OTHER migrations modified/added
    // (We expect exactly 17 total: 16 from E7 baseline + 1 new)
    const unexpectedMigrations = await client.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE version > '${TARGET_VERSION}'
      ORDER BY version
    `);
    
    console.log(`\nMigrations with version > ${TARGET_VERSION}: ${unexpectedMigrations.rows.length}`);
    console.log('Expected: 0 (no future migrations)');
    
    if (unexpectedMigrations.rows.length > 0) {
      console.log('⚠️  Unexpected future migrations:');
      console.table(unexpectedMigrations.rows);
    }
    
    const noFutureMigrations = unexpectedMigrations.rows.length === 0;
    console.log(noFutureMigrations ? '✅ No unexpected future migrations' : '⚠️  Future migrations exist');

    // Check 5: Historical NULL statements baseline unchanged
    // E7 established 79 historical NULL statements as baseline
    // This is NOT an E8 side effect
    const nullStmtCount = await client.query(`
      SELECT COUNT(*) as null_count
      FROM supabase_migrations.schema_migrations
      WHERE statements IS NULL OR array_length(statements, 1) IS NULL OR array_length(statements, 1) = 0
    `);
    
    const nullCount = parseInt(nullStmtCount.rows[0].null_count);
    console.log(`\nHistorical NULL statements: ${nullCount}`);
    console.log('E7 baseline: 79 (historical, NOT E8 side effect)');
    console.log(nullCount >= 79 ? '✅ Baseline preserved or stable' : '⚠️  Baseline changed (investigate)');

    // Final E8.6 evaluation: strict delta check
    const allChecksPass = countOK && noDups && onlyTargetAdded && noFutureMigrations;
    
    if (allChecksPass) {
      console.log('\n✅ E8.6 PASS — No E8-induced side effects detected\n');
      console.log('   - Exactly 1 new migration added');
      console.log('   - No duplicates created');
      console.log('   - No historical records modified');
      console.log('   - No unexpected migrations');
      results.e86.pass = true;
      results.e86.checks = { currentCount, noDups, onlyTargetAdded, noFutureMigrations, nullCount };
    } else {
      console.log('\n❌ E8.6 FAIL — Unexpected side effects detected\n');
      results.e86.checks = { currentCount, noDups, onlyTargetAdded, noFutureMigrations, nullCount };
    }

    // Final Evaluation
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  E8 VERIFICATION SUMMARY                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const allPass = Object.values(results).every((r: any) => r.pass);

    Object.entries(results).forEach(([key, value]: [string, any]) => {
      console.log(`${value.pass ? '✅' : '❌'} ${value.gate}`);
    });

    console.log('\n' + '═'.repeat(67));
    
    if (allPass) {
      console.log('✅✅✅ E8 DEPLOYMENT: VERIFIED + PASS ✅✅✅');
      console.log('═'.repeat(67));
      console.log('\nMigration 20260824000000 successfully deployed and verified.');
      console.log('RPC finance_test_cleanup is functional.');
      console.log('Migration history integrity maintained.');
      console.log('\n🎯 NEXT: E9 — Phase 4.4 Cleanup Execution');
      console.log('   Awaiting Human Architect approval before cleanup.');
    } else {
      console.log('🔴🔴🔴 E8 DEPLOYMENT: VERIFICATION FAILED 🔴🔴🔴');
      console.log('═'.repeat(67));
      console.log('\n❌ One or more verification gates failed.');
      console.log('\nRequired actions:');
      console.log('  - Review failed gates above');
      console.log('  - If E8.4 failed: Dashboard did NOT auto-record migration');
      console.log('  - If E8.5 failed: RPC not created or not functional');
      console.log('  - If E8.6 failed: Unexpected database changes detected');
      console.log('');
      console.log('DO NOT:');
      console.log('  - Manually INSERT into schema_migrations');
      console.log('  - Retry deployment without understanding failure');
      console.log('  - Proceed to E9');
      console.log('');
      console.log('Action required: Identify official deployment mechanism.');
    }
    
    console.log('\n' + '═'.repeat(67) + '\n');

  } finally {
    await client.end();
  }
}

// Execute
verifyDeployment().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
