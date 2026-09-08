/**
 * Factory Evidence Guard — Status Aggregation Validator
 * 
 * Origin: Bella Land "5 PASS + 1 TIMEOUT ≠ Fully Verified"
 * Purpose: Ensure aggregated status reflects ALL gate statuses accurately
 */

import type {
  GateResult,
  AggregatedStatus,
  IntegrityViolation,
} from '../types';

export class AggregationValidator {
  /**
   * Calculate accurate aggregated status from gate results
   * 
   * Rules:
   * - ALL gates PASS → VERIFIED
   * - ANY gate FAIL → FAILED
   * - ANY gate TIMEOUT/SKIPPED/NOT_RUN → PARTIALLY_VERIFIED
   * - ALL gates TIMEOUT/SKIPPED/NOT_RUN → UNVERIFIED
   */
  calculateAggregatedStatus(
    gateResults: GateResult[],
    criticalGates?: string[]
  ): AggregatedStatus {
    const totalGates = gateResults.length;
    const passedGates = gateResults.filter(g => g.status === 'PASS').length;
    const failedGates = gateResults.filter(g => g.status === 'FAIL').length;
    const timeoutGates = gateResults.filter(g => g.status === 'TIMEOUT').length;
    const skippedGates = gateResults.filter(g => g.status === 'SKIPPED').length;
    const notRunGates = gateResults.filter(g => g.status === 'NOT_RUN').length;
    const partialGates = gateResults.filter(g => g.status === 'PARTIAL').length;

    // Critical gates tracking
    const criticalGateSet = new Set(criticalGates || []);
    const criticalGatesTotal = criticalGateSet.size;
    const criticalGatesPassed = gateResults.filter(
      g => criticalGateSet.has(g.gate) && g.status === 'PASS'
    ).length;

    // Determine overall status
    let overall: AggregatedStatus['overall'];
    let summary: string;

    if (failedGates > 0) {
      overall = 'FAILED';
      summary = `${failedGates} gate(s) failed`;
    } else if (passedGates === totalGates) {
      overall = 'VERIFIED';
      summary = `All ${totalGates} gates verified`;
    } else if (
      passedGates === 0 &&
      (timeoutGates + skippedGates + notRunGates === totalGates)
    ) {
      overall = 'UNVERIFIED';
      summary = 'No gates verified';
    } else {
      overall = 'PARTIALLY_VERIFIED';
      const verified = passedGates;
      const unverified = timeoutGates + skippedGates + notRunGates;
      const partial = partialGates;

      const parts: string[] = [];
      if (verified > 0) parts.push(`${verified} verified`);
      if (partial > 0) parts.push(`${partial} partial`);
      if (unverified > 0) parts.push(`${unverified} unverified`);

      summary = parts.join(', ');
    }

    // Check critical gates
    if (criticalGatesTotal > 0 && criticalGatesPassed < criticalGatesTotal) {
      const criticalFailed = criticalGatesTotal - criticalGatesPassed;
      summary += ` (⚠️ ${criticalFailed} critical gate(s) not passed)`;
      
      // Critical gate failure should affect overall status
      if (overall === 'VERIFIED') {
        overall = 'PARTIALLY_VERIFIED';
      }
    }

    return {
      overall,
      passedGates,
      totalGates,
      criticalGatesPassed,
      criticalGatesTotal,
      summary,
    };
  }

  /**
   * Validate that reported aggregated status matches actual gate results
   */
  validateAggregation(
    reportedStatus: AggregatedStatus,
    gateResults: GateResult[],
    criticalGates?: string[]
  ): IntegrityViolation[] {
    const violations: IntegrityViolation[] = [];

    // Calculate what status SHOULD be
    const correctStatus = this.calculateAggregatedStatus(
      gateResults,
      criticalGates
    );

    // Check overall status accuracy
    if (reportedStatus.overall !== correctStatus.overall) {
      violations.push({
        severity: 'BLOCKER',
        rule: 'status-aggregation',
        violation: 'Aggregated status mismatch',
        gate: 'N/A',
        detail: `Reported: ${reportedStatus.overall}, Actual: ${correctStatus.overall}`,
        suggestion: `Change overall status to ${correctStatus.overall} to match gate results`,
      });
    }

    // Check gate counts accuracy
    if (reportedStatus.passedGates !== correctStatus.passedGates) {
      violations.push({
        severity: 'BLOCKER',
        rule: 'status-aggregation',
        violation: 'Incorrect passed gates count',
        gate: 'N/A',
        detail: `Reported: ${reportedStatus.passedGates}, Actual: ${correctStatus.passedGates}`,
        suggestion: 'Recalculate passed gates count from gate results',
      });
    }

    if (reportedStatus.totalGates !== correctStatus.totalGates) {
      violations.push({
        severity: 'BLOCKER',
        rule: 'status-aggregation',
        violation: 'Incorrect total gates count',
        gate: 'N/A',
        detail: `Reported: ${reportedStatus.totalGates}, Actual: ${correctStatus.totalGates}`,
        suggestion: 'Recalculate total gates count',
      });
    }

    // Check critical gates tracking
    if (
      criticalGates &&
      criticalGates.length > 0 &&
      reportedStatus.criticalGatesPassed !== correctStatus.criticalGatesPassed
    ) {
      violations.push({
        severity: 'BLOCKER',
        rule: 'status-aggregation',
        violation: 'Incorrect critical gates count',
        gate: 'N/A',
        detail: `Reported: ${reportedStatus.criticalGatesPassed}, Actual: ${correctStatus.criticalGatesPassed}`,
        suggestion: 'Recalculate critical gates from designated critical gate list',
      });
    }

    return violations;
  }

  /**
   * Validate that TIMEOUT/SKIPPED/NOT_RUN gates are not hidden in aggregation
   */
  validateNoStatusHiding(
    gateResults: GateResult[],
    aggregatedStatus: AggregatedStatus
  ): IntegrityViolation[] {
    const violations: IntegrityViolation[] = [];

    const problematicGates = gateResults.filter(
      g =>
        g.status === 'TIMEOUT' ||
        g.status === 'SKIPPED' ||
        g.status === 'NOT_RUN'
    );

    if (problematicGates.length > 0 && aggregatedStatus.overall === 'VERIFIED') {
      violations.push({
        severity: 'BLOCKER',
        rule: 'status-hiding',
        violation: 'VERIFIED status hides unverified gates',
        gate: 'N/A',
        detail: `Status is VERIFIED but ${problematicGates.length} gates not verified: ${problematicGates.map(g => `${g.gate} (${g.status})`).join(', ')}`,
        suggestion: 'Change to PARTIALLY_VERIFIED and list unverified gates in summary',
      });
    }

    return violations;
  }

  /**
   * Generate human-readable status summary
   */
  generateStatusSummary(gateResults: GateResult[]): string {
    const byStatus = {
      PASS: gateResults.filter(g => g.status === 'PASS'),
      FAIL: gateResults.filter(g => g.status === 'FAIL'),
      TIMEOUT: gateResults.filter(g => g.status === 'TIMEOUT'),
      SKIPPED: gateResults.filter(g => g.status === 'SKIPPED'),
      NOT_RUN: gateResults.filter(g => g.status === 'NOT_RUN'),
      PARTIAL: gateResults.filter(g => g.status === 'PARTIAL'),
    };

    const parts: string[] = [];

    if (byStatus.PASS.length > 0) {
      parts.push(
        `✅ ${byStatus.PASS.length} PASS (${byStatus.PASS.map(g => g.gate).join(', ')})`
      );
    }

    if (byStatus.FAIL.length > 0) {
      parts.push(
        `❌ ${byStatus.FAIL.length} FAIL (${byStatus.FAIL.map(g => g.gate).join(', ')})`
      );
    }

    if (byStatus.TIMEOUT.length > 0) {
      parts.push(
        `⏱️ ${byStatus.TIMEOUT.length} TIMEOUT (${byStatus.TIMEOUT.map(g => g.gate).join(', ')})`
      );
    }

    if (byStatus.SKIPPED.length > 0) {
      parts.push(
        `⏭️ ${byStatus.SKIPPED.length} SKIPPED (${byStatus.SKIPPED.map(g => g.gate).join(', ')})`
      );
    }

    if (byStatus.NOT_RUN.length > 0) {
      parts.push(
        `⏸️ ${byStatus.NOT_RUN.length} NOT_RUN (${byStatus.NOT_RUN.map(g => g.gate).join(', ')})`
      );
    }

    if (byStatus.PARTIAL.length > 0) {
      parts.push(
        `🟡 ${byStatus.PARTIAL.length} PARTIAL (${byStatus.PARTIAL.map(g => g.gate).join(', ')})`
      );
    }

    return parts.join('\n');
  }
}
