/**
 * Audit Compliance Public Contract - Product-facing H11 boundary.
 *
 * This contract represents the product-facing evidence package surface.
 * The canonical clinical audit engine contract remains available through
 * `clinical-audit.contract.ts`.
 *
 * @module platform/healthcare/contracts/audit-compliance.contract
 */

export interface AuditEntryInputDTO {
  tenantId: string;
  encounterId: string;
  patientId?: string;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason?: string;
  clinicalDataHash?: string;
  decisionSupportSummary?: {
    safetyEvaluationStatus: string;
    absoluteBlockTriggered: boolean;
  };
  governedRuleChecksum?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvidencePackageDTO {
  id: string;
  sha256Fingerprint: string;
  createdAt?: string;
}

export interface IAuditComplianceContract {
  recordAuditEntry(input: AuditEntryInputDTO): Promise<AuditEvidencePackageDTO>;
}
