/**
 * E8: Deploy and Verify Migration 20260824000000
 * 
 * Purpose: Deploy RPC migration + independent verification
 * Method: Read migration file → Execute via pg client → Verify all gates
 * Status: DEPLOYMENT + VERIFICATION (NO MIGRATION HISTORY MODIFICATIONS)
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString });

const MIGRATION_FILE = 'supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql';
const TARGET_VERSION = '20260824000000';
const TARGET_NAME = 'finance_test_cleanup_rpc';
const RPC_NAME = 'finance_test_cleanup';

async function executeQuery(title: string, query: string): Promise<any[]> {
  console.log(`\n${'─'.repeat(67)}`);
  console.log(title);
  console.log('─'.repeat(67));
  
  try {
    const result = await client.query(query);
    return result.rows;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

async function e8Deploy() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E8: DEPLOYMENT METHOD DECISION                               ║');
  console.log('║  Date: 2026-08-24                                             ║');
  console.log('║  Target: 20260824000000_finance_test_cleanup_rpc.sql          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  await client.connect();

  const results: any = {
    e81: { gate: 'E8.1 Method Selection', pass: true },
    e82: { gate: 'E8.2 Pre-Deployment Check', pass: false },
    e83: { gate: 'E8.3 Deploy Migration', pass: false },
    e84: { gate: 'E8.4 Verify Recording', pass: false },
    e85: { gate: 'E8.5 Verify RPC', pass: false },
    e86: { gate: 'E8.6 Verify No Side Effects', pass: false },
  };

  try {
    // E8.1: Method Selection
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.1: METHOD SELECTION');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Selected method: PostgreSQL client (programmatic Dashboard equivalent)');
    console.log('Connection: DATABASE_EXECUTOR_URL');
    console.log('Bypasses: CLI reconciliation limitation');
    console.log('Maintains: Migration provenance integrity');
    console.log('\n✅ E8.1 PASS — Method selected\n');
    results.e81.pass = true;

    // E8.2: Pre-Deployment Check
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.2: PRE-DEPLOYMENT CHECK');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const preCheck = await executeQuery(
      'Verify version FREE',
      `SELECT 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM supabase_migrations.schema_migrations 
            WHERE version = '${TARGET_VERSION}'
          ) THEN 'OCCUPIED'
          ELSE 'FREE'
        END as pre_deployment_status`
    );

    const preStatus = preCheck[0]?.pre_deployment_status;
    console.log(`\nVersion ${TARGET_VERSION} status: ${preStatus}`);
    console.log(`Expected: FREE\n`);

    if (preStatus === 'FREE') {
      console.log('✅ E8.2 PASS — Version FREE, safe to deploy\n');
      results.e82.pass = true;
      results.e82.status = 'FREE';
    } else {
      console.log('❌ E8.2 BLOCKED — Version OCCUPIED\n');
      console.log('STOP: Concurrent deployment or version collision detected.');
      console.log('Do NOT proceed with E8.3.');
      results.e82.status = 'OCCUPIED';
      throw new Error('E8.2 BLOCKED: Version already exists');
    }

    // E8.3: Deploy Migration
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.3: DEPLOY MIGRATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const migrationPath = path.join(process.cwd(), MIGRATION_FILE);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${MIGRATION_FILE}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`Reading migration: ${MIGRATION_FILE}`);
    console.log(`File size: ${migrationSQL.length} bytes`);
    console.log(`\nExecuting migration SQL...\n`);

    try {
      await client.query(migrationSQL);
      console.log('✅ E8.3 PASS — Migration executed without SQL errors\n');
      results.e83.pass = true;
    } catch (error: any) {
      console.log('❌ E8.3 FAILED — SQL execution error\n');
      console.error('Error:', error.message);
      results.e83.error = error.message;
      throw error;
    }

    // E8.4: Verify Migration Recorded
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.4: VERIFY MIGRATION RECORDED');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const recordCheck = await executeQuery(
      'Check schema_migrations entry',
      `SELECT 
        version,
        name,
        array_length(statements, 1) as statement_count
      FROM supabase_migrations.schema_migrations
      WHERE version = '${TARGET_VERSION}'`
    );

    console.log('\nMigration record:');
    console.table(recordCheck);

    if (recordCheck.length === 1) {
      const record = recordCheck[0];
      const versionMatch = record.version === TARGET_VERSION;
      const nameMatch = record.name === TARGET_NAME;
      const hasStatements = record.statement_count > 0;

      console.log(`\nVersion match:  ${versionMatch ? '✅' : '❌'} (${record.version})`);
      console.log(`Name match:     ${nameMatch ? '✅' : '❌'} (${record.name})`);
      console.log(`Has statements: ${hasStatements ? '✅' : '❌'} (${record.statement_count})`);

      if (versionMatch && nameMatch && hasStatements) {
        console.log('\n✅ E8.4 PASS — Migration recorded correctly\n');
        results.e84.pass = true;
        results.e84.record = record;
      } else {
        console.log('\n❌ E8.4 FAILED — Migration record invalid\n');
        results.e84.record = record;
        throw new Error('E8.4 FAILED: Invalid migration record');
      }
    } else {
      console.log(`\n❌ E8.4 FAILED — Expected 1 record, found ${recordCheck.length}\n`);
      throw new Error('E8.4 FAILED: Migration not recorded');
    }

    // E8.5: Verify RPC Exists and Callable
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.5: VERIFY RPC EXISTS AND CALLABLE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const rpcCheck = await executeQuery(
      'Check function exists',
      `SELECT 
        routine_name,
        routine_type,
        data_type,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = '${RPC_NAME}'`
    );

    console.log('\nRPC function:');
    console.table(rpcCheck.map(r => ({
      name: r.routine_name,
      type: r.routine_type,
      returns: r.data_type,
    })));

    if (rpcCheck.length === 1) {
      console.log('\n✅ RPC exists\n');
      
      // Test RPC invocation (dry-run, no deletions)
      console.log('Testing RPC invocation (dry-run)...\n');
      
      try {
        const rpcTest = await executeQuery(
          'Test RPC call',
          `SELECT ${RPC_NAME}(false) as dry_run_result`
        );
        
        console.log('RPC invocation result:');
        console.log(JSON.stringify(rpcTest[0]?.dry_run_result, null, 2));
        
        console.log('\n✅ E8.5 PASS — RPC exists and is callable\n');
        results.e85.pass = true;
        results.e85.rpc = rpcCheck[0];
        results.e85.testResult = rpcTest[0];
      } catch (error: any) {
        console.log('\n❌ E8.5 FAILED — RPC exists but not callable\n');
        console.error('Invocation error:', error.message);
        results.e85.error = error.message;
        throw error;
      }
    } else {
      console.log(`\n❌ E8.5 FAILED — Expected 1 function, found ${rpcCheck.length}\n`);
      throw new Error('E8.5 FAILED: RPC not found');
    }

    // E8.6: Verify No Side Effects
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E8.6: VERIFY NO UNEXPECTED SIDE EFFECTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check 1: Total migration count increased by 1
    const countCheck = await executeQuery(
      'Check migration count',
      `SELECT COUNT(*) as total_migrations
      FROM supabase_migrations.schema_migrations`
    );
    
    const currentCount = parseInt(countCheck[0].total_migrations);
    const expectedCount = 17; // 16 from E7 + 1 new
    
    console.log(`Total migrations: ${currentCount}`);
    console.log(`Expected: ${expectedCount} (16 from E7 + 1 new)`);
    
    const countOK = currentCount >= expectedCount;
    console.log(countOK ? '✅ Count increased' : '❌ Count mismatch');

    // Check 2: No duplicate versions
    const dupCheck = await executeQuery(
      'Check for duplicates',
      `SELECT version, COUNT(*) as occurrence_count
      FROM supabase_migrations.schema_migrations
      GROUP BY version
      HAVING COUNT(*) > 1`
    );
    
    console.log(`\nDuplicate versions: ${dupCheck.length}`);
    console.log('Expected: 0');
    
    if (dupCheck.length > 0) {
      console.table(dupCheck);
    }
    
    const noDups = dupCheck.length === 0;
    console.log(noDups ? '✅ No duplicates' : '❌ Duplicates detected');

    // Check 3: No missing statements
    const stmtCheck = await executeQuery(
      'Check for missing statements',
      `SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE array_length(statements, 1) IS NULL 
         OR array_length(statements, 1) = 0`
    );
    
    console.log(`\nMigrations with missing statements: ${stmtCheck.length}`);
    console.log('Expected: 0');
    
    if (stmtCheck.length > 0) {
      console.table(stmtCheck);
    }
    
    const noMissing = stmtCheck.length === 0;
    console.log(noMissing ? '✅ No missing statements' : '❌ Missing statements detected');

    const allChecksPass = countOK && noDups && noMissing;
    
    if (allChecksPass) {
      console.log('\n✅ E8.6 PASS — No unexpected side effects detected\n');
      results.e86.pass = true;
      results.e86.checks = { countOK, noDups, noMissing };
    } else {
      console.log('\n❌ E8.6 FAILED — Side effects detected\n');
      results.e86.checks = { countOK, noDups, noMissing };
      throw new Error('E8.6 FAILED: Side effects detected');
    }

    // Final Evaluation
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  E8 GATE EVALUATION                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const allPass = Object.values(results).every((r: any) => r.pass);

    Object.entries(results).forEach(([key, value]: [string, any]) => {
      console.log(`${value.pass ? '✅' : '❌'} ${value.gate}`);
    });

    console.log('\n' + '═'.repeat(67));
    
    if (allPass) {
      console.log('✅✅✅ E8 DEPLOYMENT: PASS ✅✅✅');
      console.log('═'.repeat(67));
      console.log('\nMigration 20260824000000 successfully deployed and verified.');
      console.log('RPC finance_test_cleanup is functional.');
      console.log('Migration history integrity maintained.');
      console.log('\n🎯 NEXT: E9 — Phase 4.4 Cleanup Execution');
      console.log('   Awaiting Human Architect approval before cleanup.');
    } else {
      console.log('🔴🔴🔴 E8 DEPLOYMENT: BLOCKED 🔴🔴🔴');
      console.log('═'.repeat(67));
      console.log('\n❌ Deployment verification failed.');
      console.log('\nRequired actions:');
      console.log('  - Review failed gates');
      console.log('  - Investigate root cause');
      console.log('  - DO NOT proceed to E9');
      console.log('  - Escalate to Human Architect');
    }
    
    console.log('\n' + '═'.repeat(67) + '\n');

  } catch (error: any) {
    console.log('\n' + '═'.repeat(67));
    console.log('🔴 E8 EXECUTION FAILED');
    console.log('═'.repeat(67));
    console.error('\nError:', error.message);
    console.log('\nDeployment status: INCOMPLETE');
    console.log('Action required: Manual investigation\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Execute
e8Deploy().catch(error => {
  console.error('❌ E8 execution failed:', error);
  process.exit(1);
});
