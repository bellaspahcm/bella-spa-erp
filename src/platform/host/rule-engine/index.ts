/**
 * Rule Engine — D3 Index
 * Platform Host: src/platform/host/rule-engine/
 */

export { RuleEngineService } from './rule-engine.service';
export { RULE_ENGINE_CONTRACT } from './rule-engine.contract';
export type {
  BusinessRule,
  RuleStatus,
  RuleSeverity,
  RuleActionType,
  RuleDomain,
  RuleEvalOutcome,
  RuleConditions,
  RuleConditionLeaf,
  RuleConditionOperator,
  RuleFieldOperator,
  CreateRuleParams,
  EvaluateRuleParams,
  RuleEvaluationResult,
  ApproveRuleParams,
} from './rule-engine.service';
