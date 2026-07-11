/**
 * RuleProvider - Rule-based Decision Provider
 *
 * Implementation of IDecisionProvider using the RuleReasoner
 * for deterministic, rule-based decision making.
 *
 * @module lib/decision-engine/providers/RuleProvider
 */

import type { IDecisionProvider, DecisionProviderInput } from '../abstractions/IDecisionProvider';
import type { DecisionResult } from '../types';

/**
 * Rule-based Decision Provider
 *
 * Uses RuleReasoner to evaluate rule sets and produce decisions.
 * This is the default provider for all rule-based policies.
 */
export class RuleProvider implements IDecisionProvider {
  readonly name = 'rule';
  readonly description = 'Rule-based decision provider using RuleReasoner';
  readonly version = '1.0.0';

  canHandle(input: DecisionProviderInput): boolean {
    return input.type === 'rule' || input.type === 'rule-based';
  }

  async decide(_input: DecisionProviderInput): Promise<DecisionResult> {
    // Default implementation - returns reject with explanation
    // Concrete policies will override via registry
    return {
      outcome: 'REJECT',
      explanation: 'No rules configured for this provider'
    };
  }

  async initialize(): Promise<void> {
    // No initialization required for rule provider
  }

  async dispose(): Promise<void> {
    // No cleanup required for rule provider
  }
}
