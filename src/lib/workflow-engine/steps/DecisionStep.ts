/**
 * Decision Step
 * 
 * Delegates decision-making to Decision Engine. This step integrates Workflow Engine
 * with Decision Engine providers.
 * 
 * @example
 * ```typescript
 * const autoApprovalStep = new DecisionStep(
 *   'check-auto-approval',
 *   decisionEngine,
 *   {
 *     decisionType: 'auto-approval',
 *     ruleType: 'if-then',
 *     rule: { condition: { field: 'amount', operator: '<', value: 5000000 } },
 *     outputKey: 'approvalResult'
 *   }
 * );
 * ```
 */

import type { IStep, WorkflowContext, StepOutput } from '../types';

/**
 * Decision Engine interface (minimal for type safety)
 */
export interface IDecisionEngine {
  evaluate(context: DecisionContext): Promise<DecisionResult>;
}

export interface DecisionContext {
  tenantId: string;
  module: string;
  decisionType: string;
  ruleType: string;
  rule: Record<string, unknown>;
  data: Record<string, unknown>;
  user?: { id?: string };
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionResult {
  outcome: 'APPROVE' | 'REJECT' | 'ESCALATE';
  explanation?: string;
  [key: string]: unknown;
}

/**
 * Decision step configuration
 */
export interface DecisionStepConfig {
  /** Decision type (e.g., 'auto-approval', 'kpi-eligibility') */
  decisionType: string;
  
  /** Rule type (e.g., 'if-then', 'threshold') */
  ruleType: string;
  
  /** Rule definition (passed to Decision Engine) */
  rule: Record<string, unknown>;
  
  /** Output key (where to store result in workflow context) */
  outputKey: string;
  
  /** Module name (defaults to 'workflow') */
  module?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Decision Step Implementation
 * 
 * Integrates Workflow Engine with Decision Engine by:
 * 1. Extracting data from workflow context
 * 2. Calling Decision Engine.evaluate()
 * 3. Storing result back in workflow context
 */
export class DecisionStep implements IStep {
  readonly type = 'decision' as const;
  
  constructor(
    public readonly name: string,
    private readonly decisionEngine: IDecisionEngine,
    private readonly config: DecisionStepConfig,
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
    // Build decision context from workflow context
    const decisionContext: DecisionContext = {
      tenantId: context.tenantId,
      module: this.config.module ?? 'workflow',
      decisionType: this.config.decisionType,
      ruleType: this.config.ruleType,
      rule: this.config.rule,
      data: context.data,
      user: context.userId ? { id: context.userId } : undefined,
      correlationId: context.correlationId,
      metadata: {
        ...this.config.metadata,
        workflowId: context.workflowId,
        executionId: context.executionId,
        stepName: this.name
      }
    };
    
    // Delegate to Decision Engine
    const result = await this.decisionEngine.evaluate(decisionContext);
    
    // Store result in workflow context using configured output key
    return {
      [this.config.outputKey]: result
    };
  }
  
  /**
   * No compensation needed for decision steps (pure evaluation, no side effects)
   */
  async compensate?(_context: WorkflowContext): Promise<void> {
    // No-op: Decisions don't need rollback
  }
}

/**
 * Helper function to create DecisionStep with type safety
 * 
 * @example
 * ```typescript
 * const step = createDecisionStep({
 *   name: 'check-eligibility',
 *   decisionEngine,
 *   config: {
 *     decisionType: 'kpi-eligibility',
 *     ruleType: 'if-then',
 *     rule: { ... },
 *     outputKey: 'kpiResult'
 *   }
 * });
 * ```
 */
export function createDecisionStep(params: {
  name: string;
  decisionEngine: IDecisionEngine;
  config: DecisionStepConfig;
  description?: string;
  retryPolicy?: DecisionStep['retryPolicy'];
  continueOnError?: boolean;
}): DecisionStep {
  return new DecisionStep(
    params.name,
    params.decisionEngine,
    params.config,
    params.description,
    params.retryPolicy,
    params.continueOnError
  );
}
