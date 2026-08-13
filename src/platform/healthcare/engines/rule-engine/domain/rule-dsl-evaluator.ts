/**
 * Deterministic & Explainable DSL Evaluator — Phase H10 Clinical Governance
 *
 * Sandboxed, zero-side-effect evaluator for declarative JSON DSL conditions.
 * Provides structured match evidence (`matchedConditions`) for complete auditability.
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/rule-engine/domain/rule-dsl-evaluator
 */

import type {
  IDslConditionsGroup,
  IRuleCondition,
  IMatchedConditionDetail,
  IGovernedRuleRecord,
  IEvaluatedRuleDetail
} from '../../../contracts/rule-governance.contract';

export class RuleDslEvaluator {
  public static evaluateRule(
    rule: IGovernedRuleRecord,
    context: Record<string, unknown>
  ): IEvaluatedRuleDetail {
    const matchedConditions: IMatchedConditionDetail[] = [];
    const dsl = rule.conditionsDsl;

    let allPassed = true;
    let anyPassed = false;

    // Evaluate 'all' array (AND logic)
    if (dsl.all && dsl.all.length > 0) {
      for (const cond of dsl.all) {
        const res = RuleDslEvaluator.evaluateCondition(cond, context);
        matchedConditions.push(res);
        if (!res.passed) {
          allPassed = false;
        }
      }
    }

    // Evaluate 'any' array (OR logic)
    if (dsl.any && dsl.any.length > 0) {
      for (const cond of dsl.any) {
        const res = RuleDslEvaluator.evaluateCondition(cond, context);
        matchedConditions.push(res);
        if (res.passed) {
          anyPassed = true;
        }
      }
    } else if (!dsl.all || dsl.all.length === 0) {
      anyPassed = true; // empty conditions match by default if no rules defined
    }

    const matched = (dsl.all ? allPassed : true) && (dsl.any ? anyPassed : true);

    return {
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
      ruleVersion: rule.ruleVersion,
      ruleChecksum: rule.ruleChecksum,
      severity: rule.severity,
      enforcement: rule.enforcement,
      matched,
      matchedConditions
    };
  }

  public static evaluateCondition(
    condition: IRuleCondition,
    context: Record<string, unknown>
  ): IMatchedConditionDetail {
    const actualValue = RuleDslEvaluator.getNestedValue(context, condition.field);
    const passed = RuleDslEvaluator.compareValues(
      actualValue,
      condition.operator,
      condition.value
    );

    return {
      field: condition.field,
      operator: condition.operator,
      expectedValue: condition.value,
      actualValue,
      passed
    };
  }

  public static compareValues(
    actual: unknown,
    operator: string,
    expected: unknown
  ): boolean {
    if (actual === undefined || actual === null) {
      return operator === 'NOT_EQUALS';
    }

    switch (operator) {
      case 'EQUALS':
        return String(actual).toLowerCase() === String(expected).toLowerCase();

      case 'NOT_EQUALS':
        return String(actual).toLowerCase() !== String(expected).toLowerCase();

      case 'CONTAINS':
        if (Array.isArray(actual)) {
          return actual.some((item) =>
            String(item).toLowerCase().includes(String(expected).toLowerCase())
          );
        }
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());

      case 'NOT_CONTAINS':
        if (Array.isArray(actual)) {
          return !actual.some((item) =>
            String(item).toLowerCase().includes(String(expected).toLowerCase())
          );
        }
        return !String(actual).toLowerCase().includes(String(expected).toLowerCase());

      case 'STARTS_WITH':
        return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());

      case 'GREATER_THAN':
        return Number(actual) > Number(expected);

      case 'LESS_THAN':
        return Number(actual) < Number(expected);

      case 'BETWEEN':
        if (Array.isArray(expected) && expected.length === 2) {
          const val = Number(actual);
          return val >= Number(expected[0]) && val <= Number(expected[1]);
        }
        return false;

      default:
        return false;
    }
  }

  public static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
