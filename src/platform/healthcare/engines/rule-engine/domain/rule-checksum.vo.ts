/**
 * Canonical Rule Checksum Value Object — Phase H10 Clinical Governance
 *
 * Generates deterministic SHA-256 checksums over the complete rule artifact.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/rule-engine/domain/rule-checksum.vo
 */

import { createHash } from 'crypto';
import type {
  IDslConditionsGroup,
  RuleSeverity,
  RuleEnforcement
} from '../../../contracts/rule-governance.contract';

export interface CanonicalRuleParams {
  ruleCode: string;
  ruleVersion: string;
  jurisdictionCode?: string;
  severity: RuleSeverity;
  enforcement: RuleEnforcement;
  conditionsDsl: IDslConditionsGroup;
  effectiveFrom: string;
  effectiveTo?: string;
}

export class RuleChecksumVO {
  public static generateCanonicalChecksum(params: CanonicalRuleParams): string {
    const canonicalObj = {
      ruleCode: params.ruleCode.trim(),
      ruleVersion: params.ruleVersion.trim(),
      jurisdictionCode: (params.jurisdictionCode || 'LOCAL').trim(),
      severity: params.severity,
      enforcement: params.enforcement,
      conditionsDsl: params.conditionsDsl,
      effectiveFrom: new Date(params.effectiveFrom).toISOString(),
      effectiveTo: params.effectiveTo ? new Date(params.effectiveTo).toISOString() : null
    };

    const canonicalJson = JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
    const hash = createHash('sha256').update(canonicalJson).digest('hex');
    return `sha256-${hash}`;
  }
}
