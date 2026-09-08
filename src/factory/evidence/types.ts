/**
 * Factory Evidence Integrity Guard — Type Definitions
 * 
 * Origin: Bella Land learning (TIMEOUT ≠ PASS status precision requirement)
 * Purpose: Enforce "No Claim Without Evidence" principle
 */

export type GateStatus = 'PASS' | 'FAIL' | 'TIMEOUT' | 'SKIPPED' | 'NOT_RUN' | 'PARTIAL';

export type EvidenceType =
  | 'test-result'
  | 'command-output'
  | 'file-artifact'
  | 'screenshot'
  | 'log'
  | 'metric';

export type ClaimConfidence = 'PROVEN' | 'PARTIAL' | 'UNVERIFIED';

export type ViolationSeverity = 'BLOCKER' | 'WARNING';

export interface Evidence {
  type: EvidenceType;
  data: unknown;
  timestamp: string;
  source?: string; // Where evidence came from
}

export interface GateResult {
  gate: string;
  status: GateStatus;
  evidence: Evidence[];
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface Claim {
  statement: string;
  supportingEvidence: string[]; // References to evidence IDs
  confidence: ClaimConfidence;
  timestamp: string;
}

export interface IntegrityViolation {
  severity: ViolationSeverity;
  rule: string;
  violation: string;
  gate: string;
  detail: string;
  suggestion?: string;
}

export interface EvidenceMatrix {
  product: string;
  gates: GateResult[];
  claims: Claim[];
  violations: IntegrityViolation[];
  aggregatedStatus: AggregatedStatus;
  timestamp: string;
}

export interface AggregatedStatus {
  overall: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'FAILED';
  passedGates: number;
  totalGates: number;
  criticalGatesPassed: number;
  criticalGatesTotal: number;
  summary: string;
}

export interface EvidenceValidationConfig {
  product: string;
  gates: GateResult[];
  claims?: Claim[];
  enforceStatusPrecision?: boolean; // Default: true
  enforceClaimBinding?: boolean; // Default: true
  allowPartialVerification?: boolean; // Default: true
}

export interface EvidenceValidationResult {
  passed: boolean; // True if no BLOCKER violations
  violations: IntegrityViolation[];
  matrix: EvidenceMatrix;
  warnings: string[];
}

// Status transition rules (what conversions are forbidden)
export interface StatusTransitionRule {
  from: GateStatus;
  to: GateStatus;
  allowed: boolean;
  reason?: string;
}
