/**
 * Capability Risk Registry Types
 * 
 * Defines risk classification types for host capability registry.
 * Enforces Platform Constitution Law 11 (Strictly No any Types).
 * 
 * @module platform/host/capability-registry
 */

export interface CapabilityApprovers {
  approvers: string[];
}

export interface CapabilityRiskClassification {
  capabilityId: string;
  capabilityName: string;
  domain: string;
  scaleFactor: number;
  clinicalCriticality: number;
  blastRadius: number;
  riskScore: number;
  calculatedTier: 'T1' | 'T2' | 'T3';
  overrideRule: string;
  finalTier: 'T1' | 'T2' | 'T3';
  rolloutPolicy: string;
  safetyProfile: string;
  governanceStatus: string;
  notes: string | null;
  sourceDocument: string;
  sourceVersion: string;
  generatedAt: string;
  generatedFromHash: string;
  matrixSignature: string;
  approvedBy: CapabilityApprovers;
  approvedAt: string;
  generatorVersion: string;
}
