/**
 * Clinical Audit & Compliance Service — Phase H11
 *
 * Implements IClinicalAuditContract. Manages write-once audit logging,
 * compliance & evidence integrity evaluations, exception tracking,
 * point-in-time evidence reconstruction, and Evidence Package issuance.
 *
 * Constitution:
 *   - Law 1: Bounded context isolation (Zero direct queries on H8/H9/H10 internal tables)
 *   - Law 11: Zero `any` types (Law 11 enforced)
 *   - H11-01: Ledger Immutability
 *   - H11-02: Verifiable Cryptographic Fingerprint
 *   - Event-After-Persistence: Domain events published strictly after DB writes
 *
 * @module platform/healthcare/engines/audit-compliance-engine/audit-compliance.service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IClinicalAuditContract,
  IRecordAuditInput,
  IClinicalAuditRecord,
  IClinicalEvidencePackage,
  IComplianceExceptionRecord,
  IComplianceEvaluationResult,
  IComplianceReportSummary
} from '../../contracts/clinical-audit.contract';
import type { EngineResponse } from '../../shared-kernel/types';
import { ComplianceEvaluator } from './domain/compliance-evaluator';
import { EvidenceFingerprintVO } from './domain/evidence-fingerprint.vo';
import { eventBus } from '@/platform/host/event-bus';

export class AuditComplianceService implements IClinicalAuditContract {
  private static readonly SCHEMA_VERSION = '1.0.0';

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Records a clinical action in the append-only audit ledger and issues an immutable evidence package.
   */
  public async recordAuditEntry(
    input: IRecordAuditInput
  ): Promise<EngineResponse<IClinicalAuditRecord>> {
    try {
      const auditId = crypto.randomUUID();

      // Evaluate compliance & evidence integrity
      const evalRes = ComplianceEvaluator.evaluateAction({
        actionType: input.actionType,
        performerRole: input.performerRole,
        h8DecisionId: input.h8DecisionId,
        h9SnapshotId: input.h9SnapshotId,
        h10RuleChecksum: input.h10RuleChecksum,
        overrideDetails: input.overrideDetails
      });

      // 1. Insert row into hc_clinical_audit_ledger
      const { error: insAuditErr } = await this.supabase
        .from('hc_clinical_audit_ledger')
        .insert({
          id: auditId,
          tenant_id: input.tenantId,
          encounter_id: input.encounterId,
          patient_id: input.patientId,
          action_type: input.actionType,
          performer_id: input.performerId,
          performer_role: input.performerRole,
          h8_decision_id: input.h8DecisionId || null,
          h9_snapshot_id: input.h9SnapshotId || null,
          h10_rule_code: input.h10RuleCode || null,
          h10_rule_version: input.h10RuleVersion || null,
          h10_rule_checksum: input.h10RuleChecksum || null,
          compliance_status: evalRes.complianceStatus,
          evidence_integrity: evalRes.evidenceIntegrity,
          metadata: input.metadata || {}
        });

      if (insAuditErr) {
        return {
          success: false,
          error: {
            code: 'AUDIT_RECORD_FAILED',
            message: `Failed to insert audit ledger entry: ${insAuditErr.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      // 2. Insert row into hc_compliance_exceptions if override occurred
      if (input.overrideDetails) {
        const authorized = evalRes.complianceStatus === 'EXCEPTION';
        const { error: insExErr } = await this.supabase
          .from('hc_compliance_exceptions')
          .insert({
            id: crypto.randomUUID(),
            tenant_id: input.tenantId,
            audit_id: auditId,
            encounter_id: input.encounterId,
            enforcement_level: input.overrideDetails.enforcementLevel,
            override_reason: input.overrideDetails.overrideReason,
            overridden_by: input.overrideDetails.overriddenBy,
            overrider_role: input.overrideDetails.overriderRole,
            authorized
          });

        if (insExErr) {
          return {
            success: false,
            error: {
              code: 'EXCEPTION_RECORD_FAILED',
              message: `Failed to insert compliance exception entry: ${insExErr.message}`,
              timestamp: new Date().toISOString()
            }
          };
        }
      }

      const auditRecord: IClinicalAuditRecord = {
        id: auditId,
        tenantId: input.tenantId,
        encounterId: input.encounterId,
        patientId: input.patientId,
        actionType: input.actionType,
        performerId: input.performerId,
        performerRole: input.performerRole,
        h8DecisionId: input.h8DecisionId,
        h9SnapshotId: input.h9SnapshotId,
        h10RuleCode: input.h10RuleCode,
        h10RuleVersion: input.h10RuleVersion,
        h10RuleChecksum: input.h10RuleChecksum,
        complianceStatus: evalRes.complianceStatus,
        evidenceIntegrity: evalRes.evidenceIntegrity,
        metadata: input.metadata,
        createdAt: new Date().toISOString()
      };

      // 3. Automatically issue Evidence Package
      await this.issueEvidencePackage(input.tenantId, auditId);

      // Event-After-Persistence
      await eventBus.publish({
        eventType: 'hos.audit.recorded.v1',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: input.tenantId,
        aggregateId: auditId,
        aggregateType: 'ClinicalAuditLedger',
        payload: {
          encounterId: input.encounterId,
          actionType: input.actionType,
          complianceStatus: evalRes.complianceStatus,
          evidenceIntegrity: evalRes.evidenceIntegrity
        }
      });

      return {
        success: true,
        data: auditRecord
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'AUDIT_RECORD_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Evaluates compliance and evidence chain integrity for a recorded audit entry.
   */
  public async evaluateActionCompliance(
    tenantId: string,
    auditId: string
  ): Promise<EngineResponse<IComplianceEvaluationResult>> {
    try {
      const audit = await this.getAuditRecordById(tenantId, auditId);
      if (!audit) {
        return {
          success: false,
          error: {
            code: 'AUDIT_NOT_FOUND',
            message: `Audit record ${auditId} not found`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const exception = await this.getExceptionRecordByAuditId(tenantId, auditId);
      const evalRes = ComplianceEvaluator.evaluateAction({
        actionType: audit.actionType,
        performerRole: audit.performerRole,
        h8DecisionId: audit.h8DecisionId,
        h9SnapshotId: audit.h9SnapshotId,
        h10RuleChecksum: audit.h10RuleChecksum,
        overrideDetails: exception
          ? {
              enforcementLevel: exception.enforcementLevel,
              overrideReason: exception.overrideReason,
              overriddenBy: exception.overriddenBy,
              overriderRole: exception.overriderRole
            }
          : undefined
      });

      return {
        success: true,
        data: evalRes
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'COMPLIANCE_EVALUATION_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Issues and persists an immutable Clinical Evidence Package.
   */
  public async issueEvidencePackage(
    tenantId: string,
    auditId: string
  ): Promise<EngineResponse<IClinicalEvidencePackage>> {
    try {
      // Check if package already issued
      const existingPkg = await this.getEvidencePackageByAuditId(tenantId, auditId);
      if (existingPkg) {
        return {
          success: true,
          data: existingPkg
        };
      }

      const audit = await this.getAuditRecordById(tenantId, auditId);
      if (!audit) {
        return {
          success: false,
          error: {
            code: 'AUDIT_NOT_FOUND',
            message: `Audit record ${auditId} not found`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const exception = await this.getExceptionRecordByAuditId(tenantId, auditId);

      const timestamp = audit.createdAt;
      const overrideDetails = exception
        ? {
            enforcementLevel: exception.enforcementLevel,
            overrideReason: exception.overrideReason,
            overriddenBy: exception.overriddenBy,
            overriderRole: exception.overriderRole,
            authorized: exception.authorized
          }
        : undefined;

      const fingerprint = EvidenceFingerprintVO.generateFingerprint({
        schemaVersion: AuditComplianceService.SCHEMA_VERSION,
        tenantId,
        encounterId: audit.encounterId,
        actionType: audit.actionType,
        timestamp,
        performerId: audit.performerId,
        performerRole: audit.performerRole,
        h8DecisionId: audit.h8DecisionId,
        h9SnapshotId: audit.h9SnapshotId,
        h10RuleChecksum: audit.h10RuleChecksum,
        complianceStatus: audit.complianceStatus,
        evidenceIntegrity: audit.evidenceIntegrity,
        overrideDetails
      });

      const pkgId = crypto.randomUUID();
      const sourceReferences = {
        encounterId: audit.encounterId,
        h8DecisionId: audit.h8DecisionId,
        h9SnapshotId: audit.h9SnapshotId,
        h10RuleChecksum: audit.h10RuleChecksum
      };

      const canonicalPayload = {
        actionType: audit.actionType,
        timestamp,
        performer: { id: audit.performerId, role: audit.performerRole },
        patientStateAtT: audit.metadata?.patientStateAtT as Record<string, unknown> | undefined,
        cdsDecisionAtT: audit.metadata?.cdsDecisionAtT as Record<string, unknown> | undefined,
        governedRuleAtT: audit.metadata?.governedRuleAtT as Record<string, unknown> | undefined,
        overrideDetails,
        complianceStatus: audit.complianceStatus,
        evidenceIntegrity: audit.evidenceIntegrity
      };

      const { error: insPkgErr } = await this.supabase
        .from('hc_clinical_evidence_packages')
        .insert({
          id: pkgId,
          tenant_id: tenantId,
          audit_id: auditId,
          schema_version: AuditComplianceService.SCHEMA_VERSION,
          source_references: sourceReferences,
          canonical_payload: canonicalPayload,
          fingerprint
        });

      if (insPkgErr) {
        return {
          success: false,
          error: {
            code: 'EVIDENCE_PACKAGE_ISSUE_FAILED',
            message: `Failed to insert evidence package: ${insPkgErr.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const evidencePackage: IClinicalEvidencePackage = {
        id: pkgId,
        tenantId,
        auditId,
        schemaVersion: AuditComplianceService.SCHEMA_VERSION,
        sourceReferences,
        canonicalPayload,
        fingerprint,
        createdAt: new Date().toISOString()
      };

      // Event-After-Persistence
      await eventBus.publish({
        eventType: 'hos.evidence.issued.v1',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId,
        aggregateId: pkgId,
        aggregateType: 'ClinicalEvidencePackage',
        payload: {
          auditId,
          fingerprint,
          schemaVersion: AuditComplianceService.SCHEMA_VERSION
        }
      });

      return {
        success: true,
        data: evidencePackage
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'EVIDENCE_PACKAGE_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Reconstructs full point-in-time evidence chain for an audit investigation.
   */
  public async investigateClinicalAction(
    tenantId: string,
    auditId: string
  ): Promise<
    EngineResponse<{
      audit: IClinicalAuditRecord;
      evidencePackage: IClinicalEvidencePackage | null;
      exceptionRecord: IComplianceExceptionRecord | null;
      evaluation: IComplianceEvaluationResult;
    }>
  > {
    try {
      const audit = await this.getAuditRecordById(tenantId, auditId);
      if (!audit) {
        return {
          success: false,
          error: {
            code: 'AUDIT_NOT_FOUND',
            message: `Audit record ${auditId} not found`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const evidencePackage = await this.getEvidencePackageByAuditId(tenantId, auditId);
      const exceptionRecord = await this.getExceptionRecordByAuditId(tenantId, auditId);
      const evalRes = await this.evaluateActionCompliance(tenantId, auditId);

      return {
        success: true,
        data: {
          audit,
          evidencePackage,
          exceptionRecord,
          evaluation: evalRes.data!
        }
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'INVESTIGATION_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Aggregates tenant compliance report metrics across a given time window.
   */
  public async getComplianceReportSummary(
    tenantId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<EngineResponse<IComplianceReportSummary>> {
    try {
      const { data, error } = await this.supabase.rpc('get_compliance_summary', {
        p_tenant_id: tenantId,
        p_from: fromDate || null,
        p_to: toDate || null
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'COMPLIANCE_SUMMARY_FAILED',
            message: `Failed to compute compliance summary: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const row = (data && data[0]) || {
        total_actions: 0,
        compliant_count: 0,
        non_compliant_count: 0,
        exception_count: 0,
        requires_review_count: 0,
        complete_integrity_count: 0,
        broken_integrity_count: 0,
        override_rate_percent: 0
      };

      const summary: IComplianceReportSummary = {
        tenantId,
        totalAuditedActions: Number(row.total_actions),
        compliantCount: Number(row.compliant_count),
        nonCompliantCount: Number(row.non_compliant_count),
        exceptionCount: Number(row.exception_count),
        requiresReviewCount: Number(row.requires_review_count),
        completeIntegrityCount: Number(row.complete_integrity_count),
        brokenIntegrityCount: Number(row.broken_integrity_count),
        overrideRatePercent: Number(row.override_rate_percent),
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        data: summary
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'COMPLIANCE_SUMMARY_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private async getAuditRecordById(
    tenantId: string,
    auditId: string
  ): Promise<IClinicalAuditRecord | null> {
    const { data, error } = await this.supabase
      .from('hc_clinical_audit_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', auditId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      encounterId: data.encounter_id,
      patientId: data.patient_id,
      actionType: data.action_type,
      performerId: data.performer_id,
      performerRole: data.performer_role,
      h8DecisionId: data.h8_decision_id || undefined,
      h9SnapshotId: data.h9_snapshot_id || undefined,
      h10RuleCode: data.h10_rule_code || undefined,
      h10RuleVersion: data.h10_rule_version || undefined,
      h10RuleChecksum: data.h10_rule_checksum || undefined,
      complianceStatus: data.compliance_status,
      evidenceIntegrity: data.evidence_integrity,
      metadata: data.metadata || undefined,
      createdAt: data.created_at
    };
  }

  private async getEvidencePackageByAuditId(
    tenantId: string,
    auditId: string
  ): Promise<IClinicalEvidencePackage | null> {
    const { data, error } = await this.supabase
      .from('hc_clinical_evidence_packages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('audit_id', auditId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      auditId: data.audit_id,
      schemaVersion: data.schema_version,
      sourceReferences: data.source_references,
      canonicalPayload: data.canonical_payload,
      fingerprint: data.fingerprint,
      createdAt: data.created_at
    };
  }

  private async getExceptionRecordByAuditId(
    tenantId: string,
    auditId: string
  ): Promise<IComplianceExceptionRecord | null> {
    const { data, error } = await this.supabase
      .from('hc_compliance_exceptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('audit_id', auditId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      auditId: data.audit_id,
      encounterId: data.encounter_id,
      enforcementLevel: data.enforcement_level,
      overrideReason: data.override_reason,
      overriddenBy: data.overridden_by,
      overriderRole: data.overrider_role,
      authorized: data.authorized,
      createdAt: data.created_at
    };
  }
}
