#!/usr/bin/env node
/**
 * BDGF Database Primitives - Independent Test
 * 
 * Tests each new database primitive with non-Amendment-12 data
 * to prove they are generic and reusable.
 * 
 * Purpose: Validate boundary discipline before using in E0
 */

import { CheckRegistry } from './check-registry.mjs';
import dotenv from 'dotenv';

dotenv.config();

let testsPassed = 0;
let testsFailed = 0;

function pass(testName) {
  console.log(`✅ ${testName}`);
  testsPassed++;
}

function fail(testName, details) {
  console.log(`❌ ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  testsFailed++;
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║ BDGF DATABASE PRIMITIVES - INDEPENDENT TEST                     ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');
console.log('Purpose: Test new database primitives with non-Amendment-12 data');
console.log('Goal: Prove primitives are generic and reusable\n');

async function testDatabaseTableExists() {
  console.log('\n─── TEST 1: database-table-exists (generic capability) ───\n');

  // Test 1.1: Check existing table (public.tenants)
  try {
    const result = await CheckRegistry.execute('database-table-exists', {
      id: 'test-1-1',
      name: 'Check public.tenants exists',
      schema: 'public',
      tableName: 'tenants',
      expectExists: true
    });

    if (result.status === 'PASS') {
      pass('Test 1.1: Existing table detected (public.tenants)');
    } else {
      fail('Test 1.1: Should detect existing table', result.message);
    }
  } catch (error) {
    fail('Test 1.1: Exception', error.message);
  }

  // Test 1.2: Check non-existing table
  try {
    const result = await CheckRegistry.execute('database-table-exists', {
      id: 'test-1-2',
      name: 'Check nonexistent_table does NOT exist',
      schema: 'public',
      tableName: 'nonexistent_test_table_xyz',
      expectExists: false
    });

    if (result.status === 'PASS') {
      pass('Test 1.2: Non-existing table detected correctly');
    } else {
      fail('Test 1.2: Should detect non-existing table', result.message);
    }
  } catch (error) {
    fail('Test 1.2: Exception', error.message);
  }

  // Test 1.3: Inverted check (existing table, expect NOT exists) - should FAIL
  try {
    const result = await CheckRegistry.execute('database-table-exists', {
      id: 'test-1-3',
      name: 'Check public.tenants does NOT exist (inverted)',
      schema: 'public',
      tableName: 'tenants',
      expectExists: false
    });

    if (result.status === 'FAIL') {
      pass('Test 1.3: Inverted check fails correctly (table exists but expected not to)');
    } else {
      fail('Test 1.3: Should fail when table exists but expected not to');
    }
  } catch (error) {
    fail('Test 1.3: Exception', error.message);
  }
}

async function testDatabaseColumnType() {
  console.log('\n─── TEST 2: database-column-type (generic capability) ───\n');

  // Test 2.1: Check UUID column type (public.tenants.id)
  try {
    const result = await CheckRegistry.execute('database-column-type', {
      id: 'test-2-1',
      name: 'Check public.tenants.id type = uuid',
      schema: 'public',
      tableName: 'tenants',
      columnName: 'id',
      expectedTypes: ['uuid']
    });

    if (result.status === 'PASS') {
      pass('Test 2.1: UUID column type detected (public.tenants.id)');
    } else {
      fail('Test 2.1: Should detect uuid type', result.message);
    }
  } catch (error) {
    fail('Test 2.1: Exception', error.message);
  }

  // Test 2.2: Check TEXT column with type aliases
  try {
    const result = await CheckRegistry.execute('database-column-type', {
      id: 'test-2-2',
      name: 'Check text column with aliases',
      schema: 'public',
      tableName: 'tenants',
      columnName: 'name',
      expectedTypes: ['text', 'character varying'] // Allow both
    });

    if (result.status === 'PASS') {
      pass('Test 2.2: Text column type detected (with aliases)');
    } else {
      fail('Test 2.2: Should detect text type', result.message);
    }
  } catch (error) {
    fail('Test 2.2: Exception', error.message);
  }

  // Test 2.3: Wrong type expectation - should FAIL
  try {
    const result = await CheckRegistry.execute('database-column-type', {
      id: 'test-2-3',
      name: 'Check wrong type (expect integer, actually uuid)',
      schema: 'public',
      tableName: 'tenants',
      columnName: 'id',
      expectedTypes: ['integer']
    });

    if (result.status === 'FAIL') {
      pass('Test 2.3: Type mismatch detected correctly');
    } else {
      fail('Test 2.3: Should fail on type mismatch');
    }
  } catch (error) {
    fail('Test 2.3: Exception', error.message);
  }
}

async function testDatabaseSchemaExists() {
  console.log('\n─── TEST 3: database-schema-exists (generic capability) ───\n');

  // Test 3.1: Check existing schema (public)
  try {
    const result = await CheckRegistry.execute('database-schema-exists', {
      id: 'test-3-1',
      name: 'Check public schema exists',
      schemaName: 'public',
      expectExists: true
    });

    if (result.status === 'PASS') {
      pass('Test 3.1: Existing schema detected (public)');
    } else {
      fail('Test 3.1: Should detect existing schema', result.message);
    }
  } catch (error) {
    fail('Test 3.1: Exception', error.message);
  }

  // Test 3.2: Check non-existing schema
  try {
    const result = await CheckRegistry.execute('database-schema-exists', {
      id: 'test-3-2',
      name: 'Check nonexistent schema does NOT exist',
      schemaName: 'nonexistent_test_schema_xyz',
      expectExists: false
    });

    if (result.status === 'PASS') {
      pass('Test 3.2: Non-existing schema detected correctly');
    } else {
      fail('Test 3.2: Should detect non-existing schema', result.message);
    }
  } catch (error) {
    fail('Test 3.2: Exception', error.message);
  }
}

async function testDatabaseQuery() {
  console.log('\n─── TEST 4: database-query (generic capability) ───\n');

  // Test 4.1: Simple count query
  try {
    const result = await CheckRegistry.execute('database-query', {
      id: 'test-4-1',
      name: 'Count tenants (generic query)',
      query: 'SELECT COUNT(*) as count FROM public.tenants',
      params: [],
      expectedResult: null // Don't check specific count, just execute
    });

    if (result.status === 'PASS') {
      pass('Test 4.1: Query executed successfully');
    } else {
      fail('Test 4.1: Should execute query', result.message);
    }
  } catch (error) {
    fail('Test 4.1: Exception', error.message);
  }

  // Test 4.2: Parameterized query
  try {
    const result = await CheckRegistry.execute('database-query', {
      id: 'test-4-2',
      name: 'Parameterized query (check table exists)',
      query: `SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      params: ['public', 'tenants'],
      expectedResult: { exists: true }
    });

    if (result.status === 'PASS') {
      pass('Test 4.2: Parameterized query executed with result verification');
    } else {
      fail('Test 4.2: Should execute parameterized query', result.message);
    }
  } catch (error) {
    fail('Test 4.2: Exception', error.message);
  }

  // Test 4.3: Result mismatch - should FAIL
  try {
    const result = await CheckRegistry.execute('database-query', {
      id: 'test-4-3',
      name: 'Query with wrong expected result',
      query: 'SELECT COUNT(*) as count FROM public.tenants',
      params: [],
      expectedResult: { count: 99999 } // Unlikely to match
    });

    if (result.status === 'FAIL') {
      pass('Test 4.3: Result mismatch detected correctly');
    } else {
      fail('Test 4.3: Should fail on result mismatch');
    }
  } catch (error) {
    fail('Test 4.3: Exception', error.message);
  }
}

async function testDatabaseVersion() {
  console.log('\n─── TEST 5: database-version (generic capability) ───\n');

  // Test 5.1: Check PostgreSQL version >= 12
  try {
    const result = await CheckRegistry.execute('database-version', {
      id: 'test-5-1',
      name: 'Check PostgreSQL >= 12',
      minVersion: '12.0',
      expectedDatabase: 'postgresql'
    });

    if (result.status === 'PASS') {
      pass('Test 5.1: Database version meets minimum (>= 12)');
    } else {
      fail('Test 5.1: Should meet version requirement', result.message);
    }
  } catch (error) {
    fail('Test 5.1: Exception', error.message);
  }

  // Test 5.2: Check version >= 9 (should pass on modern PostgreSQL)
  try {
    const result = await CheckRegistry.execute('database-version', {
      id: 'test-5-2',
      name: 'Check PostgreSQL >= 9',
      minVersion: '9.0'
    });

    if (result.status === 'PASS') {
      pass('Test 5.2: Database version meets lower minimum (>= 9)');
    } else {
      fail('Test 5.2: Should meet version requirement', result.message);
    }
  } catch (error) {
    fail('Test 5.2: Exception', error.message);
  }

  // Test 5.3: Unrealistic version requirement - should FAIL
  try {
    const result = await CheckRegistry.execute('database-version', {
      id: 'test-5-3',
      name: 'Check PostgreSQL >= 99 (unrealistic)',
      minVersion: '99.0'
    });

    if (result.status === 'FAIL') {
      pass('Test 5.3: Version requirement not met (correctly fails)');
    } else {
      fail('Test 5.3: Should fail on unrealistic version requirement');
    }
  } catch (error) {
    fail('Test 5.3: Exception', error.message);
  }
}

async function testDatabasePrivilege() {
  console.log('\n─── TEST 6: database-privilege (generic capability) ───\n');

  // Test 6.1: Check schema CREATE privilege
  try {
    const result = await CheckRegistry.execute('database-privilege', {
      id: 'test-6-1',
      name: 'Check CREATE privilege on public schema',
      privileges: [
        { type: 'schema', name: 'public', privilege: 'CREATE' }
      ]
    });

    if (result.status === 'PASS') {
      pass('Test 6.1: Schema privilege verified (CREATE on public)');
    } else {
      fail('Test 6.1: Should have CREATE privilege', result.message);
    }
  } catch (error) {
    fail('Test 6.1: Exception', error.message);
  }

  // Test 6.2: Check database CREATE privilege
  try {
    const result = await CheckRegistry.execute('database-privilege', {
      id: 'test-6-2',
      name: 'Check CREATE privilege on database',
      privileges: [
        { type: 'database', privilege: 'CREATE' }
      ]
    });

    if (result.status === 'PASS') {
      pass('Test 6.2: Database privilege verified (CREATE)');
    } else {
      fail('Test 6.2: Should have CREATE privilege', result.message);
    }
  } catch (error) {
    fail('Test 6.2: Exception', error.message);
  }

  // Test 6.3: Multiple privileges
  try {
    const result = await CheckRegistry.execute('database-privilege', {
      id: 'test-6-3',
      name: 'Check multiple privileges',
      privileges: [
        { type: 'schema', name: 'public', privilege: 'CREATE' },
        { type: 'schema', name: 'public', privilege: 'USAGE' }
      ]
    });

    if (result.status === 'PASS') {
      pass('Test 6.3: Multiple privileges verified');
    } else {
      fail('Test 6.3: Should have all privileges', result.message);
    }
  } catch (error) {
    fail('Test 6.3: Exception', error.message);
  }
}

async function main() {
  try {
    await testDatabaseTableExists();
    await testDatabaseColumnType();
    await testDatabaseSchemaExists();
    await testDatabaseQuery();
    await testDatabaseVersion();
    await testDatabasePrivilege();

    // Final report
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║ TEST RESULTS                                                     ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Tests:  ${testsPassed + testsFailed}`.padEnd(67) + '║');
    console.log(`║ ✅ PASS:       ${testsPassed}`.padEnd(67) + '║');
    console.log(`║ ❌ FAIL:        ${testsFailed}`.padEnd(67) + '║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    if (testsFailed > 0) {
      console.log('❌ DATABASE PRIMITIVES TEST: FAIL\n');
      console.log('Some primitives did not behave as expected.');
      console.log('Fix issues before using in E0 configuration.\n');
      process.exit(1);
    } else {
      console.log('✅ DATABASE PRIMITIVES TEST: PASS\n');
      console.log('All 6 database primitives are:');
      console.log('  ✅ Generic (work with any table/column/schema)');
      console.log('  ✅ Parameterized (no hardcoded domain logic)');
      console.log('  ✅ Reusable (tested with non-Amendment-12 data)');
      console.log('  ✅ Boundary-safe (no domain knowledge in primitives)\n');
      console.log('✅ Ready to use in E0 configuration\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ TEST SUITE EXCEPTION\n');
    console.error('Error during test execution:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

main();
