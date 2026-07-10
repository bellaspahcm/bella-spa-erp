/**
 * Workflow Executor
 * 
 * Step-by-step execution engine for workflows. Handles:
 * - Sequential step execution
 * - Step-level retry logic
 * - Context management
 * - Error handling
 * - Event publishing
 */

import type { IEventPublisher } from '../events/abstractions/IEventPublisher';
import type { IStateManager } from './state-manager';
import type {
  IStep,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionResult,
  StepExecutionResult,
  StepOutput
} from './types';

/**
 * Workflow execution error
 */
export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly stepResult?: StepExecutionResult
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

/**
 * Workflow Executor Interface
 */
export interface IWorkflowExecutor {
  /**
   * Execute all steps in workflow definition
   */
  execute(
    definition: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<WorkflowExecutionResult>;
  
  /**
   * Execute a single step
   */
  executeStep(
    step: IStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult>;
  
  /**
   * Resume from paused execution
   */
  resume(execution: WorkflowExecution): Promise<WorkflowExecutionResult>;
}

/**
 * Workflow Executor Implementation
 */
export class WorkflowExecutor implements IWorkflowExecutor {
  constructor(
    private readonly stateManager: IStateManager,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger?: Console
  ) {}

  async execute(
    definition: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<WorkflowExecutionResult> {
    let context = execution.context;
    const results: StepExecutionResult[] = [];
    const startTime = Date.now();
    let shouldPause = false;
    let shouldComplete = false; // Track if workflow completed early
    
    try {
      for (let i = context.currentStepIndex; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        
        // Execute step with retry logic
        const stepResult = await this.executeStepWithRetry(
          step,
          context,
          definition.defaultRetryPolicy
        );
        
        // Store result
        results.push(stepResult);
        context.stepResults.push(stepResult);
        context.currentStepIndex = i + 1;
        
        // Persist state after each step
        await this.stateManager.upsertStepExecution(execution.id, {
          stepName: step.name,
          stepIndex: i,
          status: stepResult.status,
          outputData: stepResult.output,
          errorMessage: stepResult.error,
          retryCount: stepResult.retryCount ?? 0,
          completedAt: new Date(),
          executionTimeMs: stepResult.executionTime
        });
        
        // Update context in state
        await this.stateManager.updateContext(execution.id, context);
        
        // Handle step outcomes
        if (stepResult.status === 'failed' && !step.continueOnError) {
          throw new WorkflowExecutionError(
            `Step ${step.name} failed`,
            stepResult
          );
        }
        
        // Merge step output into context BEFORE checking control flags
        context.data = { ...context.data, ...stepResult.output };
        
        if (stepResult.shouldPause) {
          shouldPause = true;
          await this.stateManager.pauseExecution(execution.id);
          
          await this.eventPublisher.publish({
            id: crypto.randomUUID(),
            type: 'workflow.paused',
            data: {
              executionId: execution.id,
              workflowId: definition.id,
              stepName: step.name,
              reason: 'Step requested pause'
            },
            timestamp: new Date(),
            tenantId: context.tenantId,
            correlationId: context.correlationId
          });
          
          break;
        }
        
        if (stepResult.shouldSkipRemainingSteps) {
          this.logger?.info(`Skipping remaining steps after ${step.name}`);
          shouldComplete = true; // Mark as completed, not paused
          break;
        }
        
        if (stepResult.nextStepName) {
          // Conditional branching
          const nextIndex = this.findStepIndex(definition, stepResult.nextStepName);
          if (nextIndex === -1) {
            throw new WorkflowExecutionError(
              `Next step not found: ${stepResult.nextStepName}`
            );
          }
          i = nextIndex - 1; // -1 because loop will increment
        }
      }
      
      const executionTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      
      // Determine final status
      let finalStatus: 'completed' | 'paused';
      if (shouldPause) {
        finalStatus = 'paused';
      } else if (shouldComplete || context.currentStepIndex >= definition.steps.length) {
        finalStatus = 'completed';
      } else {
        finalStatus = 'paused';
      }
      
      return {
        executionId: execution.id,
        status: finalStatus,
        output: context.data,
        steps: results,
        executionTime
      };
    } catch (error) {
      const executionTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      
      this.logger?.error('Workflow execution failed:', error);
      
      // Return failed result but also throw to let WorkflowEngine handle events
      const failedResult: WorkflowExecutionResult = {
        executionId: execution.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        steps: results,
        executionTime
      };
      
      // Important: Throw to let WorkflowEngine emit failure events
      throw new WorkflowExecutionError(
        error instanceof Error ? error.message : 'Unknown error',
        failedResult.steps[failedResult.steps.length - 1]
      );
    }
  }

  async executeStep(
    step: IStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger?.info(`Executing step: ${step.name} (type: ${step.type})`);
      
      // Emit event
      await this.eventPublisher.publish({
        id: crypto.randomUUID(),
        type: 'workflow.step.started',
        data: {
          executionId: context.executionId,
          workflowId: context.workflowId,
          stepName: step.name,
          stepType: step.type
        },
        timestamp: new Date(),
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });
      
      // Execute step logic
      const result: StepOutput = await step.execute(context);
      
      const executionTime = Date.now() - startTime;
      
      // Extract control flags
      const controlFlags = result._control;
      delete result._control; // Remove control flags from output
      
      // Emit completion event
      await this.eventPublisher.publish({
        id: crypto.randomUUID(),
        type: 'workflow.step.completed',
        data: {
          executionId: context.executionId,
          workflowId: context.workflowId,
          stepName: step.name,
          output: result,
          executionTime
        },
        timestamp: new Date(),
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });
      
      return {
        stepName: step.name,
        status: 'completed',
        output: result,
        executionTime,
        shouldPause: controlFlags?.pause,
        shouldSkipRemainingSteps: controlFlags?.skipRemaining,
        nextStepName: controlFlags?.nextStepName
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger?.error(`Step failed: ${step.name}`, error);
      
      // Emit failure event
      await this.eventPublisher.publish({
        id: crypto.randomUUID(),
        type: 'workflow.step.failed',
        data: {
          executionId: context.executionId,
          workflowId: context.workflowId,
          stepName: step.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime
        },
        timestamp: new Date(),
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });
      
      return {
        stepName: step.name,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }
  
  async resume(execution: WorkflowExecution): Promise<WorkflowExecutionResult> {
    if (execution.status !== 'paused') {
      throw new Error(`Cannot resume workflow: status is ${execution.status}`);
    }
    
    // Resume execution would need workflow definition
    // This is a simplified implementation
    throw new Error('Resume not fully implemented - needs workflow definition');
  }
  
  private async executeStepWithRetry(
    step: IStep,
    context: WorkflowContext,
    defaultRetryPolicy?: { maxAttempts: number; delayMs: number }
  ): Promise<StepExecutionResult> {
    const retryPolicy = step.retryPolicy ?? defaultRetryPolicy;
    const maxRetries = retryPolicy?.maxAttempts ?? 0;
    const retryDelay = retryPolicy?.delayMs ?? 1000;
    const backoff = retryPolicy?.backoff ?? 'exponential';
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.executeStep(step, context);
      
      if (result.status === 'completed') {
        return { ...result, retryCount: attempt };
      }
      
      if (attempt < maxRetries) {
        const delay = backoff === 'exponential'
          ? retryDelay * Math.pow(2, attempt)
          : retryDelay * (attempt + 1);
        
        const cappedDelay = retryPolicy?.maxDelayMs
          ? Math.min(delay, retryPolicy.maxDelayMs)
          : delay;
        
        this.logger?.warn(
          `Retrying step ${step.name} (attempt ${attempt + 1}/${maxRetries}) after ${cappedDelay}ms`
        );
        
        // Emit retry event
        await this.eventPublisher.publish({
          id: crypto.randomUUID(),
          type: 'workflow.step.retrying',
          data: {
            executionId: context.executionId,
            stepName: step.name,
            attempt: attempt + 1,
            maxAttempts: maxRetries,
            delayMs: cappedDelay
          },
          timestamp: new Date(),
          tenantId: context.tenantId,
          correlationId: context.correlationId
        });
        
        await this.delay(cappedDelay);
      } else {
        // Exhausted all retries, return last failed result with retry count
        return { ...result, retryCount: maxRetries };
      }
    }
    
    // Should never reach here (loop always returns)
    throw new Error(`Step ${step.name} failed after ${maxRetries} retries`);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private findStepIndex(definition: WorkflowDefinition, stepName: string): number {
    return definition.steps.findIndex(s => s.name === stepName);
  }
}
