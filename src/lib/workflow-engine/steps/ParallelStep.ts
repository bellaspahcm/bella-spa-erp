/**
 * Parallel Step
 * 
 * Executes multiple steps concurrently and merges their results.
 * Useful for independent operations (e.g., send email + SMS in parallel).
 * 
 * @example
 * ```typescript
 * const notifyStep = new ParallelStep(
 *   'send-notifications',
 *   [
 *     new ActionStep('email', emailHandler),
 *     new ActionStep('sms', smsHandler),
 *     new ActionStep('push', pushHandler)
 *   ]
 * );
 * ```
 */

import type { IStep, WorkflowContext, StepOutput } from '../types';

/**
 * Parallel execution strategy
 */
export type ParallelStrategy =
  | 'all'           // Wait for all steps to complete
  | 'race'          // Return as soon as one completes
  | 'allSettled';   // Wait for all, but don't throw on errors

/**
 * Parallel Step Implementation
 * 
 * Executes multiple steps concurrently using Promise.all/Promise.race/Promise.allSettled.
 */
export class ParallelStep implements IStep {
  readonly type = 'parallel' as const;
  
  constructor(
    public readonly name: string,
    private readonly steps: IStep[],
    private readonly strategy: ParallelStrategy = 'allSettled',
    public readonly description?: string,
    public readonly retryPolicy?: {
      maxAttempts: number;
      delayMs: number;
      backoff?: 'linear' | 'exponential';
      maxDelayMs?: number;
    },
    public readonly continueOnError?: boolean
  ) {
    if (steps.length === 0) {
      throw new Error('ParallelStep must have at least one sub-step');
    }
  }
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    const output: StepOutput = {};
    
    switch (this.strategy) {
      case 'all': {
        // Wait for all steps to complete (throws if any fails)
        const results = await Promise.all(
          this.steps.map(step => step.execute(context))
        );
        
        // Merge all outputs
        for (const result of results) {
          Object.assign(output, result);
        }
        
        break;
      }
      
      case 'race': {
        // Return as soon as one completes
        const result = await Promise.race(
          this.steps.map(step => step.execute(context))
        );
        
        Object.assign(output, result);
        
        break;
      }
      
      case 'allSettled': {
        // Wait for all, but don't throw on errors
        const results = await Promise.allSettled(
          this.steps.map(step => step.execute(context))
        );
        
        // Merge all outputs
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const stepName = this.steps[i].name;
          
          if (result.status === 'fulfilled') {
            Object.assign(output, result.value);
          } else {
            // Store error for failed steps
            output[`${stepName}_error`] = result.reason?.message ?? 'Unknown error';
          }
        }
        
        break;
      }
    }
    
    return output;
  }
  
  /**
   * Compensation: Rollback all sub-steps in reverse order
   */
  async compensate(context: WorkflowContext): Promise<void> {
    // Compensate in reverse order
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      if (step.compensate) {
        try {
          await step.compensate(context);
        } catch (error) {
          // Log but continue compensating other steps
          console.error(`Compensation failed for step ${step.name}:`, error);
        }
      }
    }
  }
}

/**
 * Helper function to create ParallelStep with type safety
 * 
 * @example
 * ```typescript
 * const step = createParallelStep({
 *   name: 'parallel-notifications',
 *   steps: [emailStep, smsStep, pushStep],
 *   strategy: 'allSettled'
 * });
 * ```
 */
export function createParallelStep(params: {
  name: string;
  steps: IStep[];
  strategy?: ParallelStrategy;
  description?: string;
  retryPolicy?: ParallelStep['retryPolicy'];
  continueOnError?: boolean;
}): ParallelStep {
  return new ParallelStep(
    params.name,
    params.steps,
    params.strategy,
    params.description,
    params.retryPolicy,
    params.continueOnError
  );
}
