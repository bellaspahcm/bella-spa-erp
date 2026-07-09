/**
 * Workflow Engine
 * 
 * Main orchestrator and entry point for workflow execution. Stateful orchestration
 * layer for multi-step business processes.
 * 
 * @see docs/WORKFLOW_ENGINE_ARCHITECTURE.md
 */

import type { IEventPublisher } from '../events/abstractions/IEventPublisher';
import type { IStateManager } from './state-manager';
import type { IWorkflowExecutor } from './workflow-executor';
import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowExecutionResult,
  createWorkflowContext
} from './types';

/**
 * Workflow Engine Interface
 */
export interface IWorkflowEngine {
  /**
   * Execute a workflow from start to finish
   * @param definition - Workflow definition (DSL)
   * @param initialContext - Initial workflow context
   * @returns Promise<WorkflowExecutionResult>
   */
  execute(
    definition: WorkflowDefinition,
    initialContext: Partial<WorkflowContext>
  ): Promise<WorkflowExecutionResult>;
  
  /**
   * Resume a paused workflow execution
   * @param executionId - Workflow execution ID
   * @returns Promise<WorkflowExecutionResult>
   */
  resume(executionId: string): Promise<WorkflowExecutionResult>;
  
  /**
   * Cancel a running workflow execution
   * @param executionId - Workflow execution ID
   * @param reason - Cancellation reason
   */
  cancel(executionId: string, reason: string): Promise<void>;
}

/**
 * Workflow Engine Implementation
 */
export class WorkflowEngine implements IWorkflowEngine {
  constructor(
    private readonly executor: IWorkflowExecutor,
    private readonly stateManager: IStateManager,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger?: Console,
    private readonly createContext?: typeof createWorkflowContext
  ) {}

  async execute(
    definition: WorkflowDefinition,
    initialContext: Partial<WorkflowContext>
  ): Promise<WorkflowExecutionResult> {
    // 1. Validate definition
    this.validateDefinition(definition);
    
    // 2. Build initial context
    const context = this.buildInitialContext(definition, initialContext);
    
    // 3. Create execution record
    const execution = await this.stateManager.createExecution({
      workflowId: definition.id,
      workflowVersion: definition.version,
      context,
      status: 'running',
      startedAt: new Date()
    });
    
    // 4. Publish start event
    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      type: 'workflow.started',
      data: {
        executionId: execution.id,
        workflowId: definition.id,
        workflowVersion: definition.version,
        tenantId: context.tenantId,
        userId: context.userId
      },
      timestamp: new Date(),
      tenantId: context.tenantId,
      correlationId: context.correlationId
    });
    
    try {
      // 5. Execute workflow
      const result = await this.executor.execute(definition, execution);
      
      // 6. Mark as completed (if not paused)
      if (result.status === 'completed') {
        await this.stateManager.completeExecution(execution.id, result);
        
        // Publish completion event
        await this.eventPublisher.publish({
          id: crypto.randomUUID(),
          type: 'workflow.completed',
          data: {
            executionId: execution.id,
            workflowId: definition.id,
            result: result.output,
            executionTime: result.executionTime
          },
          timestamp: new Date(),
          tenantId: context.tenantId,
          correlationId: context.correlationId
        });
      }
      
      return result;
    } catch (error) {
      // 7. Handle failure
      await this.stateManager.failExecution(
        execution.id,
        error instanceof Error ? error : new Error('Unknown error')
      );
      
      await this.eventPublisher.publish({
        id: crypto.randomUUID(),
        type: 'workflow.failed',
        data: {
          executionId: execution.id,
          workflowId: definition.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date(),
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });
      
      throw error;
    }
  }

  async resume(executionId: string): Promise<WorkflowExecutionResult> {
    // Load execution from StateManager
    const execution = await this.stateManager.getExecution(executionId);
    
    if (execution.status !== 'paused') {
      throw new Error(`Cannot resume workflow: status is ${execution.status}`);
    }
    
    // Update status to running
    await this.stateManager.resumeExecution(executionId);
    
    // Publish resume event
    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      type: 'workflow.resumed',
      data: {
        executionId,
        workflowId: execution.workflowId
      },
      timestamp: new Date(),
      tenantId: execution.tenantId,
      correlationId: execution.context.correlationId
    });
    
    // Resume from last completed step
    // Note: This is simplified - full implementation would need workflow definition
    return this.executor.resume(execution);
  }
  
  async cancel(executionId: string, reason: string): Promise<void> {
    await this.stateManager.cancelExecution(executionId, reason);
    
    const execution = await this.stateManager.getExecution(executionId);
    
    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      type: 'workflow.cancelled',
      data: {
        executionId,
        workflowId: execution.workflowId,
        reason
      },
      timestamp: new Date(),
      tenantId: execution.tenantId,
      correlationId: execution.context.correlationId
    });
  }
  
  private validateDefinition(definition: WorkflowDefinition): void {
    if (!definition.id) {
      throw new Error('Workflow ID is required');
    }
    
    if (!definition.version) {
      throw new Error('Workflow version is required');
    }
    
    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
    
    // Validate step names are unique
    const stepNames = new Set<string>();
    for (const step of definition.steps) {
      if (stepNames.has(step.name)) {
        throw new Error(`Duplicate step name: ${step.name}`);
      }
      stepNames.add(step.name);
    }
  }
  
  private buildInitialContext(
    definition: WorkflowDefinition,
    partial: Partial<WorkflowContext>
  ): WorkflowContext {
    if (!partial.tenantId) {
      throw new Error('tenantId is required');
    }
    
    // Use injected createContext function or default implementation
    const createFn = this.createContext ?? this.defaultCreateContext;
    
    return createFn({
      ...partial,
      workflowId: definition.id,
      workflowVersion: definition.version,
      tenantId: partial.tenantId
    });
  }
  
  private defaultCreateContext(
    partial: Partial<WorkflowContext> & Pick<WorkflowContext, 'workflowId' | 'tenantId'>
  ): WorkflowContext {
    return {
      executionId: partial.executionId ?? crypto.randomUUID(),
      workflowId: partial.workflowId,
      workflowVersion: partial.workflowVersion ?? '1.0.0',
      tenantId: partial.tenantId,
      userId: partial.userId,
      correlationId: partial.correlationId ?? crypto.randomUUID(),
      currentStepIndex: partial.currentStepIndex ?? 0,
      data: partial.data ?? {},
      stepResults: partial.stepResults ?? [],
      metadata: partial.metadata
    };
  }
}
