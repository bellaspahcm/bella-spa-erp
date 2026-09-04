/**
 * @fileoverview M3 Self-Critique Engine
 * 
 * Governed critique layer that tests evidence sufficiency, unsupported
 * inference, contradictions, ambiguity, and downstream impact.
 * 
 * CRITICAL INVARIANTS:
 * 1. Critique ≠ Authorization (cannot self-authorize)
 * 2. High assessment ≠ CANONICAL (must go through M1)
 * 3. CRITIQUED → AUTHORIZATION → CANONICAL (no shortcuts)
 * 
 * @module platform/business-truth/critique/critique-engine
 */

import type { BusinessTruth } from '../types/business-truth';
import type { Evidence, Conflict, Alternative } from '../types/provenance';
import type {
  CritiqueResult,
  CritiqueIssue,
  CritiqueConfig,
  IssueSeverity,
  IssueType
} from './types';
import { DEFAULT_CRITIQUE_CONFIG, CritiqueError } from './types';

/**
 * Self-Critique Engine.
 * 
 * Tests proposals for evidence sufficiency, logical consistency,
 * unsupported inference, contradictions, and ambiguity.
 * 
 * DOES NOT AUTHORIZE. Only assesses and flags issues.
 */
export class CritiqueEngine {
  constructor(private config: CritiqueConfig = DEFAULT_CRITIQUE_CONFIG) {}

  /**
   * Critique a single Business Truth.
   * 
   * IMPORTANT: This method assesses only. It CANNOT:
   * - Change truth status to CANONICAL
   * - Bypass authorization boundary
   * - Self-approve proposals
   * 
   * Output is always CRITIQUED, never APPROVED or CANONICAL.
   */
  async critique(truth: BusinessTruth): Promise<CritiqueResult> {
    const issues: CritiqueIssue[] = [];
    const testsConducted: string[] = [];

    try {
      // Test 1: Evidence Sufficiency
      if (this.config.tests.evidenceSufficiency) {
        testsConducted.push('evidence-sufficiency');
        issues.push(...this.checkEvidenceSufficiency(truth));
      }

      // Test 2: Contradiction Detection
      if (this.config.tests.contradictionDetection) {
        testsConducted.push('contradiction-detection');
        issues.push(...this.checkContradictions(truth));
      }

      // Test 3: Inference Validation
      if (this.config.tests.inferenceValidation) {
        testsConducted.push('inference-validation');
        issues.push(...this.checkInferenceSupport(truth));
      }

      // Test 4: Ambiguity Detection
      if (this.config.tests.ambiguityDetection) {
        testsConducted.push('ambiguity-detection');
        issues.push(...this.checkAmbiguity(truth));
      }

      // Test 5: Confidence Validation
      if (this.config.tests.confidenceValidation) {
        testsConducted.push('confidence-validation');
        issues.push(...this.checkConfidenceEvidence(truth));
      }

      // Test 6: Provenance Validation
      if (this.config.tests.provenanceValidation) {
        testsConducted.push('provenance-validation');
        issues.push(...this.checkProvenance(truth));
      }

      // Test 7: Downstream Impact Analysis
      if (this.config.tests.downstreamImpactAnalysis) {
        testsConducted.push('downstream-impact-analysis');
        issues.push(...this.checkDownstreamImpact(truth));
      }

      // Determine status
      const hasBlocking = issues.some(i => i.severity === 'BLOCKING');
      const hasWarning = issues.some(i => i.severity === 'WARNING');
      
      let status: 'PASSED' | 'FLAGGED' | 'BLOCKED';
      if (hasBlocking || (this.config.strictMode && hasWarning)) {
        status = 'BLOCKED';
      } else if (hasWarning) {
        status = 'FLAGGED';
      } else {
        status = 'PASSED';
      }

      // Calculate assessment scores
      const assessment = this.calculateAssessment(truth, issues);

      // Determine next steps (governance, NOT authorization)
      const nextSteps = {
        requiresHumanReview: status === 'BLOCKED' || status === 'FLAGGED',
        requiresMoreEvidence: issues.some(i => 
          i.type === 'EVIDENCE_INSUFFICIENT' || 
          i.type === 'CONFIDENCE_EVIDENCE_MISMATCH'
        ),
        requiresAmbiguityResolution: issues.some(i => 
          i.type === 'AMBIGUITY_UNRESOLVED'
        ),
        // CRITICAL: Can proceed to authorization ≠ auto-approved
        canProceedToAuthorization: status === 'PASSED'
      };

      return {
        truthId: truth.id,
        status,
        issues,
        assessment,
        nextSteps,
        critiqueMetadata: {
          critiquedAt: new Date(),
          critiqueVersion: '1.0.0',
          testsConducted
        }
      };
    } catch (error) {
      throw new CritiqueError(
        `Critique failed for truth ${truth.id}`,
        'SYNTHESIS',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Test 1: Evidence Sufficiency
   * 
   * Checks if there is enough evidence to support the claim.
   */
  private checkEvidenceSufficiency(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    const evidenceCount = truth.provenance.sources.length;

    // No evidence at all
    if (evidenceCount === 0) {
      issues.push({
        type: 'EVIDENCE_INSUFFICIENT',
        severity: 'BLOCKING',
        description: 'No evidence provided for this claim',
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Add evidence sources before proceeding'
      });
    }
    // Insufficient evidence
    else if (evidenceCount < this.config.thresholds.minEvidenceCount) {
      issues.push({
        type: 'EVIDENCE_INSUFFICIENT',
        severity: 'WARNING',
        description: `Only ${evidenceCount} evidence source(s), minimum ${this.config.thresholds.minEvidenceCount} recommended`,
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Consider gathering more evidence'
      });
    }

    return issues;
  }

  /**
   * Test 2: Contradiction Detection
   * 
   * Checks if evidence contains contradictions.
   */
  private checkContradictions(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    const conflicts = truth.provenance.conflicts || [];

    for (const conflict of conflicts) {
      // Unresolved conflicts are blocking
      if (!conflict.resolution) {
        issues.push({
          type: 'EVIDENCE_CONTRADICTORY',
          severity: 'BLOCKING',
          description: conflict.description,
          affectedClaim: this.extractClaim(truth),
          recommendation: 'Resolve contradiction before proceeding'
        });
      }
      // Resolved conflicts are advisory
      else {
        issues.push({
          type: 'EVIDENCE_CONTRADICTORY',
          severity: 'ADVISORY',
          description: `Contradiction resolved: ${conflict.description}`,
          affectedClaim: this.extractClaim(truth),
          recommendation: 'Verify resolution is sound'
        });
      }
    }

    return issues;
  }

  /**
   * Test 3: Inference Support
   * 
   * Checks if inference is supported by evidence.
   */
  private checkInferenceSupport(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];

    // If epistemic status is INFERENCE, check reasoning
    if (truth.provenance.epistemicStatus === 'INFERENCE') {
      const reasoning = truth.provenance.reasoning;
      const evidenceCount = truth.provenance.sources.length;

      // Inference without evidence
      if (evidenceCount === 0) {
        issues.push({
          type: 'INFERENCE_UNSUPPORTED',
          severity: 'BLOCKING',
          description: 'Inference made without any evidence',
          affectedClaim: this.extractClaim(truth),
          recommendation: 'Provide evidence to support inference'
        });
      }
      // Inference without reasoning
      else if (!reasoning || reasoning.trim().length === 0) {
        issues.push({
          type: 'INFERENCE_UNSUPPORTED',
          severity: 'WARNING',
          description: 'Inference lacks explicit reasoning',
          affectedClaim: this.extractClaim(truth),
          recommendation: 'Document reasoning process'
        });
      }
    }

    // If epistemic status is OBSERVATION but confidence is low, might be inference
    if (truth.provenance.epistemicStatus === 'OBSERVATION' && 
        truth.confidence.score < 0.8) {
      issues.push({
        type: 'OBSERVATION_INFERENCE_CONFUSION',
        severity: 'WARNING',
        description: 'Marked as observation but confidence suggests inference',
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Verify epistemic status is correct'
      });
    }

    return issues;
  }

  /**
   * Test 4: Ambiguity Detection
   * 
   * Checks for unresolved business ambiguity.
   */
  private checkAmbiguity(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    const alternatives = truth.provenance.alternatives || [];

    // Multiple alternatives without clear choice
    if (alternatives.length > 0) {
      const hasChosenAlternative = alternatives.some(alt => 
        alt.description && (
          alt.description.toLowerCase().includes('chosen') ||
          alt.description.toLowerCase().includes('selected')
        )
      );

      if (!hasChosenAlternative) {
        issues.push({
          type: 'AMBIGUITY_UNRESOLVED',
          severity: 'BLOCKING',
          description: `${alternatives.length} alternative approach(es) exist without clear selection`,
          affectedClaim: this.extractClaim(truth),
          recommendation: 'Business decision required to select approach'
        });
      }
    }

    // Check for assumption markers in reasoning
    const reasoning = truth.provenance.reasoning || '';
    const assumptionMarkers = ['assume', 'assuming', 'presumably', 'likely', 'probably'];
    const hasAssumptions = assumptionMarkers.some(marker => 
      reasoning.toLowerCase().includes(marker)
    );

    if (hasAssumptions) {
      issues.push({
        type: 'ASSUMPTION_HIDDEN',
        severity: 'WARNING',
        description: 'Reasoning contains assumptions that may need validation',
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Make assumptions explicit and validate if possible'
      });
    }

    return issues;
  }

  /**
   * Test 5: Confidence vs Evidence Quality
   * 
   * Checks if confidence matches evidence quality.
   */
  private checkConfidenceEvidence(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    const confidence = truth.confidence.score;
    const evidenceCount = truth.provenance.sources.length;
    const hasStrongEvidence = evidenceCount >= this.config.thresholds.minEvidenceCount;

    // High confidence without evidence
    if (confidence > this.config.thresholds.maxConfidenceWithoutEvidence && !hasStrongEvidence) {
      issues.push({
        type: 'CONFIDENCE_EVIDENCE_MISMATCH',
        severity: 'BLOCKING',
        description: `Confidence ${confidence.toFixed(2)} too high for evidence quality (${evidenceCount} source(s))`,
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Lower confidence or gather more evidence'
      });
    }

    // Very low confidence (might need more work)
    if (confidence < this.config.thresholds.minConfidenceForClaim) {
      issues.push({
        type: 'CONFIDENCE_EVIDENCE_MISMATCH',
        severity: 'WARNING',
        description: `Confidence ${confidence.toFixed(2)} below threshold ${this.config.thresholds.minConfidenceForClaim}`,
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Consider gathering more evidence or marking as uncertain'
      });
    }

    return issues;
  }

  /**
   * Test 6: Provenance Completeness
   * 
   * Checks if provenance is complete.
   */
  private checkProvenance(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];

    // Missing epistemic status
    if (!truth.provenance.epistemicStatus) {
      issues.push({
        type: 'PROVENANCE_INCOMPLETE',
        severity: 'BLOCKING',
        description: 'Epistemic status not set',
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Set epistemic status (OBSERVATION/INFERENCE/etc)'
      });
    }

    // Missing reasoning for inference
    if (truth.provenance.epistemicStatus === 'INFERENCE' && 
        !truth.provenance.reasoning) {
      issues.push({
        type: 'PROVENANCE_INCOMPLETE',
        severity: 'WARNING',
        description: 'Inference lacks reasoning documentation',
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Document reasoning process'
      });
    }

    return issues;
  }

  /**
   * Test 7: Downstream Impact Analysis
   * 
   * Checks potential impact if proposal is wrong.
   */
  private checkDownstreamImpact(truth: BusinessTruth): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];

    // High impact areas (entities, core processes)
    const isHighImpact = 
      truth.type === 'ENTITY' ||
      (truth.type === 'PROCESS' && truth.provenance.epistemicStatus === 'INFERENCE');

    if (isHighImpact && truth.confidence.score < 0.7) {
      issues.push({
        type: 'DOWNSTREAM_RISK_HIGH',
        severity: 'WARNING',
        description: 'High-impact claim with moderate confidence',
        affectedClaim: this.extractClaim(truth),
        recommendation: 'Consider increasing confidence through more evidence'
      });
    }

    return issues;
  }

  /**
   * Calculate assessment scores.
   */
  private calculateAssessment(
    truth: BusinessTruth,
    issues: CritiqueIssue[]
  ): CritiqueResult['assessment'] {
    const blocking = issues.filter(i => i.severity === 'BLOCKING').length;
    const warnings = issues.filter(i => i.severity === 'WARNING').length;

    // Evidence sufficiency (0-1)
    const evidenceCount = truth.provenance.sources.length;
    const evidenceSufficiency = Math.min(1, evidenceCount / this.config.thresholds.minEvidenceCount);

    // Logical consistency (1 if no contradictions/blocking issues)
    const logicalConsistency = blocking === 0 ? 1 : Math.max(0, 1 - (blocking * 0.3));

    // Ambiguity resolution (1 if no ambiguity issues)
    const ambiguityIssues = issues.filter(i => 
      i.type === 'AMBIGUITY_UNRESOLVED' || i.type === 'ASSUMPTION_HIDDEN'
    ).length;
    const ambiguityResolution = Math.max(0, 1 - (ambiguityIssues * 0.2));

    // Overall readiness (average, weighted by blocking issues)
    const baseReadiness = (evidenceSufficiency + logicalConsistency + ambiguityResolution) / 3;
    const overallReadiness = blocking === 0 ? baseReadiness : Math.min(baseReadiness, 0.5);

    return {
      evidenceSufficiency,
      logicalConsistency,
      ambiguityResolution,
      overallReadiness
    };
  }

  /**
   * Extract claim description for issue reporting.
   */
  private extractClaim(truth: BusinessTruth): string {
    return `${truth.type}: ${truth.content.name || truth.content.description || truth.id}`;
  }
}
