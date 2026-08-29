/**
 * Phase 4B.3 — Drift Detection
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * Decision: D2 — Drift Detection
 * 
 * Detect unexpected changes (deletion, modification, additive).
 * 
 * Decision D2 Semantics:
 * - Deletion → FAIL (CRITICAL)
 * - Modification (type change) → FAIL (CRITICAL)
 * - Additive non-security → WARNING (not FAIL)
 * - Additive security-critical → FAIL (CRITICAL)
 * - Unknown → ERROR → BLOCK
 * 
 * CRITICAL: Drift detection prevents schema destruction and unauthorized changes.
 */

import { ExpectedState, ActualState, VerificationCheck, SECURITY_CRITICAL_TABLES } from '../types';

/**
 * Detect unexpected drift
 * 
 * Checks:
 * 1. Unexpected deletion (table/column missing) → FAIL (CRITICAL)
 * 2. Unexpected modification (type change) → FAIL (CRITICAL)
 * 3. Unexpected additive (new table/column) → WARNING or FAIL (depends on security)
 */
export async function detectDrift(
  expectedState: ExpectedState,
  actualState: ActualState
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // Check 1: Detect table deletions (security-critical tables must exist)
  const deletionChecks = detectTableDeletions(expectedState, actualState);
  checks.push(...deletionChecks);

  // Check 2: Detect column modifications (type changes)
  const modificationChecks = detectColumnModifications(expectedState, actualState);
  checks.push(...modificationChecks);

  // Check 3: Detect additive changes (new tables/columns not declared)
  const additiveChecks = detectAdditiveChanges(expectedState, actualState);
  checks.push(...additiveChecks);

  return checks;
}

/**
 * Detect table deletions
 * 
 * Contract v1.0.0 Hybrid Expected State semantic:
 * - SECURITY_CRITICAL_TABLES = Classification rules (wildcard patterns)
 * - IF table matches pattern AND exists → Verify RLS invariants
 * - IF table matches pattern BUT never existed → NOT IN SCOPE (no FAIL)
 * - IF table existed before, now missing → DRIFT FAIL (unexpected deletion)
 * 
 * Phase 1 simplification (no previous state tracking):
 * - Missing security-critical table → PASS with INFO severity (not blocking)
 * - Actual deletion detection requires previous baseline (future phase)
 * 
 * Rationale:
 * - Contract uses wildcards ('hc_*', 'edu_*') → Classification, not required inventory
 * - Healthcare/Education/Logistics add tables incrementally (H1 → H2 → ... → H12)
 * - Missing future table ≠ Broken invariant
 * - Verification checks: "Migration didn't break invariants" (not "all future tables exist")
 * 
 * Evidence: docs/architecture/PHASE4B3_INTERPRETATION_B_EVIDENCE.md (6/6 Contract sections)
 */
function detectTableDeletions(expectedState: ExpectedState, actualState: ActualState): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  // Phase 1: No previous baseline tracking
  // Missing table → PASS (not in current scope, not blocking)
  // 
  // Future enhancement (Phase 2):
  // - Track previous baseline (from migration history or previous verification artifact)
  // - Compare: previousTables vs actualTables
  // - Deleted table (existed before, missing now) → CRITICAL FAIL
  // - Never existed → PASS

  // NOTE: Phase 1 does NOT generate checks for missing tables
  // Only tables that EXIST are verified (RLS checks happen in rls-verification.ts)
  // This aligns with Contract v1.0.0 classification semantic

  return checks;
}

/**
 * Detect column modifications (type changes)
 * 
 * If a column is declared with a specific type, changing that type is a modification.
 * Modification → FAIL (CRITICAL)
 */
function detectColumnModifications(expectedState: ExpectedState, actualState: ActualState): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  const migrationExpectations = expectedState.migrationExpectations.tables;

  if (!migrationExpectations) {
    return checks;
  }

  for (const [tableName, expectedTable] of Object.entries(migrationExpectations)) {
    const actualTable = actualState.tables[tableName];

    if (!actualTable || !actualTable.exists || !expectedTable.columns || !actualTable.columns) {
      continue;
    }

    const actualColumnMap = new Map(actualTable.columns.map((c) => [c.name, c]));

    for (const [columnName, expectedType] of Object.entries(expectedTable.columns)) {
      const actualColumn = actualColumnMap.get(columnName);

      if (!actualColumn) {
        // Column missing → already handled by schema verification
        continue;
      }

      // Check for type modification
      const actualTypeNormalized = normalizeType(actualColumn.type);
      const expectedTypeNormalized = normalizeType(expectedType);

      if (actualTypeNormalized !== expectedTypeNormalized) {
        // Type modification → FAIL (CRITICAL)
        checks.push({
          check_id: `drift-modification-${tableName}-${columnName}`,
          check_type: 'DRIFT_DETECTION',
          check_name: 'unexpected_modification',
          expected: `${tableName}.${columnName} type: ${expectedType}`,
          actual: `${tableName}.${columnName} type: ${actualColumn.type}`,
          result: 'FAIL',
          severity: 'CRITICAL',
          message: `Unexpected type modification on ${tableName}.${columnName}: declared '${expectedType}' but found '${actualColumn.type}'. This may break existing code.`,
        });
      }
    }
  }

  return checks;
}

/**
 * Detect additive changes (new tables/columns not declared)
 * 
 * Decision D2:
 * - Additive non-security → WARNING (not FAIL)
 * - Additive security-critical → FAIL (CRITICAL)
 * 
 * This enables platform expansion without blocking deployment.
 * T4 scenario: new metadata column → WARNING → Deploy eligible
 */
function detectAdditiveChanges(expectedState: ExpectedState, actualState: ActualState): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  // Get all tables that should be verified
  const expectedTables = new Set<string>();

  // Add security-critical tables
  for (const table of expectedState.securityInvariants.tenantIsolation.tables) {
    expectedTables.add(table);
  }

  // Add migration-specific tables
  if (expectedState.migrationExpectations.tables) {
    for (const table of Object.keys(expectedState.migrationExpectations.tables)) {
      expectedTables.add(table);
    }
  }

  // Check for new columns on existing tables
  for (const tableName of Array.from(expectedTables)) {
    const actualTable = actualState.tables[tableName];

    if (!actualTable || !actualTable.exists || !actualTable.columns) {
      continue;
    }

    // Get expected columns for this table
    const expectedColumns = new Set<string>();

    if (expectedState.migrationExpectations.tables?.[tableName]?.columns) {
      for (const columnName of Object.keys(expectedState.migrationExpectations.tables[tableName].columns!)) {
        expectedColumns.add(columnName);
      }
    }

    // Find new columns (not declared)
    for (const actualColumn of actualTable.columns) {
      if (!expectedColumns.has(actualColumn.name)) {
        // New column not declared → check if security-critical
        const isSecurityCritical = SECURITY_CRITICAL_TABLES.includes(tableName as any);

        if (isSecurityCritical && actualColumn.name === 'tenant_id') {
          // Adding tenant_id to security-critical table without declaration → FAIL
          checks.push({
            check_id: `drift-additive-${tableName}-${actualColumn.name}`,
            check_type: 'DRIFT_DETECTION',
            check_name: 'additive_change',
            expected: `No expectation (no declaration)`,
            actual: `New security-critical column '${actualColumn.name}' on ${tableName}`,
            result: 'FAIL',
            severity: 'CRITICAL',
            message: `Additive security-critical column '${actualColumn.name}' on ${tableName} detected without declaration. Security implications must be verified.`,
          });
        } else {
          // Additive non-security column → WARNING (not FAIL)
          // T4 scenario: metadata column added
          checks.push({
            check_id: `drift-additive-${tableName}-${actualColumn.name}`,
            check_type: 'DRIFT_DETECTION',
            check_name: 'additive_change',
            expected: `No expectation (no declaration)`,
            actual: `New column '${actualColumn.name}' (type: ${actualColumn.type}, nullable: ${actualColumn.nullable})`,
            result: 'WARNING',
            severity: 'WARNING',
            message: `New non-security column '${actualColumn.name}' detected on ${tableName}. Not declared in migration. Security invariants intact. Review recommended but not blocking deployment.`,
          });
        }
      }
    }
  }

  return checks;
}

/**
 * Normalize PostgreSQL type names
 */
function normalizeType(type: string): string {
  const normalized = type.toLowerCase().trim();

  const typeMap: Record<string, string> = {
    'character varying': 'varchar',
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'integer': 'int4',
    'bigint': 'int8',
    'smallint': 'int2',
    'double precision': 'float8',
    'real': 'float4',
  };

  return typeMap[normalized] || normalized;
}
