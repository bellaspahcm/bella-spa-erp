/**
 * Clinical Governance & Rule Engine Service — Phase H10
 *
 * Implements IRuleGovernanceContract for rule artifact lifecycles,
 * authorization sign-offs, canonical checksum verification, and deterministic DSL evaluation.
 *
 * Constitution:
 *   - Law 1: Encounter as aggregate root
 *   - Law 11: Zero `any` types (Law 11 enforced)
 *   - H10-01: Governance Context Isolation (Zero direct DB queries on H8/H9 tables)
 *   - Event-After-Persistence: Domain events published strictly after DB writes
 *
 * @module platform/healthcare/engines/rule-engine/rule-engine.service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IRuleGovernanceContract,
  ICreateRuleInput,
  IApproveRuleInput,
  IGovernedRuleRecord,
  IRuleSetEvaluationResult,
  RuleEnforcement,
  RuleSeverity
} from '../../contracts/rule-governance.contract';
import type { EngineResponse } from '../../shared-kernel/types';
import { GovernedRuleEntity } from './domain/governed-rule.entity';
import { RuleDslEvaluator } from './domain/rule-dsl-evaluator';
import { eventBus } from '@/platform/host/event-bus';

export class RuleEngineService implements IRuleGovernanceContract {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Creates a new DRAFT clinical rule artifact.
   */
  public async createDraftRule(
    input: ICreateRuleInput
  ): Promise<EngineResponse<IGovernedRuleRecord>> {
    try {
      const ruleId = crypto.randomUUID();
      const entity = new GovernedRuleEntity({
        id: ruleId,
        tenantId: input.tenantId,
        ruleCode: input.ruleCode,
        ruleVersion: input.ruleVersion,
        jurisdictionCode: input.jurisdictionCode || 'LOCAL',
        status: 'DRAFT',
        severity: input.severity,
        enforcement: input.enforcement,
        conditionsDsl: input.conditionsDsl,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        authorId: input.authorId
      });

      const record = entity.toRecord();

      const { error: insErr } = await this.supabase
        .from('hc_governed_clinical_rules')
        .insert({
          id: record.id,
          tenant_id: record.tenantId,
          rule_code: record.ruleCode,
          rule_version: record.ruleVersion,
          jurisdiction_code: record.jurisdictionCode,
          status: record.status,
          severity: record.severity,
          enforcement: record.enforcement,
          conditions_dsl: record.conditionsDsl,
          rule_checksum: record.ruleChecksum,
          effective_from: record.effectiveFrom,
          effective_to: record.effectiveTo,
          author_id: record.authorId
        });

      if (insErr) {
        return {
          success: false,
          error: {
            code: 'RULE_CREATION_FAILED',
            message: `Failed to insert rule artifact: ${insErr.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Log Audit Trail
      await this.logAuditRecord({
        tenantId: record.tenantId,
        ruleId: record.id,
        action: 'CREATE_DRAFT',
        performedBy: record.authorId,
        role: 'author',
        previousStatus: null,
        newStatus: 'DRAFT',
        changeReason: 'Initial rule draft creation'
      });

      // Event-After-Persistence
      await eventBus.publish({
        eventType: 'hos.rule.draft_created.v1',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: record.tenantId,
        aggregateId: record.id,
        aggregateType: 'GovernedRule',
        payload: {
          ruleCode: record.ruleCode,
          ruleVersion: record.ruleVersion,
          status: record.status
        }
      });

      return {
        success: true,
        data: record
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'RULE_CREATION_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Submits a DRAFT rule for review.
   */
  public async submitRuleForReview(
    tenantId: string,
    ruleId: string,
    reviewerId: string
  ): Promise<EngineResponse<IGovernedRuleRecord>> {
    try {
      const existing = await this.getRuleById(tenantId, ruleId);
      if (!existing) {
        return {
          success: false,
          error: {
            code: 'RULE_NOT_FOUND',
            message: `Rule ${ruleId} not found`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const entity = new GovernedRuleEntity(existing);
      entity.submitForReview(reviewerId);
      const record = entity.toRecord();

      const { error: updErr } = await this.supabase
        .from('hc_governed_clinical_rules')
        .update({
          status: record.status,
          reviewer_id: record.reviewerId
        })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId);

      if (updErr) {
        return {
          success: false,
          error: {
            code: 'RULE_UPDATE_FAILED',
            message: `Failed to submit rule for review: ${updErr.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      await this.logAuditRecord({
        tenantId,
        ruleId,
        action: 'SUBMIT_FOR_REVIEW',
        performedBy: reviewerId,
        role: 'reviewer',
        previousStatus: existing.status,
        newStatus: 'PENDING_REVIEW',
        changeReason: 'Submitted for clinical review'
      });

      return {
        success: true,
        data: record
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'RULE_SUBMIT_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Approves and activates a clinical rule artifact, enforcing the role authorization matrix.
   */
  public async approveAndActivateRule(
    input: IApproveRuleInput
  ): Promise<EngineResponse<IGovernedRuleRecord>> {
    try {
      const existing = await this.getRuleById(input.tenantId, input.ruleId);
      if (!existing) {
        return {
          success: false,
          error: {
            code: 'RULE_NOT_FOUND',
            message: `Rule ${input.ruleId} not found`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const entity = new GovernedRuleEntity(existing);
      // Domain entity enforces Authorization Matrix (Lock 3)
      entity.approveAndActivate(input.approverId, input.approverRole, input.approvalEvidence);
      const record = entity.toRecord();

      // Check if there is an existing ACTIVE version for same ruleCode & jurisdiction and supersede it
      const { data: activeRules } = await this.supabase
        .from('hc_governed_clinical_rules')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('rule_code', record.ruleCode)
        .eq('jurisdiction_code', record.jurisdictionCode)
        .eq('status', 'ACTIVE')
        .neq('id', record.id);

      if (activeRules && activeRules.length > 0) {
        for (const oldRule of activeRules) {
          await this.supabase
            .from('hc_governed_clinical_rules')
            .update({
              status: 'SUPERSEDED',
              effective_to: record.effectiveFrom
            })
            .eq('id', oldRule.id);

          await this.logAuditRecord({
            tenantId: input.tenantId,
            ruleId: oldRule.id,
            action: 'SUPERSEDE',
            performedBy: input.approverId,
            role: input.approverRole,
            previousStatus: 'ACTIVE',
            newStatus: 'SUPERSEDED',
            changeReason: `Superseded by new version ${record.ruleVersion}`
          });
        }
      }

      const { error: updErr } = await this.supabase
        .from('hc_governed_clinical_rules')
        .update({
          status: record.status,
          approver_id: record.approverId,
          approver_role: record.approverRole,
          approval_evidence: record.approvalEvidence
        })
        .eq('id', input.ruleId)
        .eq('tenant_id', input.tenantId);

      if (updErr) {
        return {
          success: false,
          error: {
            code: 'RULE_ACTIVATION_FAILED',
            message: `Failed to activate rule: ${updErr.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      await this.logAuditRecord({
        tenantId: input.tenantId,
        ruleId: input.ruleId,
        action: 'APPROVE_AND_ACTIVATE',
        performedBy: input.approverId,
        role: input.approverRole,
        previousStatus: existing.status,
        newStatus: 'ACTIVE',
        changeReason: input.changeReason
      });

      // Event-After-Persistence
      await eventBus.publish({
        eventType: 'hos.rule.activated.v1',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: record.tenantId,
        aggregateId: record.id,
        aggregateType: 'GovernedRule',
        payload: {
          ruleCode: record.ruleCode,
          ruleVersion: record.ruleVersion,
          approverRole: record.approverRole,
          ruleChecksum: record.ruleChecksum
        }
      });

      return {
        success: true,
        data: record
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'RULE_ACTIVATION_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Resolves active rules at historical timestamp T for a tenant and jurisdiction.
   */
  public async getActiveRulesAtTime(
    tenantId: string,
    targetTime: string,
    jurisdiction: string = 'LOCAL'
  ): Promise<EngineResponse<IGovernedRuleRecord[]>> {
    try {
      const { data, error } = await this.supabase.rpc('resolve_active_rules_at', {
        p_tenant_id: tenantId,
        p_target_time: targetTime,
        p_jurisdiction: jurisdiction
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'ACTIVE_RULES_RESOLUTION_FAILED',
            message: `Failed to resolve active rules: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const rules: IGovernedRuleRecord[] = (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        tenantId: String(r.tenant_id),
        ruleCode: String(r.rule_code),
        ruleVersion: String(r.rule_version),
        jurisdictionCode: String(r.jurisdiction_code),
        status: String(r.status) as IGovernedRuleRecord['status'],
        severity: String(r.severity) as RuleSeverity,
        enforcement: String(r.enforcement) as RuleEnforcement,
        conditionsDsl: (r.conditions_dsl as IGovernedRuleRecord['conditionsDsl']) || {},
        ruleChecksum: String(r.rule_checksum),
        effectiveFrom: String(r.effective_from),
        effectiveTo: r.effective_to ? String(r.effective_to) : undefined,
        authorId: String(r.author_id),
        approverId: r.approver_id ? String(r.approver_id) : undefined,
        approverRole: r.approver_role ? String(r.approver_role) : undefined,
        createdAt: new Date().toISOString()
      }));

      return {
        success: true,
        data: rules
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'ACTIVE_RULES_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Evaluates a set of governed rules against a context object using the deterministic DSL evaluator.
   */
  public async evaluateRuleSet(
    rules: IGovernedRuleRecord[],
    context: Record<string, unknown>
  ): Promise<EngineResponse<IRuleSetEvaluationResult>> {
    try {
      const evaluations = rules.map((r) => RuleDslEvaluator.evaluateRule(r, context));
      const matched = evaluations.filter((e) => e.matched);

      let highestEnforcement: RuleEnforcement | 'NONE' = 'NONE';
      let highestSeverity: RuleSeverity | 'NONE' = 'NONE';

      const enforcementPriority: Record<RuleEnforcement, number> = {
        ABSOLUTE_BLOCK: 4,
        BLOCK: 3,
        ACKNOWLEDGE: 2,
        INFORMATIONAL: 1
      };

      const severityPriority: Record<RuleSeverity, number> = {
        CRITICAL: 4,
        WARNING: 3,
        INFO: 2,
        LOW: 1
      };

      matched.forEach((e) => {
        if (
          highestEnforcement === 'NONE' ||
          enforcementPriority[e.enforcement] > enforcementPriority[highestEnforcement]
        ) {
          highestEnforcement = e.enforcement;
        }
        if (
          highestSeverity === 'NONE' ||
          severityPriority[e.severity] > severityPriority[highestSeverity]
        ) {
          highestSeverity = e.severity;
        }
      });

      return {
        success: true,
        data: {
          evaluatedCount: rules.length,
          matchedCount: matched.length,
          highestEnforcement,
          highestSeverity,
          evaluations,
          evaluatorVersion: '1.0.0'
        }
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'RULE_EVALUATION_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private async getRuleById(
    tenantId: string,
    ruleId: string
  ): Promise<GovernedRuleParams | null> {
    const { data, error } = await this.supabase
      .from('hc_governed_clinical_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', ruleId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      ruleCode: data.rule_code,
      ruleVersion: data.rule_version,
      jurisdictionCode: data.jurisdiction_code,
      status: data.status,
      severity: data.severity,
      enforcement: data.enforcement,
      conditionsDsl: data.conditions_dsl,
      ruleChecksum: data.rule_checksum,
      effectiveFrom: data.effective_from,
      effectiveTo: data.effective_to,
      authorId: data.author_id,
      reviewerId: data.reviewer_id,
      approverId: data.approver_id,
      approverRole: data.approver_role,
      approvalEvidence: data.approval_evidence,
      createdAt: data.created_at
    };
  }

  private async logAuditRecord(params: {
    tenantId: string;
    ruleId: string;
    action: string;
    performedBy: string;
    role: string;
    previousStatus: string | null;
    newStatus: string;
    changeReason: string;
  }): Promise<void> {
    await this.supabase.from('hc_rule_governance_audit').insert({
      id: crypto.randomUUID(),
      tenant_id: params.tenantId,
      rule_id: params.ruleId,
      action: params.action,
      performed_by: params.performedBy,
      role: params.role,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      change_reason: params.changeReason
    });
  }
}
