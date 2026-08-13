/**
 * Rule Governance Port Interface
 *
 * Enforces the boundary contract for retrieving versioned grading rules from the host engine.
 */

export type GradingRule =
  | {
      readonly scaleType: 'scale_10';
      readonly passingThreshold: number; // 0 to 10
      readonly ruleVersion: string;
      readonly checksum: string;
    }
  | {
      readonly scaleType: 'percentage';
      readonly passingThreshold: number; // 0 to 100
      readonly ruleVersion: string;
      readonly checksum: string;
    }
  | {
      readonly scaleType: 'gpa_4';
      readonly passingThreshold: number; // 0 to 4
      readonly ruleVersion: string;
      readonly checksum: string;
    };

export interface IEducationRuleGovernancePort {
  getActiveGradingRule(tenantId: string): Promise<GradingRule>;
}
