/**
 * E8.4A: Inspect Actual Database State
 * 
 * Purpose: Determine what actually happened during E8.3 execution
 * Method: Read-only queries to verify RPC + migration state
 * Status: NO MODIFICATIONS
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

async function inspectState() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E8.4A: INSPECT ACTUAL DATABASE STATE                         ║');
  console.log('║  Status: READ-ONLY (NO MODIFICATIONS)                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  await client.connect();

  try {
    // Query 1: Check if RPC exists
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('QUERY 1: RPC EXISTENCE CHECK');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const rpcCheck = await client.query(`
      SELECT
        routine_schema,
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'finance_test_cleanup'
    `);

    console.log('Result:');
    if (rpcCheck.rows.length > 0) {
      console.table(rpcCheck.rows);
      console.log('\n✅ RPC EXISTS\n');
    } else {
      console.log('❌ RPC NOT FOUND\n');
    }

    // Query 2: Check if migration recorded
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('QUERY 2: MIGRATION RECORDING CHECK');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const migrationCheck = await client.query(`
      SELECT *
      FROM supabase_migrations.schema_migrations
      WHERE version = '20260824000000'
    `);

    console.log('Result:');
    if (migrationCheck.rows.length > 0) {
      console.table(migrationCheck.rows);
      console.log('\n✅ MIGRATION RECORDED\n');
    } else {
      console.log('❌ MIGRATION NOT RECORDED\n');
    }

    // Query 3: RPC signature inspection (if RPC exists)
    if (rpcCheck.rows.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('QUERY 3: RPC SIGNATURE INSPECTION');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const signatureCheck = await client.query(`
        SELECT
          n.nspname AS schema_name,
          p.proname AS function_name,
          pg_get_function_identity_arguments(p.oid) AS arguments,
          pg_get_function_result(p.oid) AS return_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'finance_test_cleanup'
      `);

      console.log('RPC Signature:');
      console.table(signatureCheck.rows);
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  E8.4A INSPECTION SUMMARY                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const rpcExists = rpcCheck.rows.length > 0;
    const migrationRecorded = migrationCheck.rows.length > 0;

    console.log(`RPC exists:           ${rpcExists ? '✅ YES' : '❌ NO'}`);
    console.log(`Migration recorded:   ${migrationRecorded ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // State classification
    if (rpcExists && migrationRecorded) {
      console.log('🟢 STATE: COMPLETE');
      console.log('   Both RPC and migration history exist.');
      console.log('   E8.4 false failure (query issue?).');
      console.log('   Action: Re-verify E8.4-E8.6.');
    } else if (rpcExists && !migrationRecorded) {
      console.log('🟡 STATE: INCONSISTENT');
      console.log('   RPC created but migration history missing.');
      console.log('   Cause: Direct pg execution bypasses migration recording.');
      console.log('   Action: Determine correct deployment mechanism.');
      console.log('');
      console.log('   Options:');
      console.log('   A. Record migration manually (governance review required)');
      console.log('   B. Rollback RPC and redeploy via correct mechanism');
      console.log('   C. Accept inconsistency if RPC is correct');
    } else if (!rpcExists && migrationRecorded) {
      console.log('🔴 STATE: CORRUPTED');
      console.log('   Migration recorded but RPC missing.');
      console.log('   This should not happen.');
      console.log('   Action: Investigate + rollback migration record.');
    } else {
      console.log('🟢 STATE: CLEAN');
      console.log('   Neither RPC nor migration exist.');
      console.log('   E8.3 SQL execution failed silently or was rolled back.');
      console.log('   Action: Retry deployment via correct mechanism.');
    }

    console.log('\n' + '═'.repeat(67));
    console.log('⚠️  DO NOT MODIFY schema_migrations YET');
    console.log('Share this output with Human Architect for decision.');
    console.log('═'.repeat(67) + '\n');

  } finally {
    await client.end();
  }
}

// Execute
inspectState().catch(error => {
  console.error('❌ Inspection failed:', error);
  process.exit(1);
});
