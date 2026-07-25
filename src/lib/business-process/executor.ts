/**
 * Business Process Executor
 * 
 * Executes a business process by composing multiple policy providers.
 * 
 * Execution Modes:
 * 1. Sequential: Execute policies one by one (simplest)
 * 2. Parallel: Execute independent policies concurrently (fastest)
 * 3. Topological: Execute policies respecting dependencies (smartest)
 */

import type { DecisionContext } from '@/lib/decision-engine/types/decision-context';
import type { PayrollProvider } from '@/lib/decision-engine/types/payroll-types';
import type {
  BusinessProcess,
  ProcessConfig,
  ProcessResult,
  PolicyExecutionResult,
  PolicyDependency,
} from './types';

/**
 * Base Business Process Executor
 * 
 * Provides common execution logic for all business processes.
 */
export abstract class BaseBusinessProcess<TContext, TResult>
  implements BusinessProcess<TContext, TResult>
{
  abstract config: ProcessConfig;
  abstract policies: PayrollProvider<unknown>[];

  /**
   * Execute the business process
   */
  async execute(context: TContext): Promise<ProcessResult<TResult>> {
    const startTime = performance.now();
    
    // Validate configuration
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Process validation failed: ${errors.join(', ')}`);
    }

    // Choose execution mode
    const mode = this.config.executionMode || 'sequential';
    let policyResults: PolicyExecutionResult[];

    switch (mode) {
      case 'parallel':
        policyResults = await this.executeParallel(context);
        break;
      case 'topological':
        policyResults = await this.executeTopological(context);
        break;
      case 'sequential':
      default:
        policyResults = await this.executeSequential(context);
        break;
    }

    // Aggregate results
    const result = await this.aggregate(context, policyResults);
    
    const endTime = performance.now();
    const totalExecutionTime = endTime - startTime;

    // Build process result
    const policiesSucceeded = policyResults.filter(r => r.status === 'success').length;
    const policiesFailed = policyResults.filter(r => r.status === 'failure').length;
    const policiesSkipped = policyResults.filter(r => r.status === 'skipped').length;

    return {
      processName: this.config.name,
      processVersion: this.config.version,
      status: policiesFailed > 0 ? 'partial_success' : 'success',
      result,
      policyResults,
      totalExecutionTime,
      metadata: {
        policiesExecuted: policyResults.length,
        policiesSucceeded,
        policiesFailed,
        policiesSkipped,
        policyComposition: policyResults
          .filter(r => r.status === 'success')
          .map(r => `${r.policyName}:${r.policyType}`),
        executionMode: mode,
      },
    };
  }

  /**
   * Execute policies sequentially (one after another)
   */
  private async executeSequential(context: TContext): Promise<PolicyExecutionResult[]> {
    const results: PolicyExecutionResult[] = [];

    for (const policy of this.policies) {
      const result = await this.executePolicy(policy, context);
      results.push(result);

      // Stop on failure if continueOnFailure is false
      if (result.status === 'failure' && !this.config.continueOnFailure) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute policies in parallel (all at once)
   */
  private async executeParallel(context: TContext): Promise<PolicyExecutionResult[]> {
    const promises = this.policies.map(policy => this.executePolicy(policy, context));
    return Promise.all(promises);
  }

  /**
   * Execute policies topologically (respecting dependencies)
   */
  private async executeTopological(context: TContext): Promise<PolicyExecutionResult[]> {
    if (!this.config.dependencies) {
      // No dependencies defined, fall back to sequential
      return this.executeSequential(context);
    }

    const results: PolicyExecutionResult[] = [];
    const executed = new Set<string>();
    const dependencies = new Map(
      this.config.dependencies.map(d => [d.policyName, d.dependencies])
    );

    // Build policy name -> provider mapping
    const policyMap = new Map(
      this.policies.map(p => [p.name, p])
    );

    // Execute policies in topological order
    const executeRecursive = async (policyName: string): Promise<void> => {
      if (executed.has(policyName)) return;

      // Execute dependencies first
      const deps = dependencies.get(policyName) || [];
      for (const dep of deps) {
        await executeRecursive(dep);
      }

      // Execute this policy
      const policy = policyMap.get(policyName);
      if (policy) {
        const result = await this.executePolicy(policy, context);
        results.push(result);
        executed.add(policyName);
      }
    };

    // Start execution from all root policies
    for (const policy of this.policies) {
      await executeRecursive(policy.name);
    }

    return results;
  }

  /**
   * Execute a single policy
   */
  private async executePolicy(
    policy: PayrollProvider<unknown>,
    context: TContext
  ): Promise<PolicyExecutionResult> {
    const startTime = performance.now();

    try {
      const result = await policy.evaluate(context as unknown as DecisionContext);
      const endTime = performance.now();

      return {
        policyName: policy.name,
        policyType: policy.decisionType,
        status: 'success',
        data: result,
        executionTime: endTime - startTime,
        metadata: (result as { metadata?: Record<string, unknown> })?.metadata,
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        policyName: policy.name,
        policyType: policy.decisionType,
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
        executionTime: endTime - startTime,
      };
    }
  }

  /**
   * Aggregate policy results into final process result
   * 
   * Subclasses must implement this to define how results combine.
   */
  protected abstract aggregate(
    context: TContext,
    policyResults: PolicyExecutionResult[]
  ): Promise<TResult>;

  /**
   * Validate process configuration
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.config.name) {
      errors.push('Process name is required');
    }

    if (!this.config.version) {
      errors.push('Process version is required');
    }

    if (this.policies.length === 0) {
      errors.push('At least one policy is required');
    }

    // Validate topological dependencies
    if (this.config.executionMode === 'topological' && this.config.dependencies) {
      const policyNames = new Set(this.policies.map(p => p.name));
      
      for (const dep of this.config.dependencies) {
        if (!policyNames.has(dep.policyName)) {
          errors.push(`Dependency references unknown policy: ${dep.policyName}`);
        }

        for (const requiredDep of dep.dependencies) {
          if (!policyNames.has(requiredDep)) {
            errors.push(`Policy ${dep.policyName} depends on unknown policy: ${requiredDep}`);
          }
        }
      }

      // Check for circular dependencies
      const circular = this.detectCircularDependencies();
      if (circular) {
        errors.push(`Circular dependency detected: ${circular.join(' → ')}`);
      }
    }

    return errors;
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(): string[] | null {
    if (!this.config.dependencies) return null;

    const dependencies = new Map(
      this.config.dependencies.map(d => [d.policyName, d.dependencies])
    );

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (policyName: string, path: string[]): string[] | null => {
      visited.add(policyName);
      recursionStack.add(policyName);

      const deps = dependencies.get(policyName) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          const cycle = hasCycle(dep, [...path, dep]);
          if (cycle) return cycle;
        } else if (recursionStack.has(dep)) {
          return [...path, dep, policyName];
        }
      }

      recursionStack.delete(policyName);
      return null;
    };

    for (const policy of this.policies) {
      if (!visited.has(policy.name)) {
        const cycle = hasCycle(policy.name, [policy.name]);
        if (cycle) return cycle;
      }
    }

    return null;
  }
}
