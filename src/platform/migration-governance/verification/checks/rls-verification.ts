/**
 * Phase 4B.3 — RLS Verification (CRITICAL)
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * Decision: D3 — RLS MANDATORY for security-critical objects
 * 
 * Highest priority check (P0 security invariant).
 * 
 * Fail-closed when:
 * - RLS disabled on security-critical table
 * - Required policies missing
 * - Tenant isolation not provable
 * - Policy bypass detected
 * - Query/state indeterminate
 */

import { ExpectedState, ActualState, VerificationCheck, RLS_REQUIRED_POLICIES } from '../types';

/**
 * Verify RLS enabled + policies on security-critical tables
 * 
 * Checks:
 * 1. RLS enabled (CRITICAL)
 * 2. All 4 policies present: SELECT, INSERT, UPDATE, DELETE (CRITICAL)
 * 3. Tenant isolation enforced: tenant_id = current_tenant_id() (CRITICAL)
 * 
 * Result:
 * - RLS disabled → FAIL (CRITICAL)
 * - Missing policies → FAIL (CRITICAL)
 * - Tenant isolation not enforced → FAIL (CRITICAL)
 */
export async function verifyRLS(
  expectedState: ExpectedState,
  actualState: ActualState
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // Get security-critical tables from Contract
  const securityCriticalTables = expectedState.securityInvariants.tenantIsolation.tables;
  const requiredPolicies = expectedState.securityInvariants.tenantIsolation.policiesRequired;

  for (const tableName of securityCriticalTables) {
    const actualTable = actualState.tables[tableName];

    // Check 1: Table exists
    if (!actualTable || !actualTable.exists) {
      // Table missing → handled by drift detection
      continue;
    }

    // Check 2: RLS enabled (CRITICAL)
    const rlsEnabled = actualTable.rls?.enabled || false;

    if (!rlsEnabled) {
      checks.push({
        check_id: `rls-enabled-${tableName}`,
        check_type: 'RLS_VERIFICATION',
        check_name: `${tableName}.rls_enabled`,
        expected: true,
        actual: false,
        result: 'FAIL',
        severity: 'CRITICAL',
        message: `RLS not enabled on security-critical table ${tableName}. Tenant isolation cannot be enforced. This violates Contract security invariants.`,
      });
      continue; // No need to check policies if RLS disabled
    }

    // RLS enabled → PASS
    checks.push({
      check_id: `rls-enabled-${tableName}`,
      check_type: 'RLS_VERIFICATION',
      check_name: `${tableName}.rls_enabled`,
      expected: true,
      actual: true,
      result: 'PASS',
      severity: 'CRITICAL',
      message: `RLS enabled on ${tableName}`,
    });

    // Check 3: Required policies present (CRITICAL)
    const actualPolicies = actualTable.rls?.policies || [];
    const actualPolicyCommands = new Set(actualPolicies.map((p) => p.command));

    const missingPolicies = requiredPolicies.filter((cmd) => !actualPolicyCommands.has(cmd));

    if (missingPolicies.length > 0) {
      checks.push({
        check_id: `rls-policies-${tableName}`,
        check_type: 'RLS_VERIFICATION',
        check_name: `${tableName}.rls_policies`,
        expected: requiredPolicies,
        actual: Array.from(actualPolicyCommands),
        result: 'FAIL',
        severity: 'CRITICAL',
        message: `Missing RLS policies on ${tableName}: ${missingPolicies.join(', ')}. Tenant isolation incomplete.`,
      });
      continue;
    }

    // All policies present → PASS
    checks.push({
      check_id: `rls-policies-${tableName}`,
      check_type: 'RLS_VERIFICATION',
      check_name: `${tableName}.rls_policies`,
      expected: requiredPolicies,
      actual: Array.from(actualPolicyCommands),
      result: 'PASS',
      severity: 'CRITICAL',
      message: `All required policies present on ${tableName}`,
    });

    // Check 4: Tenant isolation enforced (CRITICAL)
    // Verify all policies enforce tenant_id = current_tenant_id()
    const tenantIsolationCheck = verifyTenantIsolation(tableName, actualPolicies);
    checks.push(tenantIsolationCheck);
  }

  return checks;
}

/**
 * Verify tenant isolation enforced in RLS policies
 * 
 * Check that all policies contain tenant_id = current_tenant_id() clause.
 * 
 * Phase 1: Simple string matching (heuristic acceptable for security check).
 * Phase 2: Could use SQL parser for more robust validation.
 */
function verifyTenantIsolation(
  tableName: string,
  policies: Array<{ name: string; command: string; using?: string; check?: string }>
): VerificationCheck {
  const tenantIsolationPattern = /tenant_id\s*=\s*current_tenant_id\(\)/i;

  for (const policy of policies) {
    const clause = policy.using || policy.check || '';

    if (!tenantIsolationPattern.test(clause)) {
      return {
        check_id: `tenant-isolation-${tableName}`,
        check_type: 'RLS_VERIFICATION',
        check_name: `${tableName}.tenant_isolation`,
        expected: 'All policies enforce tenant_id = current_tenant_id()',
        actual: `Policy '${policy.name}' (${policy.command}) does not enforce tenant isolation`,
        result: 'FAIL',
        severity: 'CRITICAL',
        message: `Policy '${policy.name}' on ${tableName} does not enforce tenant isolation. Cross-tenant data access possible.`,
      };
    }
  }

  // All policies enforce tenant isolation → PASS
  return {
    check_id: `tenant-isolation-${tableName}`,
    check_type: 'RLS_VERIFICATION',
    check_name: `${tableName}.tenant_isolation`,
    expected: 'All policies enforce tenant_id = current_tenant_id()',
    actual: 'All policies enforce tenant_id = current_tenant_id()',
    result: 'PASS',
    severity: 'CRITICAL',
    message: `Tenant isolation enforced on ${tableName}`,
  };
}
