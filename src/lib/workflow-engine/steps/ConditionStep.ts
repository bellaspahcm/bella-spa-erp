/**
 * Condition Step
 * 
 * Evaluates a condition and branches to different next steps based on the result.
 * Enables if-then-else logic in workflows.
 * 
 * @example
 * ```typescript
 * const approvalBranch = new ConditionStep(
 *   'check-approval-result',
 *   (context) => context.data.approvalResult?.approved === true,
 *   'proceed-to-fulfillment',  // true branch
 *   'send-rejection-email'     // false branch
 * );
 * ```
 */

import type { IStep, WorkflowContext, StepOutput } from '../types';

/**
 * Predicate function type (returns boolean)
 */
export type PredicateFunction = (
  context: WorkflowContext
) => boolean | Promise<boolean>;

/**
 * Condition Step Implementation
 * 
 * Evaluates a predicate and returns control flow instruction to jump to
 * the appropriate next step.
 */
export class ConditionStep implements IStep {
  readonly type = 'condition' as const;
  
  constructor(
    public readonly name: string,
    private readonly predicate: PredicateFunction,
    private readonly trueBranch: string,
    private readonly falseBranch: string,
    public readonly description?: string,
    public readonly retryPolicy?: {
      maxAttempts: number;
      delayMs: number;
      backoff?: 'linear' | 'exponential';
      maxDelayMs?: number;
    },
    public readonly continueOnError?: boolean
  ) {}
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    // Evaluate predicate
    const condition = await this.predicate(context);
    
    // Return control flow instruction
    return {
      conditionResult: condition,
      _control: {
        nextStepName: condition ? this.trueBranch : this.falseBranch
      }
    };
  }
  
  /**
   * No compensation needed for condition steps (pure evaluation, no side effects)
   */
  async compensate?(_context: WorkflowContext): Promise<void> {
    // No-op: Conditions don't need rollback
  }
}

/**
 * Helper function to create ConditionStep with type safety
 * 
 * @example
 * ```typescript
 * const step = createConditionStep({
 *   name: 'check-amount',
 *   predicate: (ctx) => ctx.data.amount > 1000000,
 *   trueBranch: 'require-approval',
 *   falseBranch: 'auto-approve'
 * });
 * ```
 */
export function createConditionStep(params: {
  name: string;
  predicate: PredicateFunction;
  trueBranch: string;
  falseBranch: string;
  description?: string;
  retryPolicy?: ConditionStep['retryPolicy'];
  continueOnError?: boolean;
}): ConditionStep {
  return new ConditionStep(
    params.name,
    params.predicate,
    params.trueBranch,
    params.falseBranch,
    params.description,
    params.retryPolicy,
    params.continueOnError
  );
}
