/**
 * Factory Evidence Guard — Claim-Evidence Binding Validator
 * 
 * Origin: Bella Land principle "No Claim Without Evidence"
 * Purpose: Ensure every claim is backed by actual evidence, no inference
 */

import type {
  Claim,
  Evidence,
  GateResult,
  IntegrityViolation,
  ClaimConfidence,
} from '../types';

export class ClaimValidator {
  /**
   * Validate that claims are properly bound to evidence
   */
  validateClaimEvidenceBinding(
    claims: Claim[],
    gateResults: GateResult[]
  ): IntegrityViolation[] {
    const violations: IntegrityViolation[] = [];

    // Build evidence index from gate results
    const evidenceIndex = this.buildEvidenceIndex(gateResults);

    for (const claim of claims) {
      // Check if claim has supporting evidence references
      if (claim.supportingEvidence.length === 0) {
        violations.push({
          severity: 'BLOCKER',
          rule: 'claim-evidence-binding',
          violation: 'Claim without supporting evidence',
          gate: 'N/A',
          detail: `Claim "${claim.statement}" has no evidence references`,
          suggestion: 'Attach evidence IDs or mark confidence as UNVERIFIED',
        });
        continue;
      }

      // Check if referenced evidence actually exists
      const missingEvidence = claim.supportingEvidence.filter(
        evidenceId => !evidenceIndex.has(evidenceId)
      );

      if (missingEvidence.length > 0) {
        violations.push({
          severity: 'BLOCKER',
          rule: 'claim-evidence-binding',
          violation: 'Claim references non-existent evidence',
          gate: 'N/A',
          detail: `Claim "${claim.statement}" references missing evidence: ${missingEvidence.join(', ')}`,
          suggestion: 'Remove invalid evidence references or provide missing evidence',
        });
      }

      // Check confidence-evidence consistency
      const confidenceViolation = this.validateConfidenceLevel(
        claim,
        evidenceIndex
      );
      if (confidenceViolation) {
        violations.push(confidenceViolation);
      }
    }

    return violations;
  }

  /**
   * Validate that confidence level matches evidence strength
   */
  private validateConfidenceLevel(
    claim: Claim,
    evidenceIndex: Map<string, Evidence>
  ): IntegrityViolation | null {
    const evidenceCount = claim.supportingEvidence.filter(id =>
      evidenceIndex.has(id)
    ).length;

    // PROVEN requires actual evidence
    if (claim.confidence === 'PROVEN' && evidenceCount === 0) {
      return {
        severity: 'BLOCKER',
        rule: 'confidence-evidence-mismatch',
        violation: 'PROVEN confidence without evidence',
        gate: 'N/A',
        detail: `Claim "${claim.statement}" marked PROVEN but has no valid evidence`,
        suggestion: 'Downgrade to UNVERIFIED or provide evidence',
      };
    }

    // UNVERIFIED should not have strong evidence
    if (claim.confidence === 'UNVERIFIED' && evidenceCount > 0) {
      return {
        severity: 'WARNING',
        rule: 'confidence-evidence-mismatch',
        violation: 'UNVERIFIED confidence with evidence present',
        gate: 'N/A',
        detail: `Claim "${claim.statement}" has evidence but marked UNVERIFIED`,
        suggestion: 'Upgrade confidence to PROVEN or PARTIAL based on evidence',
      };
    }

    return null;
  }

  /**
   * Build evidence index from gate results
   */
  private buildEvidenceIndex(gateResults: GateResult[]): Map<string, Evidence> {
    const index = new Map<string, Evidence>();

    for (const gateResult of gateResults) {
      for (let i = 0; i < gateResult.evidence.length; i++) {
        const evidence = gateResult.evidence[i];
        const evidenceId = `${gateResult.gate}-evidence-${i}`;
        index.set(evidenceId, evidence);
      }
    }

    return index;
  }

  /**
   * Extract claims from gate results automatically
   * 
   * This generates basic claims based on gate outcomes
   */
  extractClaimsFromGates(gateResults: GateResult[]): Claim[] {
    const claims: Claim[] = [];

    for (const gateResult of gateResults) {
      let confidence: ClaimConfidence;
      let statement: string;

      switch (gateResult.status) {
        case 'PASS':
          confidence = gateResult.evidence.length > 0 ? 'PROVEN' : 'UNVERIFIED';
          statement = `${gateResult.gate} verified`;
          break;

        case 'FAIL':
          confidence = 'PROVEN'; // Failure is proven by failure evidence
          statement = `${gateResult.gate} failed`;
          break;

        case 'TIMEOUT':
          confidence = 'UNVERIFIED';
          statement = `${gateResult.gate} not verified (timeout)`;
          break;

        case 'SKIPPED':
          confidence = 'UNVERIFIED';
          statement = `${gateResult.gate} not verified (skipped)`;
          break;

        case 'NOT_RUN':
          confidence = 'UNVERIFIED';
          statement = `${gateResult.gate} not verified (not run)`;
          break;

        case 'PARTIAL':
          confidence = 'PARTIAL';
          statement = `${gateResult.gate} partially verified`;
          break;

        default:
          confidence = 'UNVERIFIED';
          statement = `${gateResult.gate} status unknown`;
      }

      // Generate evidence IDs for this gate
      const supportingEvidence = gateResult.evidence.map(
        (_, i) => `${gateResult.gate}-evidence-${i}`
      );

      claims.push({
        statement,
        supportingEvidence,
        confidence,
        timestamp: new Date().toISOString(),
      });
    }

    return claims;
  }

  /**
   * Validate that high-level claims don't over-generalize from gates
   * 
   * Example: "Product fully verified" requires ALL gates PASS
   * Cannot be inferred from SOME gates PASS
   */
  validateAggregateClaimAccuracy(
    aggregateClaim: string,
    gateResults: GateResult[]
  ): IntegrityViolation | null {
    const claimLower = aggregateClaim.toLowerCase();

    // Check for "fully verified" or "all gates pass" claims
    if (
      claimLower.includes('fully verified') ||
      claimLower.includes('all gates') ||
      claimLower.includes('completely verified')
    ) {
      const hasNonPass = gateResults.some(
        g => g.status !== 'PASS'
      );

      if (hasNonPass) {
        const nonPassGates = gateResults
          .filter(g => g.status !== 'PASS')
          .map(g => `${g.gate} (${g.status})`)
          .join(', ');

        return {
          severity: 'BLOCKER',
          rule: 'aggregate-claim-accuracy',
          violation: 'Over-generalized verification claim',
          gate: 'N/A',
          detail: `Claim "${aggregateClaim}" but some gates not PASS: ${nonPassGates}`,
          suggestion: 'Use "Partially Verified" or list specific verified gates',
        };
      }
    }

    // Check for "verified" without qualification
    if (
      claimLower.includes('verified') &&
      !claimLower.includes('partially') &&
      !claimLower.includes('not')
    ) {
      const timeouts = gateResults.filter(g => g.status === 'TIMEOUT');
      const skipped = gateResults.filter(g => g.status === 'SKIPPED');
      const notRun = gateResults.filter(g => g.status === 'NOT_RUN');

      const unverifiedCount = timeouts.length + skipped.length + notRun.length;

      if (unverifiedCount > 0) {
        const unverifiedGates = [
          ...timeouts.map(g => `${g.gate} (TIMEOUT)`),
          ...skipped.map(g => `${g.gate} (SKIPPED)`),
          ...notRun.map(g => `${g.gate} (NOT_RUN)`),
        ].join(', ');

        return {
          severity: 'BLOCKER',
          rule: 'aggregate-claim-accuracy',
          violation: 'Unqualified "verified" claim with unverified gates',
          gate: 'N/A',
          detail: `Claim "${aggregateClaim}" but ${unverifiedCount} gates unverified: ${unverifiedGates}`,
          suggestion: `Qualify claim with specific verified scope, e.g., "Browser E2E verified, TypeScript pending"`,
        };
      }
    }

    return null;
  }
}
