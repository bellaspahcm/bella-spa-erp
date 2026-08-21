#!/usr/bin/env node
/**
 * E1 GATE: DATABASE STATE VERIFICATION (Schema-Safe Absolute)
 * 
 * Purpose: Verify runtime preconditions before Migration 05-A execution.
 *          Uses schema-safe absolute introspection (Amendment 12 v3 Correction 3).
 * 
 * Amendment: Amendment 12 v3
 * Gate: E1 (preflight for 05-A/B/C)
 * 
 * CRITICAL: This is a READ-ONLY verification gate.
 *           NO mutations, NO schema changes, NO data modifications.
 *           Runs verification BEFORE E1 SQL function is deployed.
 * 
 * Exit Codes:
 *   0 = PASS (all checks pass, proceed to Human GO decision)
 *   1 = FAIL (critical issue detected, STOP before 05-A)
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function pass(checkName, details = 'OK') {
  console.log(`✅ ${checkName}`);
  if (details !== 'OK') {
    console.log(`   ${details}`);
  }
  passCount++;
}

function fail(checkName, details) {
  console.log(`❌ ${checkName}`);
  console.log(`   ${details}`);
  failCount++;
}

function warn(checkName, details) {
  console.log(`⚠️  ${checkName}`);
  console.log(`   ${details}`);
  warnCount++;
}

async function runE1() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ E1 GATE: DATABASE STATE VERIFICATION (Schema-Safe Absolute)                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Amendment: Amendment 12 v3 (APPROVED)                                        ║');
  console.log('║ Mode: READ-ONLY (0 mutations)                                                ║');
  console.log('║ Strategy: Direct verification without deploying E1 SQL function              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Database connection established\n');

    // ========================================================================
    // CHECK 1: Fixture Count
    // ========================================================================
    console.log('CHECK 1: Fixture Count\n');
    const fixtureResult = await client.query(`
      SELECT COUNT(*) as count
      FROM runtime_tenant_registry
      WHERE tenant_id IN (
        'test-e2e-tenant-a',
        'test-e2e-tenant-b',
        'test-e2e-tenant-attacker',
        'test-quarantine-tenant-a',
        'test-quarantine-tenant-b'
      )
    `);
    const fixtureCount = parseInt(fixtureResult.rows[0].count);
    if (fixtureCount === 5) {
      pass('Fixture count', '5/5 TEXT fixtures present');
    } else {
      fail('Fixture count', `Expected 5, found ${fixtureCount}. Migration 05 requires all 5 fixtures.`);
    }

    // ========================================================================
    // CHECK 2: RLS Policy State (Schema-Safe)
    // ========================================================================
    console.log('\nCHECK 2: RLS Policy State\n');
    
    // Introspect if RLS columns exist
    const rlsColumnsResult = await client.query(`
      SELECT 
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='runtime_tenant_registry' AND column_name='tenant_id') as has_tenant_id,
        EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='runtime_tenant_registry') as table_exists
    `);
    
    if (!rlsColumnsResult.rows[0].table_exists) {
      fail('RLS policy state', 'runtime_tenant_registry table does not exist');
    } else {
      // Check RLS enabled
      const rlsEnabledResult = await client.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.runtime_tenant_registry'::regclass
      `);
      
      if (rlsEnabledResult.rows[0].relrowsecurity) {
        pass('RLS enabled', 'Row-level security is enabled on runtime_tenant_registry');
      } else {
        warn('RLS enabled', 'RLS is NOT enabled. This is acceptable if tenant isolation not required yet.');
      }

      // Check policy count
      const policyCountResult = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'runtime_tenant_registry'
      `);
      const policyCount = parseInt(policyCountResult.rows[0].count);
      pass('RLS policy count', `${policyCount} policies found`);
    }

    // ========================================================================
    // CHECK 3: Migration History (no 05-A/B/C executed yet)
    // ========================================================================
    console.log('\nCHECK 3: Migration History\n');
    
    const migrationSchemaExists = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = 'migration_evidence'
      ) AS exists
    `);
    
    if (!migrationSchemaExists.rows[0].exists) {
      pass('Migration history', 'migration_evidence schema does NOT exist (clean state)');
    } else {
      fail('Migration history', 'migration_evidence schema already exists. Migration 05-A already executed?');
    }

    // ========================================================================
    // CHECK 4: Orphan Detection (expected: 2 orphans)
    // ========================================================================
    console.log('\nCHECK 4: Orphan Detection\n');
    
    const orphanResult = await client.query(`
      SELECT COUNT(*) as count
      FROM runtime_tenant_registry
      WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b')
    `);
    const orphanCount = parseInt(orphanResult.rows[0].count);
    if (orphanCount === 2) {
      pass('Orphan detection', '2/2 orphan fixtures detected (test-quarantine-tenant-a/b)');
    } else {
      fail('Orphan detection', `Expected 2 orphans, found ${orphanCount}`);
    }

    // ========================================================================
    // CHECK 5: Schema Compatibility (tenant_id = TEXT)
    // ========================================================================
    console.log('\nCHECK 5: Schema Compatibility\n');
    
    const tenantIdTypeResult = await client.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'runtime_tenant_registry'
        AND column_name = 'tenant_id'
    `);
    
    if (tenantIdTypeResult.rows.length === 0) {
      fail('Schema compatibility', 'tenant_id column does not exist');
    } else {
      const dataType = tenantIdTypeResult.rows[0].data_type;
      if (dataType === 'text' || dataType === 'character varying') {
        pass('Schema compatibility', `tenant_id type = ${dataType} (TEXT-based, correct precondition)`);
      } else {
        fail('Schema compatibility', `tenant_id type = ${dataType}. Expected TEXT, found UUID. Migration 05-C already executed?`);
      }
    }

    // ========================================================================
    // CHECK 6: No FK Constraints Yet
    // ========================================================================
    console.log('\nCHECK 6: FK Constraint Absence\n');
    
    const fkResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'runtime_tenant_registry'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.column_name = 'tenant_id'
    `);
    const fkCount = parseInt(fkResult.rows[0].count);
    if (fkCount === 0) {
      pass('FK constraint absence', 'No FK constraint on tenant_id (precondition for 05-C)');
    } else {
      fail('FK constraint absence', `${fkCount} FK constraint(s) found. Migration 05-C already executed?`);
    }

    // ========================================================================
    // CHECK 7: public.tenants Existence
    // ========================================================================
    console.log('\nCHECK 7: Canonical Tenant Table\n');
    
    const tenantsExistsResult = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenants'
      ) AS exists
    `);
    
    if (tenantsExistsResult.rows[0].exists) {
      pass('Canonical tenant table', 'public.tenants exists (canonical identity authority)');
      
      // Verify tenants.id type = UUID
      const tenantsIdTypeResult = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'id'
      `);
      
      if (tenantsIdTypeResult.rows.length > 0 && tenantsIdTypeResult.rows[0].data_type === 'uuid') {
        pass('Canonical identity type', 'public.tenants.id type = uuid (authority confirmed)');
      } else {
        fail('Canonical identity type', 'public.tenants.id is not UUID type');
      }
    } else {
      fail('Canonical tenant table', 'public.tenants does not exist. Migration 05-B requires this table.');
    }

    // ========================================================================
    // CHECK 8: Database Privileges
    // ========================================================================
    console.log('\nCHECK 8: Database Privileges\n');
    
    const privilegesResult = await client.query(`
      SELECT 
        has_schema_privilege(CURRENT_USER, 'public', 'CREATE') as can_create_in_public,
        has_database_privilege(CURRENT_DATABASE(), 'CREATE') as can_create_schema
    `);
    const privileges = privilegesResult.rows[0];
    if (privileges.can_create_in_public && privileges.can_create_schema) {
      pass('Database privileges', 'CREATE schema and table privileges confirmed');
    } else {
      fail('Database privileges', `Insufficient privileges. can_create_in_public=${privileges.can_create_in_public}, can_create_schema=${privileges.can_create_schema}`);
    }

    await client.end();

    // ========================================================================
    // FINAL REPORT
    // ========================================================================
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ E1 GATE VERIFICATION RESULTS                                                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Checks:  ${passCount + failCount + warnCount}`.padEnd(79) + '║');
    console.log(`║ ✅ PASS:       ${passCount}`.padEnd(79) + '║');
    console.log(`║ ❌ FAIL:        ${failCount}`.padEnd(79) + '║');
    console.log(`║ ⚠️  WARNING:    ${warnCount}`.padEnd(79) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (failCount > 0) {
      console.log('║ STATUS: ❌ FAIL                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n❌ E1 GATE: FAIL\n');
      console.log('RESOLUTION REQUIRED:');
      console.log('- Review failed checks above');
      console.log('- Fix runtime precondition violations');
      console.log('- Re-run E1 verification after fixes\n');
      console.log('🔴 DO NOT proceed to Human GO until E1 passes\n');
      process.exit(1);
    } else if (warnCount > 0) {
      console.log('║ STATUS: ⚠️  PASS WITH WARNINGS                                                ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n⚠️  E1 GATE: PASS WITH WARNINGS\n');
      console.log('Review warnings above before Human GO decision.\n');
      console.log('NEXT STEP: Human GO decision for Migration 05-A execution\n');
      console.log('⚠️  Warnings do not block execution, but review recommended\n');
      process.exit(0);
    } else {
      console.log('║ STATUS: ✅ PASS                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n✅ E1 GATE: PASS\n');
      console.log('All runtime preconditions verified:');
      console.log('  ✅ 5/5 fixtures present');
      console.log('  ✅ RLS state acceptable');
      console.log('  ✅ No previous migration execution');
      console.log('  ✅ 2/2 orphans detected');
      console.log('  ✅ tenant_id = TEXT (pre-05-C state)');
      console.log('  ✅ No FK constraints');
      console.log('  ✅ public.tenants exists (canonical authority)');
      console.log('  ✅ Database privileges sufficient\n');
      console.log('NEXT STEP: Human GO decision for Migration 05-A execution\n');
      console.log('⚠️  REMINDER: Human approval required before executing 05-A\n');
      console.log('Database mutations: 0 (E1 is READ-ONLY verification)\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ E1 GATE: EXCEPTION\n');
    console.error('Error during verification:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n🔴 STOP. Fix verification logic or database connection.\n');
    await client.end();
    process.exit(1);
  }
}

runE1();
