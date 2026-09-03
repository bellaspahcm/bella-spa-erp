/**
 * Rule Engine Service — D3: Governed Business Rule Engine
 * Platform-Level: src/platform/host/rule-engine/
 *
 * Constitution: Law 3 (Platform Host), Law 5 (Event-First), Law 11 (Zero any)
 *
 * Governance Hierarchy (this engine is at layer 4 — CANNOT override layers 1-3):
 *   1. Human Governance (ARB approval)
 *   2. Frozen Safety Policy (Constitution)
 *   3. Clinical Safety Engine (CDS/CPOE — Phase C)
 *   4. Platform Rule Engine (D3)  ← this service
 *   5. Business Workflow
 *
 * Rule Lifecycle: DRAFT → REVIEW → APPROVED → ACTIVE → SUSPENDED → RETIRED
 * ACTIVE rules are immutable — create new version for changes (enforced by DB trigger).
 * ABSOLUTE severity requires approved_by + approved_at (ARB approval).
 *
 * Scope: Business Rules ONLY (see allowed domains in RuleDomain type).
 * ❌ NEVER evaluate clinical safety rules here (drug interactions, allergy blocks).
 *    Those belong in ClinicalSafetyEngine (Phase C hc_clinical_protocols).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Json } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent } from '@/platform/host/event-bus/types';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type RuleStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
export type RuleSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'ABSOLUTE';
export type RuleActionType = 'NOTIFY' | 'WARN' | 'ESCALATE' | 'EXECUTE_WORKFLOW' | 'BLOCK';
export type RuleDomain =
  | 'spa.booking' | 'spa.commission' | 'spa.notification'
  | 'finance.commission' | 'finance.payment'
  | 'hr.payroll'
  | 'notification.routing'
  | 'crm.sla'
  | 'bella_auto.sales'
  | 'babycare.booking'
  | 'education.enrollment'
  | 'platform.system';

export type RuleEvalOutcome =
  | 'TRIGGERED' | 'NOT_TRIGGERED'
  | 'SKIPPED_SUSPENDED' | 'SKIPPED_EXPIRED' | 'ERROR';

export type RuleConditionOperator = 'AND' | 'OR';
export type RuleFieldOperator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'NOT_IN' | 'CONTAINS';

export interface RuleConditionLeaf {
  field: string;
  op: RuleFieldOperator;
  value: string | number | boolean | string[] | number[];
}

export interface RuleConditions {
  operator: RuleConditionOperator;
  rules: RuleConditionLeaf[];
}

export interface CreateRuleParams {
  ruleKey: string;
  version: string;
  domain: RuleDomain;
  name: string;
  description?: string;
  severity?: RuleSeverity;
  conditions: RuleConditions;
  actionType?: RuleActionType;
  actionParams?: Record<string, unknown>;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface BusinessRule {
  id: string;
  tenantId: string;
  ruleKey: string;
  version: string;
  domain: RuleDomain;
  name: string;
  description?: string;
  status: RuleStatus;
  severity: RuleSeverity;
  conditions: RuleConditions;
  actionType: RuleActionType;
  actionParams: Record<string, unknown>;
  approvedBy?: string;
  approvedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
}

export interface EvaluateRuleParams {
  ruleId: string;
  contextType: string;                   // e.g. 'spa_booking', 'auto_customer_journey'
  contextId?: string;
  inputData: Record<string, unknown>;    // data to evaluate conditions against
  evaluatedBy?: string;
  correlationId?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleKey: string;
  ruleVersion: string;
  outcome: RuleEvalOutcome;
  conditionsMet: boolean;
  actionTaken?: string;
  actionResult?: Record<string, unknown>;
  evaluatedAt: string;
}

export interface ApproveRuleParams {
  ruleId: string;
  approvedBy: string;
  approvedAt?: string;
}

// ─────────────────────────────────────────────────────────────────
// Condition Evaluator — pure function, no side effects
// ─────────────────────────────────────────────────────────────────
function evaluateConditions(
  conditions: RuleConditions,
  input: Record<string, unknown>
): boolean {
  const results = conditions.rules.map(leaf => evaluateLeaf(leaf, input));
  return conditions.operator === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

function evaluateLeaf(
  leaf: RuleConditionLeaf,
  input: Record<string, unknown>
): boolean {
  // Support dot-notation field access: 'customer.tier'
  const value = leaf.field.split('.').reduce<unknown>((obj, key) => {
    if (obj !== null && obj !== undefined && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, input);

  const target = leaf.value;

  switch (leaf.op) {
    case 'EQ':       return value === target;
    case 'NEQ':      return value !== target;
    case 'GT':       return typeof value === 'number' && typeof target === 'number' && value > target;
    case 'GTE':      return typeof value === 'number' && typeof target === 'number' && value >= target;
    case 'LT':       return typeof value === 'number' && typeof target === 'number' && value < target;
    case 'LTE':      return typeof value === 'number' && typeof target === 'number' && value <= target;
    case 'IN':       return Array.isArray(target) && (target as (string | number)[]).includes(value as string | number);
    case 'NOT_IN':   return Array.isArray(target) && !(target as (string | number)[]).includes(value as string | number);
    case 'CONTAINS': return typeof value === 'string' && typeof target === 'string' && value.includes(target);
    default:         return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// RuleEngineService
// ─────────────────────────────────────────────────────────────────
export class RuleEngineService {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly tenantId: string
  ) {}

  // ────────────────────────────────────────────────
  // 1. createRule — starts in DRAFT status
  // ────────────────────────────────────────────────
  async createRule(params: CreateRuleParams): Promise<BusinessRule> {
    const { data, error } = await this.supabase
      .from('platform_business_rules')
      .insert({
        tenant_id: this.tenantId,
        rule_key: params.ruleKey,
        version: params.version,
        domain: params.domain,
        name: params.name,
        description: params.description ?? null,
        status: 'DRAFT',
        severity: params.severity ?? 'LOW',
        conditions: params.conditions as unknown as Database['public']['Tables']['platform_business_rules']['Insert']['conditions'],
        action_type: params.actionType ?? 'NOTIFY',
        action_params: (params.actionParams ?? {}) as Json,
        effective_from: params.effectiveFrom ?? null,
        effective_to: params.effectiveTo ?? null,
        created_by: params.createdBy ?? null,
        metadata: (params.metadata ?? {}) as Json,
      })
      .select()
      .single();

    if (error) throw new Error(`createRule failed: ${error.message}`);
    if (!data) throw new Error('createRule: no data returned');

    await this.publishEvent('platform.rule.created.v1', data.id, {
      ruleKey: params.ruleKey,
      version: params.version,
      domain: params.domain,
    });

    return this.mapRule(data);
  }

  // ────────────────────────────────────────────────
  // 2. approveRule — DRAFT/REVIEW → APPROVED
  //    Required before activation.
  //    ABSOLUTE severity enforcement: this sets the approved_by field.
  // ────────────────────────────────────────────────
  async approveRule(params: ApproveRuleParams): Promise<void> {
    await this.assertRuleStatus(params.ruleId, ['DRAFT', 'REVIEW']);

    const { error } = await this.supabase
      .from('platform_business_rules')
      .update({
        status: 'APPROVED',
        approved_by: params.approvedBy,
        approved_at: params.approvedAt ?? new Date().toISOString(),
      })
      .eq('id', params.ruleId)
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`approveRule failed: ${error.message}`);

    await this.publishEvent('platform.rule.approved.v1', params.ruleId, {
      approvedBy: params.approvedBy,
    });
  }

  // ────────────────────────────────────────────────
  // 3. activateRule — APPROVED → ACTIVE
  //    Automatically retires previous ACTIVE version for same rule_key.
  // ────────────────────────────────────────────────
  async activateRule(ruleId: string): Promise<void> {
    await this.assertRuleStatus(ruleId, ['APPROVED']);

    const { data: rule, error: fetchError } = await this.supabase
      .from('platform_business_rules')
      .select('rule_key')
      .eq('id', ruleId)
      .eq('tenant_id', this.tenantId)
      .single();

    if (fetchError || !rule) throw new Error(`activateRule: rule not found: ${ruleId}`);

    // Retire previous active version for same rule_key
    await this.supabase
      .from('platform_business_rules')
      .update({ status: 'RETIRED' })
      .eq('tenant_id', this.tenantId)
      .eq('rule_key', rule.rule_key)
      .eq('status', 'ACTIVE');

    const { error } = await this.supabase
      .from('platform_business_rules')
      .update({ status: 'ACTIVE' })
      .eq('id', ruleId)
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`activateRule failed: ${error.message}`);

    await this.publishEvent('platform.rule.activated.v1', ruleId, {
      ruleKey: rule.rule_key,
    });
  }

  // ────────────────────────────────────────────────
  // 4. suspendRule — ACTIVE → SUSPENDED
  // ────────────────────────────────────────────────
  async suspendRule(ruleId: string, reason: string): Promise<void> {
    await this.assertRuleStatus(ruleId, ['ACTIVE']);

    const { error } = await this.supabase
      .from('platform_business_rules')
      .update({
        status: 'SUSPENDED',
        metadata: { suspendReason: reason, suspendedAt: new Date().toISOString() } as Json,
      })
      .eq('id', ruleId)
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`suspendRule failed: ${error.message}`);
    await this.publishEvent('platform.rule.suspended.v1', ruleId, { reason });
  }

  // ────────────────────────────────────────────────
  // 5. retireRule — any → RETIRED
  // ────────────────────────────────────────────────
  async retireRule(ruleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('platform_business_rules')
      .update({ status: 'RETIRED' })
      .eq('id', ruleId)
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`retireRule failed: ${error.message}`);
    await this.publishEvent('platform.rule.retired.v1', ruleId, {});
  }

  // ────────────────────────────────────────────────
  // 6. evaluateRule — evaluate ONE specific rule against input
  // ────────────────────────────────────────────────
  async evaluateRule(params: EvaluateRuleParams): Promise<RuleEvaluationResult> {
    const { data: rule, error: fetchError } = await this.supabase
      .from('platform_business_rules')
      .select('*')
      .eq('id', params.ruleId)
      .eq('tenant_id', this.tenantId)
      .single();

    if (fetchError || !rule) throw new Error(`evaluateRule: rule not found: ${params.ruleId}`);

    const now = new Date();

    // Lifecycle checks
    if (rule.status === 'SUSPENDED') {
      return this.logAndReturn(rule, params, 'SKIPPED_SUSPENDED', false);
    }
    if (rule.effective_to && new Date(rule.effective_to) < now) {
      return this.logAndReturn(rule, params, 'SKIPPED_EXPIRED', false);
    }
    if (rule.status !== 'ACTIVE') {
      return this.logAndReturn(rule, params, 'SKIPPED_SUSPENDED', false);
    }

    // Evaluate conditions
    const conditions = rule.conditions as unknown as RuleConditions;
    const conditionsMet = evaluateConditions(conditions, params.inputData);

    if (!conditionsMet) {
      return this.logAndReturn(rule, params, 'NOT_TRIGGERED', false);
    }

    // Action execution (extensible)
    const actionResult: Record<string, unknown> = {
      actionType: rule.action_type,
      actionParams: rule.action_params,
      executedAt: now.toISOString(),
    };

    const result = await this.logAndReturn(rule, params, 'TRIGGERED', true, rule.action_type, actionResult);
    await this.publishEvent('platform.rule.evaluated.v1', rule.id, {
      ruleKey: rule.rule_key,
      outcome: 'TRIGGERED',
      contextType: params.contextType,
      contextId: params.contextId,
    });

    return result;
  }

  // ────────────────────────────────────────────────
  // 7. evaluateAllActiveRules — batch evaluate all ACTIVE rules for a domain
  // ────────────────────────────────────────────────
  async evaluateAllActiveRules(
    domain: RuleDomain,
    contextType: string,
    inputData: Record<string, unknown>,
    contextId?: string,
    evaluatedBy?: string
  ): Promise<RuleEvaluationResult[]> {
    const { data: rules, error } = await this.supabase
      .from('platform_business_rules')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('domain', domain)
      .eq('status', 'ACTIVE');

    if (error) throw new Error(`evaluateAllActiveRules failed: ${error.message}`);
    if (!rules || rules.length === 0) return [];

    const results = await Promise.all(
      rules.map(r =>
        this.evaluateRule({
          ruleId: r.id,
          contextType,
          contextId,
          inputData,
          evaluatedBy,
        })
      )
    );

    return results;
  }

  // ────────────────────────────────────────────────
  // 8. getActiveRuleVersion — find current ACTIVE version for a rule_key
  // ────────────────────────────────────────────────
  async getActiveRuleVersion(ruleKey: string): Promise<BusinessRule | null> {
    const { data, error } = await this.supabase
      .from('platform_business_rules')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('rule_key', ruleKey)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error) throw new Error(`getActiveRuleVersion failed: ${error.message}`);
    if (!data) return null;
    return this.mapRule(data);
  }

  // ─────────── Private helpers ───────────────────

  private async assertRuleStatus(ruleId: string, allowed: RuleStatus[]): Promise<void> {
    const { data, error } = await this.supabase
      .from('platform_business_rules')
      .select('status')
      .eq('id', ruleId)
      .eq('tenant_id', this.tenantId)
      .single();

    if (error || !data) throw new Error(`Rule not found: ${ruleId}`);
    const current = data.status as RuleStatus;
    if (!allowed.includes(current)) {
      throw new Error(
        `Invalid rule transition: rule ${ruleId} is "${current}". Expected: [${allowed.join(', ')}]`
      );
    }
  }

  private async logAndReturn(
    rule: Database['public']['Tables']['platform_business_rules']['Row'],
    params: EvaluateRuleParams,
    outcome: RuleEvalOutcome,
    conditionsMet: boolean,
    actionTaken?: string,
    actionResult?: Record<string, unknown>
  ): Promise<RuleEvaluationResult> {
    await this.supabase
      .from('platform_rule_evaluation_log')
      .insert({
        tenant_id: this.tenantId,
        rule_id: rule.id,
        rule_key: rule.rule_key,
        rule_version: rule.version,
        context_type: params.contextType,
        context_id: params.contextId ?? null,
        input_data: params.inputData as Json,
        outcome,
        conditions_met: conditionsMet,
        action_taken: actionTaken ?? null,
        action_result: actionResult as Json,
        evaluated_by: params.evaluatedBy ?? null,
        correlation_id: params.correlationId ?? null,
      });

    return {
      ruleId: rule.id,
      ruleKey: rule.rule_key,
      ruleVersion: rule.version,
      outcome,
      conditionsMet,
      actionTaken,
      actionResult,
      evaluatedAt: new Date().toISOString(),
    };
  }

  private async publishEvent(
    eventType: Parameters<typeof eventBus.publish>[0]['eventType'],
    aggregateId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: DomainEvent<Record<string, unknown>> = {
      eventId: crypto.randomUUID(),
      eventType,
      eventVersion: '1.0.0',
      tenantId: this.tenantId,
      aggregateId,
      aggregateType: 'platform_business_rule',
      payload,
      occurredAt: new Date().toISOString(),
    };
    await eventBus.publish(event);
  }

  private mapRule(
    data: Database['public']['Tables']['platform_business_rules']['Row']
  ): BusinessRule {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      ruleKey: data.rule_key,
      version: data.version,
      domain: data.domain as RuleDomain,
      name: data.name,
      description: data.description ?? undefined,
      status: data.status as RuleStatus,
      severity: data.severity as RuleSeverity,
      conditions: data.conditions as unknown as RuleConditions,
      actionType: data.action_type as RuleActionType,
      actionParams: (data.action_params ?? {}) as Record<string, unknown>,
      approvedBy: data.approved_by ?? undefined,
      approvedAt: data.approved_at ?? undefined,
      effectiveFrom: data.effective_from ?? undefined,
      effectiveTo: data.effective_to ?? undefined,
      createdAt: data.created_at,
    };
  }
}
