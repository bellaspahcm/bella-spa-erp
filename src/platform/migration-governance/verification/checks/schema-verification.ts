/**
 * Phase 4B.3 — Schema Structure Verification
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * Verify table/column structure matches declaration.
 * 
 * Checks:
 * 1. Table exists (if declared)
 * 2. Columns match declaration (name + type)
 * 3. Column types correct (e.g., declared uuid, actual uuid)
 * 
 * Result:
 * - Table missing (expected) → FAIL
 * - Column type mismatch → FAIL (HIGH severity)
 * - Additive column (not declared) → handled by drift detection
 */

import { ExpectedState, ActualState, VerificationCheck } from '../types';

/**
 * Verify schema structure matches declaration
 */
export async function verifySchema(
  expectedState: ExpectedState,
  actualState: ActualState
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // Only verify tables explicitly declared in migration expectations
  const migrationExpectations = expectedState.migrationExpectations.tables;

  if (!migrationExpectations) {
    // No migration-specific expectations → skip schema verification
    return checks;
  }

  for (const [tableName, expectedTable] of Object.entries(migrationExpectations)) {
    const actualTable = actualState.tables[tableName];

    // Check 1: Table exists
    if (!actualTable || !actualTable.exists) {
      checks.push({
        check_id: `table-exists-${tableName}`,
        check_type: 'SCHEMA_STRUCTURE',
        check_name: `${tableName}.exists`,
        expected: true,
        actual: false,
        result: 'FAIL',
        severity: 'HIGH',
        message: `Table ${tableName} declared in migration but does not exist in database. Migration may have failed.`,
      });
      continue; // Cannot check columns if table doesn't exist
    }

    // Table exists → PASS
    checks.push({
      check_id: `table-exists-${tableName}`,
      check_type: 'SCHEMA_STRUCTURE',
      check_name: `${tableName}.exists`,
      expected: true,
      actual: true,
      result: 'PASS',
      severity: 'HIGH',
      message: `Table ${tableName} exists`,
    });

    // Check 2: Columns match declaration
    if (expectedTable.columns && actualTable.columns) {
      const columnChecks = verifyColumns(tableName, expectedTable.columns, actualTable.columns);
      checks.push(...columnChecks);
    }
  }

  return checks;
}

/**
 * Verify columns match declaration (name + type)
 */
function verifyColumns(
  tableName: string,
  expectedColumns: { [columnName: string]: string },
  actualColumns: Array<{ name: string; type: string; nullable: boolean }>
): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  const actualColumnMap = new Map(actualColumns.map((c) => [c.name, c]));

  for (const [columnName, expectedType] of Object.entries(expectedColumns)) {
    const actualColumn = actualColumnMap.get(columnName);

    if (!actualColumn) {
      // Column missing → FAIL
      checks.push({
        check_id: `column-exists-${tableName}-${columnName}`,
        check_type: 'SCHEMA_STRUCTURE',
        check_name: `${tableName}.${columnName}.exists`,
        expected: true,
        actual: false,
        result: 'FAIL',
        severity: 'HIGH',
        message: `Column ${tableName}.${columnName} declared but does not exist in database.`,
      });
      continue;
    }

    // Column exists, check type
    const actualType = normalizeType(actualColumn.type);
    const expectedTypeNormalized = normalizeType(expectedType);

    if (actualType !== expectedTypeNormalized) {
      // Type mismatch → FAIL (HIGH severity)
      // This is T6 scenario: declared uuid, actual text
      checks.push({
        check_id: `column-type-${tableName}-${columnName}`,
        check_type: 'SCHEMA_STRUCTURE',
        check_name: `${tableName}.${columnName}.type`,
        expected: expectedType,
        actual: actualColumn.type,
        result: 'FAIL',
        severity: 'HIGH',
        message: `Column type mismatch: ${tableName}.${columnName} declared as '${expectedType}' but actual type is '${actualColumn.type}'. Migration did not apply as declared. Declaration ≠ proof.`,
      });
      continue;
    }

    // Column type matches → PASS
    checks.push({
      check_id: `column-type-${tableName}-${columnName}`,
      check_type: 'SCHEMA_STRUCTURE',
      check_name: `${tableName}.${columnName}.type`,
      expected: expectedType,
        actual: actualColumn.type,
      result: 'PASS',
      severity: 'HIGH',
      message: `Column ${tableName}.${columnName} type matches declaration (${expectedType})`,
    });
  }

  return checks;
}

/**
 * Normalize PostgreSQL type names for comparison
 * 
 * Examples:
 * - "character varying" → "varchar"
 * - "timestamp with time zone" → "timestamptz"
 * - "integer" → "int4"
 */
function normalizeType(type: string): string {
  const normalized = type.toLowerCase().trim();

  // Common PostgreSQL type aliases
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
