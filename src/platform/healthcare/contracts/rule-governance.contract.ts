/**
 * Clinical Governance & Rule Engine Contract — Phase H10
 *
 * Defines the public API contract for Clinical Rule Governance, Lifecycles,
 * Authorization Sign-offs, Canonical Artifact Checksums, and Deterministic DSL Evaluation.
 *
 * Constitution:
 *   - Law 1: Encounter as aggregate root
 *   - Law 11: Zero `any` types (Law 11 enforced)
 *   - H10-01: Governance Context Isolation (Zero direct DB queries on H8/H9 tables)
 *
 * @module platform/healthcare/contracts/rule-governance.contract
 */

import type { EngineResponse } from '../shared-kernel/types';

export type RuleStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'RETIRED';

export type RuleSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'LOW';

export type RuleEnforcement = 'ABSOLUTE_BLOCK' | 'BLOCK' | 'ACKNOWLEDGE' | 'INFORMATIONAL';

export type DslOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'BETWEEN';

export interface IRuleCondition {
  field: string;
  operator: DslOperator;
  value: string | number | boolean | Array<string | number>;
}

export interface IDslConditionsGroup {
  all?: IRuleCondition[];
  any?: IRuleCondition[];
}

export interface IGovernedRuleRecord {
  id: string;
  tenantId: string;
  ruleCode: string;
  ruleVersion: string;
  jurisdictionCode: string;
  status: RuleStatus;
  severity: RuleSeverity;
  enforcement: RuleEnforcement;
  conditionsDsl: IDslConditionsGroup;
  ruleChecksum: string;
  effectiveFrom: string;
  effectiveTo?: string;
  authorId: string;
  reviewerId?: string;
  approverId?: string;
  approverRole?: string;
  approvalEvidence?: Record<string, unknown>;
  createdAt: string;
}

export interface ICreateRuleInput {
  tenantId: string;
  ruleCode: string;
  ruleVersion: string;
  jurisdictionCode?: string;
  severity: RuleSeverity;
  enforcement: RuleEnforcement;
  conditionsDsl: IDslConditionsGroup;
  effectiveFrom: string;
  effectiveTo?: string;
  authorId: string;
}

export interface IApproveRuleInput {
  tenantId: string;
  ruleId: string;
  approverId: string;
  approverRole: string;
  changeReason: string;
  approvalEvidence?: Record<string, unknown>;
}

export interface IMatchedConditionDetail {
  field: string;
  operator: DslOperator;
  expectedValue: unknown;
  actualValue: unknown;
  passed: boolean;
}

export interface IEvaluatedRuleDetail {
  ruleId: string;
  ruleCode: string;
  ruleVersion: string;
  ruleChecksum: string;
  severity: RuleSeverity;
  enforcement: RuleEnforcement;
  matched: boolean;
  matchedConditions: IMatchedConditionDetail[];
}

export interface IRuleSetEvaluationResult {
  evaluatedCount: number;
  matchedCount: number;
  highestEnforcement: RuleEnforcement | 'NONE';
  highestSeverity: RuleSeverity | 'NONE';
  evaluations: IEvaluatedRuleDetail[];
  evaluatorVersion: string;
}

export interface IRuleGovernanceContract {
  /**
   * Creates a new DRAFT clinical rule artifact.
   */
  createDraftRule(input: ICreateRuleInput): Promise<EngineResponse<IGovernedRuleRecord>>;

  /**
   * Submits a DRAFT rule for review.
   */
  submitRuleForReview(
    tenantId: string,
    ruleId: string,
    reviewerId: string
  ): Promise<EngineResponse<IGovernedRuleRecord>>;

  /**
   * Approves and activates a clinical rule artifact, enforcing the role authorization matrix.
   */
  approveAndActivateRule(
    input: IApproveRuleInput
  ): Promise<EngineResponse<IGovernedRuleRecord>>;

  /**
   * Resolves active rules at historical timestamp T for a tenant and jurisdiction.
   */
  getActiveRulesAtTime(
    tenantId: string,
    targetTime: string,
    jurisdiction?: string
  ): Promise<EngineResponse<IGovernedRuleRecord[]>>;

  /**
   * Evaluates a set of governed rules against a context object using the deterministic DSL evaluator.
   */
  evaluateRuleSet(
    rules: IGovernedRuleRecord[],
    context: Record<string, unknown>
  ): Promise<EngineResponse<IRuleSetEvaluationResult>>;
}
