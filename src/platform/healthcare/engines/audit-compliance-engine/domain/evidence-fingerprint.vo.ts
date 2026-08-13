/**
 * Clinical Evidence Package Fingerprint Value Object — Phase H11
 *
 * Generates canonical SHA-256 cryptographic fingerprints over evidence packages.
 * Strictly includes `schemaVersion` for backward-compatible verification.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/audit-compliance-engine/domain/evidence-fingerprint.vo
 */

import { createHash } from 'crypto';
import type { ComplianceStatus, EvidenceIntegrityStatus } from '../../../contracts/clinical-audit.contract';

export interface EvidenceFingerprintParams {
  schemaVersion: string;
  tenantId: string;
  encounterId: string;
  actionType: string;
  timestamp: string;
  performerId: string;
  performerRole: string;
  h8DecisionId?: string;
  h9SnapshotId?: string;
  h10RuleChecksum?: string;
  complianceStatus: ComplianceStatus;
  evidenceIntegrity: EvidenceIntegrityStatus;
  overrideDetails?: {
    enforcementLevel: string;
    overrideReason: string;
    overriddenBy: string;
    overriderRole: string;
    authorized: boolean;
  };
}

export class EvidenceFingerprintVO {
  public static generateFingerprint(params: EvidenceFingerprintParams): string {
    const canonicalObj = {
      schemaVersion: params.schemaVersion.trim(),
      tenantId: params.tenantId.trim(),
      encounterId: params.encounterId.trim(),
      actionType: params.actionType.trim(),
      timestamp: new Date(params.timestamp).toISOString(),
      performerId: params.performerId.trim(),
      performerRole: params.performerRole.trim(),
      h8DecisionId: params.h8DecisionId ? params.h8DecisionId.trim() : null,
      h9SnapshotId: params.h9SnapshotId ? params.h9SnapshotId.trim() : null,
      h10RuleChecksum: params.h10RuleChecksum ? params.h10RuleChecksum.trim() : null,
      complianceStatus: params.complianceStatus,
      evidenceIntegrity: params.evidenceIntegrity,
      overrideDetails: params.overrideDetails
        ? {
            enforcementLevel: params.overrideDetails.enforcementLevel,
            overrideReason: params.overrideDetails.overrideReason.trim(),
            overriddenBy: params.overrideDetails.overriddenBy.trim(),
            overriderRole: params.overrideDetails.overriderRole.trim(),
            authorized: params.overrideDetails.authorized
          }
        : null
    };

    const canonicalJson = JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
    const hash = createHash('sha256').update(canonicalJson).digest('hex');
    return `sha256-${hash}`;
  }
}
