/**
 * Clinical Audit & Compliance Engine Contract — Phase H11
 *
 * Defines the public contract interface for the Evidence & Compliance Layer.
 * Separates Clinical Compliance from Evidence Integrity, enforces write-once immutability,
 * and provides verifiable Clinical Evidence Package generation.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/contracts/clinical-audit.contract
 */

import type { EngineResponse } from '../shared-kernel/types';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'EXCEPTION' | 'REQUIRES_REVIEW';

export type EvidenceIntegrityStatus = 'COMPLETE' | 'PARTIAL' | 'BROKEN' | 'UNVERIFIABLE';

export interface IClinicalAuditRecord {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  actionType: string;
  performerId: string;
  performerRole: string;
  h8DecisionId?: string;
  h9SnapshotId?: string;
  h10RuleCode?: string;
  h10RuleVersion?: string;
  h10RuleChecksum?: string;
  complianceStatus: ComplianceStatus;
  evidenceIntegrity: EvidenceIntegrityStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IClinicalEvidencePackage {
  id: string;
  tenantId: string;
  auditId: string;
  schemaVersion: string; // e.g. '1.0.0'
  sourceReferences: {
    encounterId: string;
    h8DecisionId?: string;
    h9SnapshotId?: string;
    h10RuleChecksum?: string;
  };
  canonicalPayload: {
    actionType: string;
    timestamp: string;
    performer: { id: string; role: string };
    patientStateAtT?: Record<string, unknown>;
    cdsDecisionAtT?: Record<string, unknown>;
    governedRuleAtT?: Record<string, unknown>;
    overrideDetails?: {
      enforcementLevel: string;
      overrideReason: string;
      overriddenBy: string;
      overriderRole: string;
      authorized: boolean;
    };
    complianceStatus: ComplianceStatus;
    evidenceIntegrity: EvidenceIntegrityStatus;
  };
  fingerprint: string; // SHA-256 hash representation
  createdAt: string;
}

export interface IComplianceExceptionRecord {
  id: string;
  tenantId: string;
  auditId: string;
  encounterId: string;
  enforcementLevel: string;
  overrideReason: string;
  overriddenBy: string;
  overriderRole: string;
  authorized: boolean;
  createdAt: string;
}

export interface IComplianceEvaluationResult {
  complianceStatus: ComplianceStatus;
  evidenceIntegrity: EvidenceIntegrityStatus;
  chainVerification: {
    h8Verified: boolean;
    h9Verified: boolean;
    h10Verified: boolean;
    authorizationVerified: boolean;
    fingerprintVerified: boolean;
  };
  rationale: string;
}

export interface IComplianceReportSummary {
  tenantId: string;
  totalAuditedActions: number;
  compliantCount: number;
  nonCompliantCount: number;
  exceptionCount: number;
  requiresReviewCount: number;
  completeIntegrityCount: number;
  brokenIntegrityCount: number;
  overrideRatePercent: number;
  generatedAt: string;
}

export interface IRecordAuditInput {
  tenantId: string;
  encounterId: string;
  patientId: string;
  actionType: string;
  performerId: string;
  performerRole: string;
  h8DecisionId?: string;
  h9SnapshotId?: string;
  h10RuleCode?: string;
  h10RuleVersion?: string;
  h10RuleChecksum?: string;
  overrideDetails?: {
    enforcementLevel: string;
    overrideReason: string;
    overriddenBy: string;
    overriderRole: string;
  };
  metadata?: Record<string, unknown>;
}

export interface IClinicalAuditContract {
  /**
   * Records a clinical action in the write-once audit ledger and evaluates compliance & evidence integrity.
   */
  recordAuditEntry(input: IRecordAuditInput): Promise<EngineResponse<IClinicalAuditRecord>>;

  /**
   * Evaluates the compliance and evidence chain integrity of a recorded clinical action.
   */
  evaluateActionCompliance(tenantId: string, auditId: string): Promise<EngineResponse<IComplianceEvaluationResult>>;

  /**
   * Issues and persists an immutable Clinical Evidence Package with a canonical SHA-256 fingerprint.
   */
  issueEvidencePackage(tenantId: string, auditId: string): Promise<EngineResponse<IClinicalEvidencePackage>>;

  /**
   * Reconstructs the complete evidence chain and historical context for an audit investigation at timestamp T.
   */
  investigateClinicalAction(
    tenantId: string,
    auditId: string
  ): Promise<
    EngineResponse<{
      audit: IClinicalAuditRecord;
      evidencePackage: IClinicalEvidencePackage | null;
      exceptionRecord: IComplianceExceptionRecord | null;
      evaluation: IComplianceEvaluationResult;
    }>
  >;

  /**
   * Aggregates compliance report metrics for a tenant across a given time window.
   */
  getComplianceReportSummary(
    tenantId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<EngineResponse<IComplianceReportSummary>>;
}
