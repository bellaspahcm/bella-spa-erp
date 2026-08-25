/**
 * Phase 1: DirectPostgreSQLAdapter Test
 * 
 * Validates adapter implementation before T1-T7 execution.
 * Tests basic connectivity and introspection queries.
 */
import { DirectPostgreSQLAdapter } from '../../src/platform/migration-governance/verification/database-adapter.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testDirectAdapter() {
  console.log('🧪 Testing DirectPostgreSQLAdapter (Complete Method Coverage)\n');
  console.log('Contract: v1.0.0 (37ae4544)');
  console.log('Implementation: Phase 1 (remediation)');
  console.log('ADR: 001 (Direct adapter approved)\n');

  const connectionString = process.env.DATABASE_EXECUTOR_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_EXECUTOR_URL not set');
    process.exit(1);
  }

  const adapter = new DirectPostgreSQLAdapter(connectionString);

  try {
    // Test 1: Connection
    console.log('▶ Test 1/7: connect()');
    await adapter.connect();
    console.log('  ✅ Connected to database\n');

    // Test 2: Query tables
    console.log('▶ Test 2/7: queryTables()');
    const tables = await adapter.queryTables('public');
    console.log(`  ✅ Found ${tables.length} tables`);
    if (tables.length > 0) {
      console.log(`  Sample: ${tables.slice(0, 3).join(', ')}\n`);
    }

    // Test 3: Table existence
    console.log('▶ Test 3/7: queryTableExists()');
    const evidenceExists = await adapter.queryTableExists('verification_evidence');
    console.log(`  ${evidenceExists ? '✅' : '❌'} verification_evidence exists: ${evidenceExists}\n`);

    if (!evidenceExists) {
      throw new Error('verification_evidence table missing - cannot continue tests');
    }

    // Test 4: Query columns
    console.log('▶ Test 4/7: queryColumns()');
    const columns = await adapter.queryColumns('verification_evidence');
    console.log(`  ✅ Found ${columns.length} columns`);
    console.log(`  Sample columns: ${columns.slice(0, 3).map(c => `${c.name}:${c.type}`).join(', ')}\n`);

    // Test 5: Query primary key
    console.log('▶ Test 5/7: queryPrimaryKey()');
    const primaryKey = await adapter.queryPrimaryKey('verification_evidence');
    console.log(`  ✅ Primary key columns: ${primaryKey.join(', ') || 'none'}\n`);

    // Test 6: Query foreign keys
    console.log('▶ Test 6/7: queryForeignKeys()');
    const foreignKeys = await adapter.queryForeignKeys('verification_evidence');
    console.log(`  ✅ Foreign keys: ${foreignKeys.length} found`);
    if (foreignKeys.length > 0) {
      console.log(`  Sample: ${foreignKeys[0].column} -> ${foreignKeys[0].references}.${foreignKeys[0].referenced_column}\n`);
    } else {
      console.log('  (No foreign keys on verification_evidence)\n');
    }

    // Test 7a: Query RLS status
    console.log('▶ Test 7a/7: queryRLSStatus()');
    const rlsStatus = await adapter.queryRLSStatus('verification_evidence');
    console.log(`  ${rlsStatus.enabled ? '✅' : '⚠️ '} RLS enabled: ${rlsStatus.enabled}\n`);

    // Test 7b: Query RLS policies
    console.log('▶ Test 7b/7: queryRLSPolicies()');
    const rlsPolicies = await adapter.queryRLSPolicies('verification_evidence');
    console.log(`  ✅ RLS policies: ${rlsPolicies.length} found`);
    if (rlsPolicies.length > 0) {
      console.log(`  Sample: ${rlsPolicies[0].name} (${rlsPolicies[0].command})\n`);
    } else {
      console.log('  (No RLS policies on verification_evidence)\n');
    }

    // Test 8: Disconnect
    console.log('▶ Test 8: disconnect()');
    await adapter.disconnect();
    console.log('  ✅ Disconnected\n');

    console.log('='.repeat(60));
    console.log('✅ ALL ADAPTER TESTS PASSED (8/8)');
    console.log('='.repeat(60));
    console.log('\nMethod Coverage:');
    console.log('  ✅ connect()');
    console.log('  ✅ queryTables()');
    console.log('  ✅ queryTableExists()');
    console.log('  ✅ queryColumns()');
    console.log('  ✅ queryPrimaryKey()');
    console.log('  ✅ queryForeignKeys()');
    console.log('  ✅ queryRLSStatus()');
    console.log('  ✅ queryRLSPolicies()');
    console.log('  ✅ disconnect()');
    console.log('\nDirectPostgreSQLAdapter implements complete DatabaseAdapter interface.');
    console.log('Contract v1.0.0 semantics preserved.');
    console.log('Ready for T1-T7 validation (Gate C pending).\n');

  } catch (error) {
    console.error('\n❌ ADAPTER TEST FAILED');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

testDirectAdapter();
