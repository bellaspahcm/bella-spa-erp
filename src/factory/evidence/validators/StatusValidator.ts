/**
 * Factory Evidence Guard — Status Precision Validator
 * 
 * Origin: Bella Land TypeScript TIMEOUT → PASS substitution issue
 * Purpose: Enforce status precision (TIMEOUT ≠ PASS, SKIPPED ≠ VERIFIED, etc.)
 */

import type {
  GateStatus,
  StatusTransitionRule,
  IntegrityViolation,
  GateResult,
} from '../types';

export class StatusValidator {
  /**
   * Define forbidden status transitions
   * 
   * These substitutions violate "No Claim Without Evidence"
   */
  private static readonly FORBIDDEN_TRANSITIONS: StatusTransitionRule[] = [
    {
      from: 'TIMEOUT',
      to: 'PASS',
      allowed: false,
      reason: 'TIMEOUT provides no evidence of correctness',
    },
    {
      from: 'TIMEOUT',
      to: 'SKIPPED',
      allowed: false,
      reason: 'TIMEOUT is a failure mode, not an intentional skip',
    },
    {
      from: 'SKIPPED',
      to: 'PASS',
      allowed: false,
      reason: 'SKIPPED means no evidence collected',
    },
    {
      from: 'NOT_RUN',
      to: 'PASS',
      allowed: false,
      reason: 'NOT_RUN means no validation performed',
    },
    {
      from: 'PARTIAL',
      to: 'PASS',
      allowed: false,
      reason: 'PARTIAL verification is not complete verification',
    },
    {
      from: 'FAIL',
      to: 'PASS',
      allowed: false,
      reason: 'FAIL cannot be converted to PASS without re-running',
    },
  ];

  /**
   * Validate that gate status is precise and not substituted
   */
  validateStatusPrecision(
    gateResults: GateResult[]
  ): IntegrityViolation[] {
    const violations: IntegrityViolation[] = [];

    for (const result of gateResults) {
      // Check for ambiguous status labels
      if (this.isAmbiguousStatus(result)) {
        violations.push({
          severity: 'BLOCKER',
          rule: 'status-precision',
          violation: 'Ambiguous gate status detected',
          gate: result.gate,
          detail: `Status "${result.status}" requires clarification`,
          suggestion: 'Use precise status: PASS, FAIL, TIMEOUT, SKIPPED, NOT_RUN, or PARTIAL',
        });
      }

      // Check for evidence-status mismatch
      if (result.status === 'PASS' && result.evidence.length === 0) {
        violations.push({
          severity: 'BLOCKER',
          rule: 'status-precision',
          violation: 'PASS status without supporting evidence',
          gate: result.gate,
          detail: 'Gate marked PASS but has no evidence',
          suggestion: 'Provide test results, command output, or other evidence',
        });
      }

      if (result.status === 'TIMEOUT' && result.evidence.length > 0) {
        // Check if evidence actually shows success
        const hasSuccessEvidence = result.evidence.some(e =>
          e.type === 'test-result' || e.type === 'command-output'
        );

        if (hasSuccessEvidence) {
          violations.push({
            severity: 'WARNING',
            rule: 'status-precision',
            violation: 'TIMEOUT status but evidence suggests completion',
            gate: result.gate,
            detail: 'Gate has evidence but marked TIMEOUT - verify status accuracy',
            suggestion: 'Review evidence and update status if gate actually passed',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check if a status label is ambiguous or imprecise
   */
  private isAmbiguousStatus(result: GateResult): boolean {
    const validStatuses: GateStatus[] = [
      'PASS',
      'FAIL',
      'TIMEOUT',
      'SKIPPED',
      'NOT_RUN',
      'PARTIAL',
    ];

    return !validStatuses.includes(result.status);
  }

  /**
   * Validate that forbidden status transitions are not used
   */
  validateNoForbiddenTransitions(
    originalStatus: GateStatus,
    reportedStatus: GateStatus,
    gate: string
  ): IntegrityViolation | null {
    const rule = StatusValidator.FORBIDDEN_TRANSITIONS.find(
      r => r.from === originalStatus && r.to === reportedStatus
    );

    if (rule && !rule.allowed) {
      return {
        severity: 'BLOCKER',
        rule: 'status-transition',
        violation: `Forbidden status transition: ${originalStatus} → ${reportedStatus}`,
        gate,
        detail: rule.reason || 'This transition violates evidence integrity',
        suggestion: `Keep status as ${originalStatus} or re-run gate to obtain proper evidence`,
      };
    }

    return null;
  }

  /**
   * Validate status-evidence consistency
   */
  validateStatusEvidenceConsistency(
    gateResult: GateResult
  ): IntegrityViolation[] {
    const violations: IntegrityViolation[] = [];

    // PASS must have positive evidence
    if (gateResult.status === 'PASS') {
      if (gateResult.evidence.length === 0) {
        violations.push({
          severity: 'BLOCKER',
          rule: 'evidence-consistency',
          violation: 'PASS without evidence',
          gate: gateResult.gate,
          detail: 'No evidence provided for PASS status',
          suggestion: 'Attach test results, command output, or verification artifacts',
        });
      }
    }

    // FAIL must have failure evidence
    if (gateResult.status === 'FAIL') {
      const hasFailureEvidence = gateResult.evidence.some(
        e => e.type === 'command-output' || e.type === 'log'
      );

      if (!hasFailureEvidence) {
        violations.push({
          severity: 'WARNING',
          rule: 'evidence-consistency',
          violation: 'FAIL without clear failure evidence',
          gate: gateResult.gate,
          detail: 'FAIL status but no error logs or command output attached',
          suggestion: 'Attach error logs, stack traces, or failure diagnostics',
        });
      }
    }

    // TIMEOUT must have timeout evidence
    if (gateResult.status === 'TIMEOUT') {
      const hasTimeoutEvidence = gateResult.metadata?.timeout === true ||
        gateResult.evidence.some(e =>
          JSON.stringify(e.data).toLowerCase().includes('timeout')
        );

      if (!hasTimeoutEvidence) {
        violations.push({
          severity: 'WARNING',
          rule: 'evidence-consistency',
          violation: 'TIMEOUT without timeout evidence',
          gate: gateResult.gate,
          detail: 'Status is TIMEOUT but evidence does not confirm timeout',
          suggestion: 'Verify status accuracy or attach timeout diagnostic output',
        });
      }
    }

    return violations;
  }
}
