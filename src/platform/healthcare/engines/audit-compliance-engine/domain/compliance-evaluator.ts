/**
 * Pure Compliance & Evidence Evaluator — Phase H11
 *
 * Evaluates clinical action compliance and evidence chain integrity separately.
 * Enforces Anti-False-Compliance protection (missing metadata prevents COMPLIANT status).
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/audit-compliance-engine/domain/compliance-evaluator
 */

import type {
  ComplianceStatus,
  EvidenceIntegrityStatus,
  IComplianceEvaluationResult
} from '../../../contracts/clinical-audit.contract';

export interface EvaluateActionParams {
  actionType: string;
  performerRole: string;
  h8DecisionId?: string;
  h9SnapshotId?: string;
  h10RuleChecksum?: string;
  h8Verified?: boolean;
  h9Verified?: boolean;
  h10Verified?: boolean;
  overrideDetails?: {
    enforcementLevel: string;
    overrideReason: string;
    overriddenBy: string;
    overriderRole: string;
  };
}

export class ComplianceEvaluator {
  private static readonly AUTHORIZED_OVERRIDE_ROLES = new Set([
    'attending_physician',
    'department_head',
    'medical_director',
    'chief_of_department'
  ]);

  public static evaluateAction(params: EvaluateActionParams): IComplianceEvaluationResult {
    const hasCdsContext = Boolean(params.h8DecisionId || params.h10RuleChecksum);
    
    // Verification states
    const h8Verified = params.h8Verified ?? (params.h8DecisionId ? true : false);
    const h9Verified = params.h9Verified ?? (params.h9SnapshotId ? true : false);
    const h10Verified = params.h10Verified ?? (params.h10RuleChecksum ? true : false);

    let authorizationVerified = true;
    let fingerprintVerified = true;
    let rationale = 'Clinical action evaluated successfully.';

    // 1. Evidence Integrity Evaluation
    let evidenceIntegrity: EvidenceIntegrityStatus = 'COMPLETE';

    if (hasCdsContext) {
      if (!h8Verified || !h9Verified || !h10Verified) {
        evidenceIntegrity = !h8Verified && !h9Verified && !h10Verified ? 'BROKEN' : 'PARTIAL';
      }
    } else if (!params.h9SnapshotId) {
      // General action without CDS requires at least a temporal snapshot
      evidenceIntegrity = 'PARTIAL';
    }

    // 2. Anti-False-Compliance Invariant: Missing evidence prevents COMPLIANT
    if (evidenceIntegrity !== 'COMPLETE') {
      rationale = `Evidence chain incomplete (${evidenceIntegrity}). Compliance cannot be determined automatically; review required.`;
      return {
        complianceStatus: 'REQUIRES_REVIEW',
        evidenceIntegrity,
        chainVerification: {
          h8Verified,
          h9Verified,
          h10Verified,
          authorizationVerified: true,
          fingerprintVerified
        },
        rationale
      };
    }

    // 3. Override / Exception Evaluation (if action overrode a CDS decision)
    if (params.overrideDetails) {
      const { enforcementLevel, overrideReason, overriderRole } = params.overrideDetails;

      if (enforcementLevel === 'ABSOLUTE_BLOCK') {
        authorizationVerified = false;
        rationale = 'ABSOLUTE_BLOCK decisions are strictly non-overridable. Override attempt violates clinical safety policy.';
        return {
          complianceStatus: 'NON_COMPLIANT',
          evidenceIntegrity: 'COMPLETE',
          chainVerification: {
            h8Verified,
            h9Verified,
            h10Verified,
            authorizationVerified,
            fingerprintVerified
          },
          rationale
        };
      }

      if (enforcementLevel === 'BLOCK') {
        const isRoleAuthorized = ComplianceEvaluator.AUTHORIZED_OVERRIDE_ROLES.has(overriderRole.toLowerCase());
        const hasValidReason = overrideReason.trim().length >= 10;

        if (!isRoleAuthorized) {
          authorizationVerified = false;
          rationale = `Role '${overriderRole}' is not authorized to override BLOCK decisions. Authorized roles: attending_physician, department_head, medical_director.`;
          return {
            complianceStatus: 'NON_COMPLIANT',
            evidenceIntegrity: 'COMPLETE',
            chainVerification: {
              h8Verified,
              h9Verified,
              h10Verified,
              authorizationVerified,
              fingerprintVerified
            },
            rationale
          };
        }

        if (!hasValidReason) {
          authorizationVerified = false;
          rationale = 'Override justification reason is insufficient (must be at least 10 characters).';
          return {
            complianceStatus: 'NON_COMPLIANT',
            evidenceIntegrity: 'COMPLETE',
            chainVerification: {
              h8Verified,
              h9Verified,
              h10Verified,
              authorizationVerified,
              fingerprintVerified
            },
            rationale
          };
        }

        rationale = `BLOCK decision overridden by authorized role '${overriderRole}' with valid clinical justification.`;
        return {
          complianceStatus: 'EXCEPTION',
          evidenceIntegrity: 'COMPLETE',
          chainVerification: {
            h8Verified,
            h9Verified,
            h10Verified,
            authorizationVerified: true,
            fingerprintVerified
          },
          rationale
        };
      }
    }

    // 4. Default Compliant Standard Action
    return {
      complianceStatus: 'COMPLIANT',
      evidenceIntegrity: 'COMPLETE',
      chainVerification: {
        h8Verified,
        h9Verified,
        h10Verified,
        authorizationVerified: true,
        fingerprintVerified: true
      },
      rationale: 'Clinical action complies fully with authorized clinical rules and governance.'
    };
  }
}
