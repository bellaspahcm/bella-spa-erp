/**
 * Workflow State Manager Interface
 * 
 * Abstraction for workflow execution state persistence. Follows Decision Engine's
 * principle #8: Engine never accesses Database directly.
 * 
 * All database operations go through StateManager to maintain separation of concerns.
 */

import type {
  WorkflowExecution,
  WorkflowContext,
  WorkflowExecutionStatus,
  WorkflowExecutionResult,
  StepExecutionStatus
} from './types';

/**
 * State Manager Interface
 * 
 * Core abstraction for workflow state persistence. All workflow state operations
 * must go through this interface.
 */
export interface IStateManager {
  /**
   * Create new workflow execution record
   */
  createExecution(params: {
    workflowId: string;
    workflowVersion: string;
    context: WorkflowContext;
    status: WorkflowExecutionStatus;
    startedAt: Date;
  }): Promise<WorkflowExecution>;
  
  /**
   * Get workflow execution by ID
   * @throws Error if execution not found
   */
  getExecution(executionId: string): Promise<WorkflowExecution>;
  
  /**
   * Find workflow execution by correlation ID
   */
  findByCorrelationId(correlationId: string): Promise<WorkflowExecution | null>;
  
  /**
   * Update workflow execution context
   */
  updateContext(
    executionId: string,
    context: WorkflowContext
  ): Promise<void>;
  
  /**
   * Update workflow execution status
   */
  updateStatus(
    executionId: string,
    status: WorkflowExecutionStatus
  ): Promise<void>;
  
  /**
   * Create or update step execution record
   */
  upsertStepExecution(
    executionId: string,
    stepData: {
      stepName: string;
      stepIndex: number;
      status: StepExecutionStatus;
      inputData?: Record<string, unknown>;
      outputData?: Record<string, unknown>;
      errorMessage?: string;
      retryCount?: number;
      startedAt?: Date;
      completedAt?: Date;
      executionTimeMs?: number;
    }
  ): Promise<void>;

  /**
   * Complete workflow execution
   */
  completeExecution(
    executionId: string,
    result: WorkflowExecutionResult
  ): Promise<void>;
  
  /**
   * Fail workflow execution
   */
  failExecution(
    executionId: string,
    error: Error
  ): Promise<void>;
  
  /**
   * Pause workflow execution
   */
  pauseExecution(executionId: string): Promise<void>;
  
  /**
   * Resume workflow execution
   */
  resumeExecution(executionId: string): Promise<void>;
  
  /**
   * Cancel workflow execution
   */
  cancelExecution(executionId: string, reason: string): Promise<void>;
}

/**
 * In-Memory State Manager (for testing)
 * 
 * Simple in-memory implementation for unit tests and local development.
 * NOT for production use.
 */
export class InMemoryStateManager implements IStateManager {
  private executions: Map<string, WorkflowExecution> = new Map();
  private stepExecutions: Map<string, Array<Record<string, unknown>>> = new Map();
  
  async createExecution(params: {
    workflowId: string;
    workflowVersion: string;
    context: WorkflowContext;
    status: WorkflowExecutionStatus;
    startedAt: Date;
  }): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: params.context.executionId,
      tenantId: params.context.tenantId,
      workflowId: params.workflowId,
      workflowVersion: params.workflowVersion,
      status: params.status,
      context: params.context,
      startedAt: params.startedAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.executions.set(execution.id, execution);
    this.stepExecutions.set(execution.id, []);
    
    return execution;
  }
  
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Workflow execution not found: ${executionId}`);
    }
    return execution;
  }
  
  async findByCorrelationId(correlationId: string): Promise<WorkflowExecution | null> {
    for (const execution of this.executions.values()) {
      if (execution.context.correlationId === correlationId) {
        return execution;
      }
    }
    return null;
  }
  
  async updateContext(executionId: string, context: WorkflowContext): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.context = context;
    execution.updatedAt = new Date();
  }
  
  async updateStatus(executionId: string, status: WorkflowExecutionStatus): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = status;
    execution.updatedAt = new Date();
  }
  
  async upsertStepExecution(
    executionId: string,
    stepData: {
      stepName: string;
      stepIndex: number;
      status: StepExecutionStatus;
      inputData?: Record<string, unknown>;
      outputData?: Record<string, unknown>;
      errorMessage?: string;
      retryCount?: number;
      startedAt?: Date;
      completedAt?: Date;
      executionTimeMs?: number;
    }
  ): Promise<void> {
    const steps = this.stepExecutions.get(executionId) || [];
    
    // Find existing step
    const existingIndex = steps.findIndex(s => s.stepName === stepData.stepName);
    
    const stepExecution = {
      id: crypto.randomUUID(),
      workflowExecutionId: executionId,
      ...stepData,
      retryCount: stepData.retryCount ?? 0,
      createdAt: new Date()
    };
    
    if (existingIndex >= 0) {
      steps[existingIndex] = stepExecution;
    } else {
      steps.push(stepExecution);
    }
    
    this.stepExecutions.set(executionId, steps);
  }
  
  async completeExecution(
    executionId: string,
    _result: WorkflowExecutionResult
  ): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.updatedAt = new Date();
  }
  
  async failExecution(executionId: string, error: Error): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = 'failed';
    execution.errorMessage = error.message;
    execution.completedAt = new Date();
    execution.updatedAt = new Date();
  }
  
  async pauseExecution(executionId: string): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = 'paused';
    execution.updatedAt = new Date();
  }
  
  async resumeExecution(executionId: string): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = 'running';
    execution.updatedAt = new Date();
  }
  
  async cancelExecution(executionId: string, reason: string): Promise<void> {
    const execution = await this.getExecution(executionId);
    execution.status = 'cancelled';
    execution.errorMessage = reason;
    execution.completedAt = new Date();
    execution.updatedAt = new Date();
  }
  
  /**
   * Test helper: Clear all state
   */
  clear(): void {
    this.executions.clear();
    this.stepExecutions.clear();
  }
  
  /**
   * Test helper: Get all executions
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }
}
