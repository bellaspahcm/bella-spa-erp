#!/usr/bin/env node
/**
 * E0 GATE: ARTIFACT + ENVIRONMENT + PRECONDITION INTEGRITY
 * 
 * Purpose: Verify package integrity, dependency state, execution preconditions,
 *          and gate independence BEFORE allowing E1 execution.
 * 
 * Amendment: Amendment 12 v3
 * Migration: 05-A/B/C Identity Reconciliation
 * 
 * CRITICAL: This is NOT a migration execution gate.
 *           This is a pre-execution artifact/environment verification gate.
 * 
 * Exit Codes:
 *   0 = PASS (all checks pass, proceed to E1)
 *   1 = FAIL (critical issue detected, STOP before E1)
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const REQUIRED_MIGRATIONS = [
  'supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql',
  'supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql',
  'supabase/migrations/20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql',
  'supabase/migrations/20260819050002_runtime_migration_05b_canonical_tenant_creation.sql',
  'supabase/migrations/20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql',
  'supabase/migrations/20260819050004_runtime_migration_e3_post_05c_verification.sql',
];

const REQUIRED_SCRIPTS = [
  'scripts/verify-amendment-12-v3-package-integrity.mjs',
  'scripts/run-e1-verification.mjs',
  'scripts/run-e0-artifact-integrity-gate.mjs',
];

const REQUIRED_DOCS = [
  'docs/architecture/BELLA_RUNTIME_MIGRATION_05_PACKAGE_REVIEW.md',
];

// ============================================================================
// UTILITIES
// ============================================================================

let checksPassed = 0;
let checksFailed = 0;
let checksWarning = 0;

function pass(checkName) {
  console.log(`✅ ${checkName}`);
  checksPassed++;
}

function fail(checkName, details) {
  console.log(`❌ ${checkName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  checksFailed++;
}

function warn(checkName, details) {
  console.log(`⚠️  ${checkName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  checksWarning++;
}

function fileHash(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ============================================================================
// GROUP A: ARTIFACT INTEGRITY
// ============================================================================

async function verifyArtifactIntegrity() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ E0 GATE — GROUP A: ARTIFACT INTEGRITY                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Requirement: All migration files, verifiers, and gates exist');
  console.log('             with expected content structure.\n');

  // A1: Migration files exist
  for (const file of REQUIRED_MIGRATIONS) {
    if (fs.existsSync(file)) {
      const hash = fileHash(file);
      pass(`Migration file exists: ${path.basename(file)} (${hash})`);
    } else {
      fail(`Migration file missing: ${file}`);
    }
  }

  // A2: Verification scripts exist
  for (const file of REQUIRED_SCRIPTS) {
    if (fs.existsSync(file)) {
      const hash = fileHash(file);
      pass(`Verification script exists: ${path.basename(file)} (${hash})`);
    } else {
      fail(`Verification script missing: ${file}`);
    }
  }

  // A3: Documentation exists
  for (const file of REQUIRED_DOCS) {
    if (fs.existsSync(file)) {
      const hash = fileHash(file);
      pass(`Documentation exists: ${path.basename(file)} (${hash})`);
    } else {
      fail(`Documentation missing: ${file}`);
    }
  }

  // A4: Verify migration file structure
  const migration05A = fs.readFileSync(REQUIRED_MIGRATIONS[1], 'utf-8');
  if (migration05A.includes('CREATE TABLE migration_evidence.canonical_tenant_map')) {
    pass('05-A structure: canonical_tenant_map table definition present');
  } else {
    fail('05-A structure: canonical_tenant_map table definition missing');
  }

  if (migration05A.includes('migration_05a_preflight_p4_collision_gate')) {
    pass('05-A structure: P4 collision gate function present');
  } else {
    fail('05-A structure: P4 collision gate function missing');
  }

  const migration05B = fs.readFileSync(REQUIRED_MIGRATIONS[3], 'utf-8');
  if (migration05B.includes('prevent_canonical_id_change')) {
    pass('05-B structure: Immutability trigger function present');
  } else {
    fail('05-B structure: Immutability trigger function missing');
  }

  if (migration05B.includes('DELETE FROM runtime_tenant_registry')) {
    pass('05-B structure: Orphan deletion logic present');
  } else {
    fail('05-B structure: Orphan deletion logic missing');
  }

  const migrationE2 = fs.readFileSync(REQUIRED_MIGRATIONS[2], 'utf-8');
  if (migrationE2.includes('migration_05_e2_orphan_safety_gate')) {
    pass('E2 gate structure: Orphan safety verification function present');
  } else {
    fail('E2 gate structure: Orphan safety verification function missing');
  }
}

// ============================================================================
// GROUP B: DEPENDENCY INTEGRITY
// ============================================================================

async function verifyDependencyIntegrity(client) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ E0 GATE — GROUP B: DEPENDENCY INTEGRITY                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Requirement: Database schema matches migration assumptions.\n');

  // B1: Verify runtime_tenant_registry exists
  const registryExistsResult = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'runtime_tenant_registry'
    ) AS exists
  `);
  if (registryExistsResult.rows[0].exists) {
    pass('Dependency: runtime_tenant_registry table exists');
  } else {
    fail('Dependency: runtime_tenant_registry table missing', 'Migration 05 requires this table');
  }

  // B2: Verify tenant_id column type = TEXT
  const tenantIdTypeResult = await client.query(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'runtime_tenant_registry'
      AND column_name = 'tenant_id'
  `);
  if (tenantIdTypeResult.rows.length > 0) {
    const dataType = tenantIdTypeResult.rows[0].data_type;
    if (dataType === 'text' || dataType === 'character varying') {
      pass(`Dependency: tenant_id type = ${dataType} (TEXT-based, correct precondition)`);
    } else {
      fail(`Dependency: tenant_id type = ${dataType}`, 'Expected TEXT type, found UUID. Migration 05-C already executed?');
    }
  } else {
    fail('Dependency: tenant_id column missing in runtime_tenant_registry');
  }

  // B3: Verify public.tenants table exists
  const tenantsExistsResult = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'tenants'
    ) AS exists
  `);
  if (tenantsExistsResult.rows[0].exists) {
    pass('Dependency: public.tenants table exists');
  } else {
    fail('Dependency: public.tenants table missing', 'Migration 05-B requires this table for canonical identity');
  }

  // B4: Verify public.tenants.id type = UUID
  const tenantsIdTypeResult = await client.query(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'id'
  `);
  if (tenantsIdTypeResult.rows.length > 0) {
    const dataType = tenantsIdTypeResult.rows[0].data_type;
    if (dataType === 'uuid') {
      pass('Dependency: public.tenants.id type = uuid (canonical identity authority)');
    } else {
      fail(`Dependency: public.tenants.id type = ${dataType}`, 'Expected uuid type');
    }
  } else {
    fail('Dependency: public.tenants.id column missing');
  }

  // B5: Verify migration_evidence schema does NOT exist yet
  const migrationEvidenceExistsResult = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = 'migration_evidence'
    ) AS exists
  `);
  if (!migrationEvidenceExistsResult.rows[0].exists) {
    pass('Precondition: migration_evidence schema does NOT exist (clean state)');
  } else {
    fail('Precondition: migration_evidence schema already exists', 'Migration 05-A already executed? Expected clean state.');
  }

  // B6: Verify canonical_tenant_map does NOT exist
  const mappingTableExistsResult = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'migration_evidence'
        AND table_name = 'canonical_tenant_map'
    ) AS exists
  `);
  if (!mappingTableExistsResult.rows[0].exists) {
    pass('Precondition: canonical_tenant_map does NOT exist (clean state)');
  } else {
    fail('Precondition: canonical_tenant_map already exists', 'Migration 05-A already executed?');
  }
}

// ============================================================================
// GROUP C: EXECUTION PRECONDITIONS
// ============================================================================

async function verifyExecutionPreconditions(client) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ E0 GATE — GROUP C: EXECUTION PRECONDITIONS                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Requirement: Database state matches migration assumptions.\n');

  // C1: Verify runtime_tenant_registry fixture count
  const fixtureCountResult = await client.query(`
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
  const fixtureCount = parseInt(fixtureCountResult.rows[0].count);
  if (fixtureCount === 5) {
    pass(`Precondition: 5 TEXT fixtures present in runtime_tenant_registry`);
  } else if (fixtureCount > 0) {
    warn(`Precondition: ${fixtureCount}/5 fixtures present`, 'Expected 5 fixtures. Partial fixture set detected.');
  } else {
    fail('Precondition: 0/5 fixtures present', 'Migration 05 requires test fixtures. Run fixture setup first.');
  }

  // C2: Verify no FK constraint on runtime_tenant_registry.tenant_id
  const fkConstraintResult = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'runtime_tenant_registry'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'tenant_id'
  `);
  const fkCount = parseInt(fkConstraintResult.rows[0].count);
  if (fkCount === 0) {
    pass('Precondition: No FK constraint on runtime_tenant_registry.tenant_id (TEXT state)');
  } else {
    fail(`Precondition: ${fkCount} FK constraint(s) found on tenant_id`, 'Migration 05-C already executed? Expected no FK.');
  }

  // C3: Verify PostgreSQL version >= 12 (partial UNIQUE index support)
  const versionResult = await client.query('SHOW server_version');
  const version = versionResult.rows[0].server_version;
  const majorVersion = parseInt(version.split('.')[0]);
  if (majorVersion >= 12) {
    pass(`Precondition: PostgreSQL ${version} (>= 12, partial UNIQUE index supported)`);
  } else {
    fail(`Precondition: PostgreSQL ${version} (< 12)`, 'Migration requires PostgreSQL >= 12 for partial UNIQUE indexes');
  }

  // C4: Verify database connection has sufficient privileges
  const privilegesResult = await client.query(`
    SELECT 
      has_schema_privilege(CURRENT_USER, 'public', 'CREATE') as can_create_in_public,
      has_database_privilege(CURRENT_DATABASE(), 'CREATE') as can_create_schema
  `);
  const privileges = privilegesResult.rows[0];
  if (privileges.can_create_in_public && privileges.can_create_schema) {
    pass('Precondition: Database user has CREATE privileges');
  } else {
    fail('Precondition: Insufficient privileges', `can_create_in_public=${privileges.can_create_in_public}, can_create_schema=${privileges.can_create_schema}`);
  }
}

// ============================================================================
// GROUP D: GATE INTEGRITY
// ============================================================================

async function verifyGateIntegrity(client) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ E0 GATE — GROUP D: GATE INTEGRITY                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Requirement: E1/E2/E3 gates are independent and cannot be bypassed.\n');

  // D1: Verify E1 gate is a SQL function (not bypassable)
  const e1GateContent = fs.readFileSync(REQUIRED_MIGRATIONS[0], 'utf-8');
  if (e1GateContent.includes('CREATE OR REPLACE FUNCTION migration_05_e1_gate()')) {
    pass('Gate integrity: E1 gate defined as SQL function');
  } else {
    fail('Gate integrity: E1 gate function definition missing');
  }

  if (e1GateContent.includes('RETURNS TABLE')) {
    pass('Gate integrity: E1 gate returns structured verification results');
  } else {
    fail('Gate integrity: E1 gate does not return TABLE (bypass risk)');
  }

  // D2: Verify E2 gate is a SQL function
  const e2GateContent = fs.readFileSync(REQUIRED_MIGRATIONS[2], 'utf-8');
  if (e2GateContent.includes('CREATE OR REPLACE FUNCTION migration_05_e2_orphan_safety_gate()')) {
    pass('Gate integrity: E2 gate defined as SQL function');
  } else {
    fail('Gate integrity: E2 gate function definition missing');
  }

  // D3: Verify E3 gate is a SQL function
  const e3GateContent = fs.readFileSync(REQUIRED_MIGRATIONS[5], 'utf-8');
  if (e3GateContent.includes('CREATE OR REPLACE FUNCTION migration_05_e3_gate()')) {
    pass('Gate integrity: E3 gate defined as SQL function');
  } else {
    fail('Gate integrity: E3 gate function definition missing');
  }

  // D4: Verify 05-B calls E2 gate before deletion
  const migration05B = fs.readFileSync(REQUIRED_MIGRATIONS[3], 'utf-8');
  const e2CallBeforeDelete = migration05B.indexOf('migration_05_e2_orphan_safety_gate()') < migration05B.indexOf('DELETE FROM runtime_tenant_registry');
  if (e2CallBeforeDelete) {
    pass('Gate integrity: 05-B calls E2 gate BEFORE deletion (cannot bypass)');
  } else {
    fail('Gate integrity: 05-B deletion ordering incorrect', 'E2 gate must be called before DELETE');
  }

  // D5: Verify 05-B uses E2 result to block deletion on FAIL
  if (migration05B.includes("IF v_e2_result.status = 'FAIL' THEN") && 
      migration05B.includes('RAISE EXCEPTION')) {
    pass('Gate integrity: 05-B blocks deletion if E2 gate fails');
  } else {
    fail('Gate integrity: 05-B does not enforce E2 gate result', 'E2 FAIL must prevent deletion');
  }

  // D6: Verify gates use EXCEPTION for hard stops (not just warnings)
  if (e2GateContent.includes('RAISE EXCEPTION') || e2GateContent.includes("status := 'FAIL'")) {
    pass('Gate integrity: E2 gate uses EXCEPTION/FAIL for hard stops');
  } else {
    warn('Gate integrity: E2 gate may use soft failures', 'Verify EXCEPTION is raised on critical failures');
  }

  // D7: Verify advisory lock prevents concurrent execution
  if (migration05B.includes('pg_try_advisory_xact_lock')) {
    pass('Gate integrity: Advisory lock prevents concurrent 05-B execution');
  } else {
    fail('Gate integrity: No advisory lock in 05-B', 'Concurrent execution risk');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ E0 GATE: ARTIFACT + ENVIRONMENT + PRECONDITION INTEGRITY VERIFICATION       ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Amendment: Amendment 12 v3                                                   ║');
  console.log('║ Migration: 05-A/B/C Identity Reconciliation                                  ║');
  console.log('║ Purpose:   Verify package/database state before E1 execution                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  try {
    // GROUP A: Artifact integrity (no database connection needed)
    await verifyArtifactIntegrity();

    // Connect to database for Groups B, C, D
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    await client.connect();
    console.log('\n✅ Database connection established\n');

    // GROUP B: Dependency integrity
    await verifyDependencyIntegrity(client);

    // GROUP C: Execution preconditions
    await verifyExecutionPreconditions(client);

    // GROUP D: Gate integrity
    await verifyGateIntegrity(client);

    await client.end();

    // ========================================================================
    // FINAL REPORT
    // ========================================================================
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ E0 GATE VERIFICATION RESULTS                                                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Checks:  ${checksPassed + checksFailed + checksWarning}`.padEnd(79) + '║');
    console.log(`║ ✅ PASS:       ${checksPassed}`.padEnd(79) + '║');
    console.log(`║ ❌ FAIL:        ${checksFailed}`.padEnd(79) + '║');
    console.log(`║ ⚠️  WARNING:    ${checksWarning}`.padEnd(79) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (checksFailed > 0) {
      console.log('║ STATUS: ❌ FAIL                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n❌ E0 GATE: FAIL\n');
      console.log('RESOLUTION REQUIRED:');
      console.log('- Review failed checks above');
      console.log('- Fix precondition violations or package issues');
      console.log('- Re-run E0 verification after fixes\n');
      console.log('🔴 DO NOT proceed to E1 until E0 passes');
      console.log('🔴 DO NOT execute migrations\n');
      process.exit(1);
    } else if (checksWarning > 0) {
      console.log('║ STATUS: ⚠️  PASS WITH WARNINGS                                                ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n⚠️  E0 GATE: PASS WITH WARNINGS\n');
      console.log('Review warnings above before proceeding to E1.\n');
      console.log('NEXT STEP: E1 gate execution');
      console.log('  node scripts/run-e1-verification.mjs\n');
      console.log('⚠️  E1 execution authorized, but review warnings first\n');
      process.exit(0);
    } else {
      console.log('║ STATUS: ✅ PASS                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n✅ E0 GATE: PASS\n');
      console.log('All artifact, dependency, precondition, and gate integrity checks passed.\n');
      console.log('NEXT STEP: E1 gate execution');
      console.log('  node scripts/run-e1-verification.mjs\n');
      console.log('🟢 E1 execution authorized\n');
      console.log('⚠️  REMINDER: E1 PASS + Human GO required before migration execution\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ E0 GATE: EXCEPTION\n');
    console.error('Error during verification:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n🔴 STOP. Database connection or verification logic failed.\n');
    process.exit(1);
  }
}

main();
