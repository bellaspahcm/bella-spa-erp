/**
 * Phase 4B.3 — Result Aggregator
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * Aggregate individual check results into overall result.
 * 
 * CRITICAL: Failure semantics must be preserved.
 * One WARNING check MUST NOT hide a FAIL check.
 * 
 * Logic (from Contract):
 * - if (errors > 0) → ERROR → BLOCKED
 * - if (critical_failed > 0) → FAIL → BLOCKED
 * - if (failed > 0) → FAIL → BLOCKED
 * - if (warnings > 0) → WARNING → ELIGIBLE
 * - else → PASS → ELIGIBLE
 * 
 * Deployment Eligibility:
 * - PASS → ELIGIBLE
 * - WARNING → ELIGIBLE
 * - FAIL → BLOCKED
 * - ERROR → BLOCKED (fail-closed)
 */

import { VerificationResult, VerificationCheck } from './types';

interface AggregateInput {
  verification_id: string;
  migration_id: string;
  commit_sha: string;
  approval_id?: string;
  environment?: string;
  checks: VerificationCheck[];
  execution_time_ms: number;
  timestamp: string;
}

/**
 * Aggregate check results into overall result
 * 
 * @param input - Checks and metadata
 * @returns Verification result with overall result and deployment eligibility
 */
export function aggregateResult(input: AggregateInput): VerificationResult {
  const { verification_id, migration_id, commit_sha, approval_id, environment, checks, execution_time_ms, timestamp } =
    input;

  // Count check results by type
  let passed = 0;
  let warnings = 0;
  let failed = 0;
  let errors = 0;
  let critical_passed = 0;
  let critical_failed = 0;

  for (const check of checks) {
    if (check.result === 'PASS') {
      passed++;
      if (check.severity === 'CRITICAL') {
        critical_passed++;
      }
    } else if (check.result === 'WARNING') {
      warnings++;
    } else if (check.result === 'FAIL') {
      failed++;
      if (check.severity === 'CRITICAL') {
        critical_failed++;
      }
    }
  }

  const total_checks = checks.length;

  // Determine overall result (fail-fast logic)
  let overall_result: VerificationResult['overall_result'];
  let deployment_eligible: boolean;

  if (errors > 0) {
    // Errors present → ERROR → BLOCKED
    overall_result = 'ERROR';
    deployment_eligible = false;
  } else if (critical_failed > 0) {
    // Critical checks failed → FAIL → BLOCKED
    overall_result = 'FAIL';
    deployment_eligible = false;
  } else if (failed > 0) {
    // Non-critical checks failed → FAIL → BLOCKED
    overall_result = 'FAIL';
    deployment_eligible = false;
  } else if (warnings > 0) {
    // Warnings present, no failures → WARNING → ELIGIBLE
    overall_result = 'WARNING';
    deployment_eligible = true;
  } else {
    // All checks passed → PASS → ELIGIBLE
    overall_result = 'PASS';
    deployment_eligible = true;
  }

  return {
    verification_id,
    migration_id,
    commit_sha,
    approval_id,
    environment,
    overall_result,
    deployment_eligible,
    checks,
    summary: {
      total_checks,
      passed,
      warnings,
      failed,
      errors,
      critical_passed,
      critical_failed,
    },
    execution_time_ms,
    timestamp,
  };
}
