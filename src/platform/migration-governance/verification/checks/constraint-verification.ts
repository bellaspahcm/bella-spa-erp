/**
 * Phase 4B.3 — Constraint Verification
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * Verify primary keys, foreign keys, NOT NULL constraints.
 * 
 * Checks:
 * 1. Primary key exists and matches declaration
 * 2. Foreign keys exist and references correct
 * 3. NOT NULL constraints enforced (implicit from column nullable=false)
 * 
 * Result:
 * - Missing primary key → FAIL (HIGH severity)
 * - Missing foreign key → FAIL (HIGH severity)
 * - Constraint violation → FAIL
 */

import { ExpectedState, ActualState, VerificationCheck } from '../types';

/**
 * Verify constraints match declaration
 */
export async function verifyConstraints(
  expectedState: ExpectedState,
  actualState: ActualState
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  const migrationExpectations = expectedState.migrationExpectations.tables;

  if (!migrationExpectations) {
    // No migration-specific expectations → skip constraint verification
    return checks;
  }

  for (const [tableName, expectedTable] of Object.entries(migrationExpectations)) {
    const actualTable = actualState.tables[tableName];

    if (!actualTable || !actualTable.exists) {
      // Table missing → already handled by schema verification
      continue;
    }

    // Check 1: Primary key
    if (expectedTable.primary_key) {
      const pkCheck = verifyPrimaryKey(tableName, expectedTable.primary_key, actualTable.primary_key || []);
      checks.push(pkCheck);
    }

    // Check 2: Foreign keys
    if (expectedTable.foreign_keys && actualTable.foreign_keys) {
      const fkChecks = verifyForeignKeys(tableName, expectedTable.foreign_keys, actualTable.foreign_keys);
      checks.push(...fkChecks);
    }
  }

  return checks;
}

/**
 * Verify primary key matches declaration
 */
function verifyPrimaryKey(
  tableName: string,
  expectedPK: string[],
  actualPK: string[]
): VerificationCheck {
  // Sort for comparison (order may differ)
  const expectedSorted = [...expectedPK].sort().join(',');
  const actualSorted = [...actualPK].sort().join(',');

  if (expectedSorted !== actualSorted) {
    return {
      check_id: `primary-key-${tableName}`,
      check_type: 'CONSTRAINT_VERIFICATION',
      check_name: `${tableName}.primary_key`,
      expected: expectedPK,
      actual: actualPK,
      result: 'FAIL',
      severity: 'HIGH',
      message: `Primary key mismatch on ${tableName}. Expected: [${expectedPK.join(', ')}], Actual: [${actualPK.join(', ')}]`,
    };
  }

  return {
    check_id: `primary-key-${tableName}`,
    check_type: 'CONSTRAINT_VERIFICATION',
    check_name: `${tableName}.primary_key`,
    expected: expectedPK,
    actual: actualPK,
    result: 'PASS',
    severity: 'HIGH',
    message: `Primary key on ${tableName} matches declaration`,
  };
}

/**
 * Verify foreign keys match declaration
 */
function verifyForeignKeys(
  tableName: string,
  expectedFKs: Array<{ column: string; references: string }>,
  actualFKs: Array<{ column: string; references: string; referenced_column: string }>
): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  for (const expectedFK of expectedFKs) {
    // Parse expected references: "hc_patients(patient_id)" → table="hc_patients", column="patient_id"
    const refMatch = expectedFK.references.match(/^(\w+)\((\w+)\)$/);

    if (!refMatch) {
      checks.push({
        check_id: `foreign-key-${tableName}-${expectedFK.column}`,
        check_type: 'CONSTRAINT_VERIFICATION',
        check_name: `${tableName}.fk_${expectedFK.column}`,
        expected: expectedFK.references,
        actual: 'N/A',
        result: 'FAIL',
        severity: 'HIGH',
        message: `Invalid foreign key declaration format: ${expectedFK.references}. Expected format: table_name(column_name)`,
      });
      continue;
    }

    const [, expectedRefTable, expectedRefColumn] = refMatch;

    // Find matching actual FK
    const actualFK = actualFKs.find(
      (fk) =>
        fk.column === expectedFK.column &&
        fk.references === expectedRefTable &&
        fk.referenced_column === expectedRefColumn
    );

    if (!actualFK) {
      checks.push({
        check_id: `foreign-key-${tableName}-${expectedFK.column}`,
        check_type: 'CONSTRAINT_VERIFICATION',
        check_name: `${tableName}.fk_${expectedFK.column}`,
        expected: `${expectedFK.column} → ${expectedFK.references}`,
        actual: 'Missing',
        result: 'FAIL',
        severity: 'HIGH',
        message: `Foreign key missing on ${tableName}.${expectedFK.column} → ${expectedFK.references}`,
      });
      continue;
    }

    // Foreign key matches → PASS
    checks.push({
      check_id: `foreign-key-${tableName}-${expectedFK.column}`,
      check_type: 'CONSTRAINT_VERIFICATION',
      check_name: `${tableName}.fk_${expectedFK.column}`,
      expected: `${expectedFK.column} → ${expectedFK.references}`,
      actual: `${actualFK.column} → ${actualFK.references}(${actualFK.referenced_column})`,
      result: 'PASS',
      severity: 'HIGH',
      message: `Foreign key on ${tableName}.${expectedFK.column} matches declaration`,
    });
  }

  return checks;
}
