/**
 * Governed Clinical Rule Domain Entity — Phase H10 Clinical Governance
 *
 * Encapsulates clinical rule artifact status lifecycle, approval sign-off metadata,
 * and canonical SHA-256 artifact checksum verification.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/rule-engine/domain/governed-rule.entity
 */

import { RuleChecksumVO } from './rule-checksum.vo';
import type {
  RuleStatus,
  RuleSeverity,
  RuleEnforcement,
  IDslConditionsGroup,
  IGovernedRuleRecord
} from '../../../contracts/rule-governance.contract';

export interface GovernedRuleParams {
  id: string;
  tenantId: string;
  ruleCode: string;
  ruleVersion: string;
  jurisdictionCode?: string;
  status: RuleStatus;
  severity: RuleSeverity;
  enforcement: RuleEnforcement;
  conditionsDsl: IDslConditionsGroup;
  ruleChecksum?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  authorId: string;
  reviewerId?: string;
  approverId?: string;
  approverRole?: string;
  approvalEvidence?: Record<string, unknown>;
  createdAt?: string;
}

export class GovernedRuleEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly ruleCode: string;
  public readonly ruleVersion: string;
  public readonly jurisdictionCode: string;
  public status: RuleStatus;
  public readonly severity: RuleSeverity;
  public readonly enforcement: RuleEnforcement;
  public readonly conditionsDsl: IDslConditionsGroup;
  public readonly ruleChecksum: string;
  public readonly effectiveFrom: string;
  public effectiveTo?: string;
  public readonly authorId: string;
  public reviewerId?: string;
  public approverId?: string;
  public approverRole?: string;
  public approvalEvidence?: Record<string, unknown>;
  public readonly createdAt: string;

  constructor(params: GovernedRuleParams) {
    if (!params.tenantId) throw new Error('Tenant ID is required for GovernedRuleEntity');
    if (!params.ruleCode) throw new Error('Rule Code is required for GovernedRuleEntity');
    if (!params.ruleVersion) throw new Error('Rule Version is required for GovernedRuleEntity');

    this.id = params.id;
    this.tenantId = params.tenantId;
    this.ruleCode = params.ruleCode.trim();
    this.ruleVersion = params.ruleVersion.trim();
    this.jurisdictionCode = (params.jurisdictionCode || 'LOCAL').trim();
    this.status = params.status;
    this.severity = params.severity;
    this.enforcement = params.enforcement;
    this.conditionsDsl = params.conditionsDsl;

    this.effectiveFrom = new Date(params.effectiveFrom).toISOString();
    this.effectiveTo = params.effectiveTo ? new Date(params.effectiveTo).toISOString() : undefined;

    this.authorId = params.authorId;
    this.reviewerId = params.reviewerId;
    this.approverId = params.approverId;
    this.approverRole = params.approverRole;
    this.approvalEvidence = params.approvalEvidence || {};
    this.createdAt = params.createdAt || new Date().toISOString();

    // Canonical Artifact Checksum (Lock 3)
    this.ruleChecksum =
      params.ruleChecksum ||
      RuleChecksumVO.generateCanonicalChecksum({
        ruleCode: this.ruleCode,
        ruleVersion: this.ruleVersion,
        jurisdictionCode: this.jurisdictionCode,
        severity: this.severity,
        enforcement: this.enforcement,
        conditionsDsl: this.conditionsDsl,
        effectiveFrom: this.effectiveFrom,
        effectiveTo: this.effectiveTo
      });
  }

  public submitForReview(reviewerId: string): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Only DRAFT rules can be submitted for review. Current status: ${this.status}`);
    }
    this.status = 'PENDING_REVIEW';
    this.reviewerId = reviewerId;
  }

  public approveAndActivate(approverId: string, approverRole: string, evidence?: Record<string, unknown>): void {
    if (this.status !== 'PENDING_REVIEW' && this.status !== 'DRAFT') {
      throw new Error(`Only DRAFT or PENDING_REVIEW rules can be approved. Current status: ${this.status}`);
    }

    // Role Authorization Matrix (Lock 3)
    if (this.enforcement === 'BLOCK' || this.enforcement === 'ABSOLUTE_BLOCK' || this.severity === 'CRITICAL') {
      if (!['chief_of_department', 'medical_director'].includes(approverRole)) {
        throw new Error(`Approval of ${this.enforcement} rules requires chief_of_department or medical_director role.`);
      }
    }

    this.status = 'ACTIVE';
    this.approverId = approverId;
    this.approverRole = approverRole;
    this.approvalEvidence = evidence || {};
  }

  public supersede(supersededToDate?: string): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Only ACTIVE rules can be superseded. Current status: ${this.status}`);
    }
    this.status = 'SUPERSEDED';
    this.effectiveTo = supersededToDate || new Date().toISOString();
  }

  public toRecord(): IGovernedRuleRecord {
    return {
      id: this.id,
      tenantId: this.tenantId,
      ruleCode: this.ruleCode,
      ruleVersion: this.ruleVersion,
      jurisdictionCode: this.jurisdictionCode,
      status: this.status,
      severity: this.severity,
      enforcement: this.enforcement,
      conditionsDsl: this.conditionsDsl,
      ruleChecksum: this.ruleChecksum,
      effectiveFrom: this.effectiveFrom,
      effectiveTo: this.effectiveTo,
      authorId: this.authorId,
      reviewerId: this.reviewerId,
      approverId: this.approverId,
      approverRole: this.approverRole,
      approvalEvidence: this.approvalEvidence,
      createdAt: this.createdAt
    };
  }
}
