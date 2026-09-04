/**
 * @fileoverview M3 Self-Critique Types
 * 
 * Types for governed self-critique layer that tests evidence sufficiency,
 * unsupported inference, contradictions, ambiguity, and downstream impact.
 * 
 * CRITICAL INVARIANT: Critique ≠ Authorization
 * 
 * @module platform/business-truth/critique/types
 */

import type { BusinessTruth } from '../types/business-truth';
import type { Evidence } from '../types/provenance';

/**
 * Critique issue severity.
 * 
 * Severity indicates governance risk, NOT authorization decision.
 */
export type IssueSeverity = 
  | 'BLOCKING'      // Must be resolved (e.g., contradictions, no evidence)
  | 'WARNING'       // Should be reviewed (e.g., weak evidence, assumptions)
  | 'ADVISORY';     // Good to know (e.g., alternatives exist)

/**
 * Critique issue types - what the critique detected.
 */
export type IssueType =
  | 'EVIDENCE_INSUFFICIENT'           // Not enough evidence for claim
  | 'EVIDENCE_CONTRADICTORY'          // Evidence conflicts
  | 'INFERENCE_UNSUPPORTED'           // Inference not justified by evidence
  | 'OBSERVATION_INFERENCE_CONFUSION' // Inference presented as observation
  | 'ASSUMPTION_HIDDEN'               // Unacknowledged assumption
  | 'AMBIGUITY_UNRESOLVED'            // Business ambiguity not surfaced
  | 'ALTERNATIVE_NOT_CONSIDERED'      // Alternative approach ignored
  | 'CONFIDENCE_EVIDENCE_MISMATCH'    // High confidence with weak evidence
  | 'PROVENANCE_INCOMPLETE'           // Missing source attribution
  | 'DOWNSTREAM_RISK_HIGH';           // High impact if proposal wrong

/**
 * A specific critique issue found.
 */
export interface CritiqueIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  affectedClaim: string;  // Which claim this affects
  evidence?: Evidence[];  // Relevant evidence
  recommendation?: string;  // How to address
}

/**
 * Critique result for a single Business Truth.
 * 
 * CRITICAL: This is assessment only, NOT authorization.
 */
export interface CritiqueResult {
  truthId: string;
  status: 'PASSED' | 'FLAGGED' | 'BLOCKED';
  issues: CritiqueIssue[];
  
  /**
   * Critique assessment.
   * 
   * IMPORTANT: This is NOT approval. High assessment does NOT mean
   * the truth can bypass authorization to become CANONICAL.
   */
  assessment: {
    evidenceSufficiency: number;  // 0-1
    logicalConsistency: number;   // 0-1
    ambiguityResolution: number;  // 0-1
    overallReadiness: number;     // 0-1
  };
  
  /**
   * Required next steps (governance, NOT authorization).
   */
  nextSteps: {
    requiresHumanReview: boolean;
    requiresMoreEvidence: boolean;
    requiresAmbiguityResolution: boolean;
    canProceedToAuthorization: boolean;  // Can proceed to M1, NOT auto-approve
  };
  
  critiqueMetadata: {
    critiquedAt: Date;
    critiqueVersion: string;
    testsConducted: string[];  // Which critique tests ran
  };
}

/**
 * Batch critique result - for multiple truths.
 */
export interface BatchCritiqueResult {
  results: Map<string, CritiqueResult>;  // truthId → result
  summary: {
    total: number;
    passed: number;
    flagged: number;
    blocked: number;
  };
  critiqueMetadata: {
    batchId: string;
    critiquedAt: Date;
    critiqueDuration: number;  // milliseconds
  };
}

/**
 * Critique configuration - which tests to run.
 */
export interface CritiqueConfig {
  tests: {
    evidenceSufficiency: boolean;
    contradictionDetection: boolean;
    inferenceValidation: boolean;
    ambiguityDetection: boolean;
    confidenceValidation: boolean;
    provenanceValidation: boolean;
    downstreamImpactAnalysis: boolean;
  };
  thresholds: {
    minEvidenceCount: number;          // Min evidence required
    minConfidenceForClaim: number;     // Min confidence (0-1)
    maxConfidenceWithoutEvidence: number; // Max confidence without strong evidence
  };
  strictMode: boolean;  // If true, treat warnings as blocking
}

/**
 * Default critique configuration.
 */
export const DEFAULT_CRITIQUE_CONFIG: CritiqueConfig = {
  tests: {
    evidenceSufficiency: true,
    contradictionDetection: true,
    inferenceValidation: true,
    ambiguityDetection: true,
    confidenceValidation: true,
    provenanceValidation: true,
    downstreamImpactAnalysis: true
  },
  thresholds: {
    minEvidenceCount: 1,
    minConfidenceForClaim: 0.3,
    maxConfidenceWithoutEvidence: 0.5
  },
  strictMode: false
};

/**
 * Critique error.
 */
export class CritiqueError extends Error {
  constructor(
    message: string,
    public phase: 'EVIDENCE_CHECK' | 'INFERENCE_CHECK' | 'SYNTHESIS',
    public cause?: Error
  ) {
    super(message);
    this.name = 'CritiqueError';
  }
}
