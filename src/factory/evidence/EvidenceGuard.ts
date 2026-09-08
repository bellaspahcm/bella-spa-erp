/**
 * Factory Evidence Integrity Guard — Main Orchestrator
 * 
 * Origin: Bella Land "No Claim Without Evidence" principle
 * Purpose: Enforce evidence integrity before Factory closure
 * 
 * Key principle: F-G3 checks claim honesty, not software correctness
 */

import { StatusValidator } from './validators/StatusValidator';
import { ClaimValidator } from './validators/ClaimValidator';
import { AggregationValidator } from './validators/AggregationValidator';
import type {
  EvidenceValidationConfig,
  EvidenceValidationResult,
  EvidenceMatrix,
  IntegrityViolation,
  Claim,
} from './types';

export class EvidenceGuard {
  private statusValidator: StatusValidator;
  private claimValidator: ClaimValidator;
  private aggregationValidator: AggregationValidator;

  constructor() {
    this.statusValidator = new StatusValidator();
    this.claimValidator = new ClaimValidator();
    this.aggregationValidator = new AggregationValidator();
  }

  /**
   * Validate evidence integrity for Product closure
   * 
   * Returns violations if claims don't match evidence
   */
  async validate(
    config: EvidenceValidationConfig
  ): Promise<EvidenceValidationResult> {
    const violations: IntegrityViolation[] = [];
    const warnings: string[] = [];

    // 1. Validate status precision (TIMEOUT ≠ PASS)
    if (config.enforceStatusPrecision !== false) {
      const statusViolations = this.statusValidator.validateStatusPrecision(
        config.gates
      );
      violations.push(...statusViolations);

      // Check status-evidence consistency
      for (const gate of config.gates) {
        const consistencyViolations =
          this.statusValidator.validateStatusEvidenceConsistency(gate);
        violations.push(...consistencyViolations);
      }
    }

    // 2. Calculate accurate aggregated status
    const aggregatedStatus = this.aggregationValidator.calculateAggregatedStatus(
      config.gates
    );

    // 3. Check for status hiding (TIMEOUT hidden in "VERIFIED")
    const hidingViolations = this.aggregationValidator.validateNoStatusHiding(
      config.gates,
      aggregatedStatus
    );
    violations.push(...hidingViolations);

    // 4. Validate claims (if provided)
    let claims: Claim[] = config.claims || [];
    
    if (claims.length === 0) {
      // Auto-extract claims from gates
      claims = this.claimValidator.extractClaimsFromGates(config.gates);
    }

    if (config.enforceClaimBinding !== false) {
      const claimViolations = this.claimValidator.validateClaimEvidenceBinding(
        claims,
        config.gates
      );
      violations.push(...claimViolations);
    }

    // 5. Build evidence matrix
    const matrix: EvidenceMatrix = {
      product: config.product,
      gates: config.gates,
      claims,
      violations,
      aggregatedStatus,
      timestamp: new Date().toISOString(),
    };

    // 6. Generate warnings for non-blocking issues
    const warnViolations = violations.filter(v => v.severity === 'WARNING');
    warnings.push(...warnViolations.map(v => `${v.gate}: ${v.violation}`));

    // 7. Determine if validation passed (no BLOCKER violations)
    const blockers = violations.filter(v => v.severity === 'BLOCKER');
    const passed = blockers.length === 0;

    return {
      passed,
      violations,
      matrix,
      warnings,
    };
  }

  /**
   * Validate aggregate claim accuracy
   * 
   * Example: "Product fully verified" requires ALL gates PASS
   */
  validateAggregateClaim(
    claim: string,
    config: EvidenceValidationConfig
  ): IntegrityViolation | null {
    return this.claimValidator.validateAggregateClaimAccuracy(
      claim,
      config.gates
    );
  }

  /**
   * Generate human-readable evidence report
   */
  generateReport(result: EvidenceValidationResult): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('FACTORY EVIDENCE INTEGRITY REPORT');
    lines.push('='.repeat(60));
    lines.push('');

    // Product info
    lines.push(`Product: ${result.matrix.product}`);
    lines.push(`Timestamp: ${result.matrix.timestamp}`);
    lines.push('');

    // Aggregated status
    lines.push('Overall Status:');
    lines.push(`  ${this.getStatusIcon(result.matrix.aggregatedStatus.overall)} ${result.matrix.aggregatedStatus.overall}`);
    lines.push(`  ${result.matrix.aggregatedStatus.summary}`);
    lines.push('');

    // Gate results
    lines.push('Gate Results:');
    for (const gate of result.matrix.gates) {
      const icon = this.getGateStatusIcon(gate.status);
      const evidenceCount = gate.evidence.length;
      lines.push(
        `  ${icon} ${gate.gate}: ${gate.status} (${evidenceCount} evidence)`
      );
    }
    lines.push('');

    // Claims
    if (result.matrix.claims.length > 0) {
      lines.push('Claims:');
      for (const claim of result.matrix.claims) {
        const icon = this.getConfidenceIcon(claim.confidence);
        lines.push(`  ${icon} ${claim.statement}`);
        lines.push(`     Confidence: ${claim.confidence}`);
        lines.push(`     Evidence refs: ${claim.supportingEvidence.length}`);
      }
      lines.push('');
    }

    // Violations
    if (result.violations.length > 0) {
      lines.push('Integrity Violations:');
      
      const blockers = result.violations.filter(v => v.severity === 'BLOCKER');
      const warnings = result.violations.filter(v => v.severity === 'WARNING');

      if (blockers.length > 0) {
        lines.push('');
        lines.push('  🚫 BLOCKERS (must fix):');
        for (const violation of blockers) {
          lines.push(`     ${violation.violation}`);
          lines.push(`     Gate: ${violation.gate}`);
          lines.push(`     Detail: ${violation.detail}`);
          if (violation.suggestion) {
            lines.push(`     💡 ${violation.suggestion}`);
          }
          lines.push('');
        }
      }

      if (warnings.length > 0) {
        lines.push('  ⚠️  WARNINGS (non-blocking):');
        for (const violation of warnings) {
          lines.push(`     ${violation.violation}`);
          lines.push(`     Gate: ${violation.gate}`);
          if (violation.suggestion) {
            lines.push(`     💡 ${violation.suggestion}`);
          }
        }
        lines.push('');
      }
    }

    // Final result
    lines.push('='.repeat(60));
    if (result.passed) {
      lines.push('✅ EVIDENCE INTEGRITY: PASSED');
      lines.push('   Product closure allowed');
    } else {
      lines.push('❌ EVIDENCE INTEGRITY: FAILED');
      lines.push(`   ${result.violations.filter(v => v.severity === 'BLOCKER').length} blocker(s) must be resolved`);
      lines.push('   Product closure BLOCKED');
    }
    lines.push('='.repeat(60));
    lines.push('');

    return lines.join('\n');
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'VERIFIED':
        return '✅';
      case 'PARTIALLY_VERIFIED':
        return '🟡';
      case 'UNVERIFIED':
        return '⚠️';
      case 'FAILED':
        return '❌';
      default:
        return '❓';
    }
  }

  private getGateStatusIcon(status: string): string {
    switch (status) {
      case 'PASS':
        return '✅';
      case 'FAIL':
        return '❌';
      case 'TIMEOUT':
        return '⏱️';
      case 'SKIPPED':
        return '⏭️';
      case 'NOT_RUN':
        return '⏸️';
      case 'PARTIAL':
        return '🟡';
      default:
        return '❓';
    }
  }

  private getConfidenceIcon(confidence: string): string {
    switch (confidence) {
      case 'PROVEN':
        return '✅';
      case 'PARTIAL':
        return '🟡';
      case 'UNVERIFIED':
        return '⚠️';
      default:
        return '❓';
    }
  }
}
