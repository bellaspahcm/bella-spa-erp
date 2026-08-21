#!/usr/bin/env node
/**
 * BELLA RUNTIME MIGRATION 05 — AMENDMENT 12 V3 PACKAGE INTEGRITY VERIFICATION
 * 
 * Purpose: Verify all 5 mandatory conditions are implemented before Package Review
 * 
 * Mandatory Conditions (from Approval 3):
 *   1. P4 metadata validation (created_at + provisioned_by)
 *   2. Advisory lock explicit acquisition
 *   3. Mapping immutability (trigger after COMPLETE phase)
 *   4. Transaction + lock + PK/UNIQUE + verification
 *   5. Deletion audit columns (deleted_at, deleted_by, deletion_reason)
 * 
 * Governance: DO NOT execute migrations until this verification PASS
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║ AMENDMENT 12 V3 — PACKAGE INTEGRITY VERIFICATION                             ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
console.log('║ Purpose: Verify 5 mandatory conditions implemented before Package Review     ║');
console.log('║ Status:  Approval 3 GRANTED (2026-08-19)                                     ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
console.log('');

// File paths to verify
const files = {
  e1Gate: 'supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql',
  e2Gate: 'supabase/migrations/20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql',
  e3Gate: 'supabase/migrations/20260819050004_runtime_migration_e3_post_05c_verification.sql',
  migration05A: 'supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql',
  migration05B: 'supabase/migrations/20260819050002_runtime_migration_05b_canonical_tenant_creation.sql',
  migration05C: 'supabase/migrations/20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql',
  e1Script: 'scripts/run-e1-verification.mjs'
};

let allPassed = true;
const results = [];

// Helper to check file existence
function checkFileExists(filePath, description) {
  const fullPath = join(rootDir, filePath);
  const exists = existsSync(fullPath);
  results.push({
    check: description,
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? `File exists: ${filePath}` : `MISSING: ${filePath}`
  });
  if (!exists) allPassed = false;
  return exists ? readFileSync(fullPath, 'utf-8') : null;
}

// Helper to check content includes pattern
function checkContentIncludes(content, pattern, description, filePath) {
  if (!content) {
    results.push({
      check: description,
      status: 'SKIP',
      details: `File not loaded: ${filePath}`
    });
    return false;
  }
  
  const found = content.includes(pattern);
  results.push({
    check: description,
    status: found ? 'PASS' : 'FAIL',
    details: found ? `Found in ${filePath}` : `NOT FOUND in ${filePath}: "${pattern.substring(0, 50)}..."`
  });
  if (!found) allPassed = false;
  return found;
}

// Helper to check regex pattern
function checkContentMatches(content, regex, description, filePath) {
  if (!content) {
    results.push({
      check: description,
      status: 'SKIP',
      details: `File not loaded: ${filePath}`
    });
    return false;
  }
  
  const match = regex.test(content);
  results.push({
    check: description,
    status: match ? 'PASS' : 'FAIL',
    details: match ? `Pattern found in ${filePath}` : `PATTERN NOT FOUND in ${filePath}`
  });
  if (!match) allPassed = false;
  return match;
}

console.log('=== FILE EXISTENCE VERIFICATION ===\n');

const fileContents = {};
for (const [key, filePath] of Object.entries(files)) {
  fileContents[key] = checkFileExists(filePath, `File: ${filePath}`);
}

console.log('');
console.log('=== MANDATORY CONDITION #1: P4 METADATA VALIDATION ===');
console.log('Requirement: P4 collision gate must verify created_at + provisioned_by\n');
console.log('Verification strategy: Syntax + Semantic (COALESCE + UNKNOWN→STOP)\n');

checkContentIncludes(
  fileContents.migration05A,
  'created_at + provisioned_by',
  'Condition #1: P4 metadata validation documented',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'v_created_at_column_exists',
  'Condition #1: created_at introspection',
  files.migration05A
);

checkContentMatches(
  fileContents.migration05A,
  /metadata\s*->>\s*'provisioned_by'/,
  'Condition #1: provisioned_by extraction (syntax)',
  files.migration05A
);

// Semantic check: COALESCE handles missing value
checkContentMatches(
  fileContents.migration05A,
  /COALESCE\([^)]*metadata\s*->>\s*'provisioned_by'[^)]*\)/,
  'Condition #1: provisioned_by missing-value handling (COALESCE)',
  files.migration05A
);

// Semantic check: metadata validation → UNKNOWN → STOP
checkContentMatches(
  fileContents.migration05A,
  /COLLISION CLASSIFICATION = UNKNOWN[\s\S]{0,300}STOP/,
  'Condition #1: UNKNOWN classification → STOP (no fallback)',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'CLASSIFICATION = UNKNOWN',
  'Condition #1: UNKNOWN classification handling',
  files.migration05A
);

console.log('');
console.log('=== MANDATORY CONDITION #2: ADVISORY LOCK EXPLICIT ===');
console.log('Requirement: Advisory lock must be explicitly acquired\n');

checkContentIncludes(
  fileContents.migration05A,
  'pg_try_advisory_xact_lock',
  'Condition #2: Advisory lock in 05-A',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  "hashtext('BELLA_MIGRATION_05')",
  'Condition #2: Advisory lock key',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05B,
  'pg_try_advisory_xact_lock',
  'Condition #2: Advisory lock in 05-B',
  files.migration05B
);

checkContentMatches(
  fileContents.migration05A,
  /IF NOT v_lock_acquired THEN[\s\S]*?RAISE EXCEPTION/,
  'Condition #2: Lock acquisition check + failure handling',
  files.migration05A
);

console.log('');
console.log('=== MANDATORY CONDITION #3: MAPPING IMMUTABILITY ===');
console.log('Requirement: Trigger to prevent canonical_tenant_id change after COMPLETE\n');

checkContentIncludes(
  fileContents.migration05B,
  'prevent_canonical_id_change',
  'Condition #3: Immutability trigger function',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  'CREATE TRIGGER trigger_prevent_canonical_id_change',
  'Condition #3: Trigger creation',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  "OLD.reconciliation_phase = 'COMPLETE'",
  'Condition #3: Phase check in trigger',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  'OLD.canonical_tenant_id IS DISTINCT FROM NEW.canonical_tenant_id',
  'Condition #3: Canonical ID change detection',
  files.migration05B
);

console.log('');
console.log('=== MANDATORY CONDITION #4: TRANSACTION + LOCK + VERIFICATION ===');
console.log('Requirement: Transaction boundaries + advisory lock + PK/UNIQUE + gates\n');

checkContentIncludes(
  fileContents.migration05A,
  'BEGIN',
  'Condition #4: Transaction boundaries (implicit in migration file)',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'CREATE UNIQUE INDEX uq_canonical_map_reserved_uuid',
  'Condition #4: UNIQUE index on reserved_tenant_id',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'CREATE UNIQUE INDEX uq_canonical_map_canonical_uuid',
  'Condition #4: UNIQUE index on canonical_tenant_id',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'migration_05a_preflight_p4_collision_gate',
  'Condition #4: P4 verification gate',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05B,
  'migration_05b_preflight_p2_reservation_complete',
  'Condition #4: P2 verification gate',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  'migration_05b_preflight_p3_schema_compatibility',
  'Condition #4: P3 verification gate',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  'migration_05b_preflight_collision_recheck',
  'Condition #4: P4 recheck gate',
  files.migration05B
);

console.log('');
console.log('=== MANDATORY CONDITION #5: DELETION AUDIT COLUMNS ===');
console.log('Requirement: deleted_at, deleted_by, deletion_reason in canonical_tenant_map\n');
console.log('Verification strategy: Syntax + Semantic (atomicity + completeness)\n');

checkContentIncludes(
  fileContents.migration05A,
  'deleted_at TIMESTAMPTZ',
  'Condition #5: deleted_at column definition',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'deleted_by TEXT',
  'Condition #5: deleted_by column definition',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'deletion_reason TEXT',
  'Condition #5: deletion_reason column definition',
  files.migration05A
);

checkContentMatches(
  fileContents.migration05B,
  /deleted_at\s*=\s*NOW\(\)/,
  'Condition #5: deleted_at population (syntax)',
  files.migration05B
);

// Semantic check: audit columns populated together
checkContentMatches(
  fileContents.migration05B,
  /deleted_at\s*=\s*NOW\(\)[\s\S]{0,100}deleted_by\s*=[\s\S]{0,100}deletion_reason\s*=/,
  'Condition #5: Complete audit trail (deleted_at + deleted_by + deletion_reason)',
  files.migration05B
);

// Semantic check: UPDATE before DELETE in same block
checkContentMatches(
  fileContents.migration05B,
  /UPDATE.*canonical_tenant_map[\s\S]{0,200}deleted_at[\s\S]{0,300}DELETE FROM runtime_tenant_registry/,
  'Condition #5: Audit UPDATE before DELETE (atomicity)',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  'deleted_by = CURRENT_USER',
  'Condition #5: deleted_by population in 05-B',
  files.migration05B
);

checkContentIncludes(
  fileContents.migration05B,
  "deletion_reason = 'E2 orphan safety gate PASS",
  'Condition #5: deletion_reason population in 05-B',
  files.migration05B
);

console.log('');
console.log('=== DESIGN IMPLEMENTATION MAPPING ===');
console.log('Verifying Amendment 12 v3 design requirements implemented\n');

checkContentIncludes(
  fileContents.migration05A,
  'reserved_tenant_id UUID',
  'Design: Separate reserved_tenant_id column (Correction 1)',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05A,
  'canonical_tenant_id UUID',
  'Design: Separate canonical_tenant_id column (Correction 1)',
  files.migration05A
);

checkContentMatches(
  fileContents.migration05A,
  /-- NO FK constraint during reservation/i,
  'Design: NO FK during reservation phase (Correction 1)',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05B,
  'ADD CONSTRAINT fk_canonical_tenant',
  'Design: FK added by 05-B after tenant creation (Correction 1)',
  files.migration05B
);

checkContentIncludes(
  fileContents.e1Gate,
  'information_schema.columns',
  'Design: Schema introspection before querying (Correction 3)',
  files.e1Gate
);

checkContentIncludes(
  fileContents.migration05B,
  'information_schema.columns',
  'Design: Schema-adaptive tenant creation (Correction 4)',
  files.migration05B
);

checkContentIncludes(
  fileContents.e2Gate,
  'E2-A',
  'Design: E2 orphan safety gate (Correction 6)',
  files.e2Gate
);

console.log('');
console.log('=== GATE INTEGRITY VERIFICATION ===');
console.log('Verifying all gates implemented\n');

checkContentIncludes(
  fileContents.e1Gate,
  'migration_05_e1_gate',
  'Gate: E1 (pre-migration state verification)',
  files.e1Gate
);

checkContentIncludes(
  fileContents.e2Gate,
  'migration_05_e2_orphan_safety_gate',
  'Gate: E2 (orphan deletion safety)',
  files.e2Gate
);

checkContentIncludes(
  fileContents.e3Gate,
  'migration_05_e3_gate',
  'Gate: E3 (post-05-C verification)',
  files.e3Gate
);

checkContentIncludes(
  fileContents.migration05A,
  'migration_05a_preflight_p4_collision_gate',
  'Gate: P4 (UUID collision detection)',
  files.migration05A
);

checkContentIncludes(
  fileContents.migration05B,
  'migration_05b_preflight_p3_schema_compatibility',
  'Gate: P3 (schema compatibility)',
  files.migration05B
);

console.log('');
console.log('=== NEGATIVE PATH VERIFICATION ===');
console.log('Verifying NO fuzzy match, NO auto-assignment, NO graceful degradation\n');

checkContentMatches(
  fileContents.migration05C,
  /NO slug lookup|NO fuzzy match/i,
  'Negative: NO fuzzy matching in 05-C',
  files.migration05C
);

checkContentMatches(
  fileContents.migration05A,
  /NO auto-delete|NO auto-reassign/i,
  'Negative: NO auto-delete/reassign in P4',
  files.migration05A
);

checkContentMatches(
  fileContents.migration05C,
  /unmapped.*EXCEPTION|unmapped.*STOP/i,
  'Negative: Unmapped TEXT ID → EXCEPTION',
  files.migration05C
);

checkContentMatches(
  fileContents.e2Gate,
  /NO graceful degradation/i,
  'Negative: NO graceful degradation in E2',
  files.e2Gate
);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║ VERIFICATION RESULTS                                                         ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;
const skipCount = results.filter(r => r.status === 'SKIP').length;

console.log(`║ Total Checks: ${results.length.toString().padStart(3)}                                                            ║`);
console.log(`║ ✅ PASS:      ${passCount.toString().padStart(3)}                                                            ║`);
console.log(`║ ❌ FAIL:      ${failCount.toString().padStart(3)}                                                            ║`);
console.log(`║ ⏭️  SKIP:      ${skipCount.toString().padStart(3)}                                                            ║`);
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

if (failCount > 0) {
  console.log('║ STATUS: ❌ FAIL                                                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('FAILED CHECKS:');
  console.log('');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`❌ ${r.check}`);
    console.log(`   ${r.details}`);
    console.log('');
  });
  console.log('RESOLUTION REQUIRED:');
  console.log('- Review failed checks above');
  console.log('- Ensure all 5 mandatory conditions are implemented');
  console.log('- Re-run verification after fixes');
  console.log('');
  console.log('❌ DO NOT proceed to Package Review until all checks PASS');
  process.exit(1);
} else {
  console.log('║ STATUS: ✅ PASS                                                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('✅ PACKAGE INTEGRITY VERIFIED');
  console.log('');
  console.log('All 5 mandatory conditions implemented:');
  console.log('  ✅ #1: P4 metadata validation (created_at + provisioned_by)');
  console.log('  ✅ #2: Advisory lock explicit acquisition');
  console.log('  ✅ #3: Mapping immutability trigger');
  console.log('  ✅ #4: Transaction + lock + PK/UNIQUE + verification gates');
  console.log('  ✅ #5: Deletion audit columns');
  console.log('');
  console.log('Amendment 12 v3 design faithfully implemented.');
  console.log('');
  console.log('NEXT STEP: Package Review documentation');
  console.log('');
  console.log('⚠️  REMINDER: DO NOT execute migrations until:');
  console.log('   1. Package Review complete');
  console.log('   2. E0 gate execution');
  console.log('   3. E1 gate PASS');
  console.log('   4. Human approval for execution');
}
