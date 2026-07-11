/**
 * RuleReasoner: Evaluate policy rules against knowledge.
 * 
 * Simple. Direct. Production-ready.
 * No abstractions. No over-engineering.
 */

import type { 
  Policy, 
  DecisionRule, 
  Condition, 
  DecisionResult, 
  Knowledge, 
  DecisionOutcome 
} from './types';

export class RuleReasoner {
  constructor(
    private readonly config?: {
      debug?: boolean;
    }
  ) {}
  
  /**
   * Evaluate policy against knowledge.
   * Returns pure decision (no telemetry).
   */
  evaluate(policy: Policy, knowledge: Knowledge): DecisionResult {
    let outcome: DecisionOutcome = 'ESCALATE'; // default
    let explanation = 'No rules matched';
    
    // Evaluate rules in priority order (sorted by priority ascending)
    const sortedRules = [...policy.rules].sort((a, b) => a.priority - b.priority);
    
    for (const rule of sortedRules) {
      if (this.evaluateRule(rule, knowledge)) {
        outcome = rule.action.outcome;
        explanation = rule.action.reason;
        
        if (this.config?.debug) {
          console.log('[RuleReasoner] Matched rule:', rule.id, { outcome, explanation });
        }
        
        break; // First match wins (highest priority)
      }
    }
    
    return { outcome, explanation };
  }
  
  /**
   * Evaluate single rule against knowledge.
   */
  private evaluateRule(rule: DecisionRule, knowledge: Knowledge): boolean {
    return this.evaluateCondition(rule.conditions, knowledge);
  }
  
  /**
   * Evaluate condition recursively.
   */
  private evaluateCondition(condition: Condition, knowledge: Knowledge): boolean {
    if (condition.type === 'comparison') {
      const value = knowledge[condition.field];
      return this.compare(value, condition.operator, condition.value);
    }
    
    if (condition.type === 'operator') {
      if (condition.operator === 'and') {
        return condition.conditions.every(c => this.evaluateCondition(c, knowledge));
      }
      if (condition.operator === 'or') {
        return condition.conditions.some(c => this.evaluateCondition(c, knowledge));
      }
    }
    
    return false;
  }
  
  /**
   * Compare values using operator.
   */
  private compare(left: unknown, operator: string, right: unknown): boolean {
    // If comparing numbers, perform arithmetic comparison
    if (typeof left === 'number' && typeof right === 'number') {
      switch (operator) {
        case '>=': return left >= right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '<': return left < right;
        case '==': return left == right;
        case '===': return left === right;
        case '!=': return left != right;
        case '!==': return left !== right;
        default: return false;
      }
    }

    // If comparing strings, perform lexicographical comparison or equality
    if (typeof left === 'string' && typeof right === 'string') {
      switch (operator) {
        case '>=': return left >= right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '<': return left < right;
        case '==': return left == right;
        case '===': return left === right;
        case '!=': return left != right;
        case '!==': return left !== right;
        default: return false;
      }
    }

    // Fallback standard checks for other types
    switch (operator) {
      case '==': return left == right;
      case '===': return left === right;
      case '!=': return left != right;
      case '!==': return left !== right;
      default: return false;
    }
  }
}
