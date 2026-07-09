/**
 * Workflow Engine Core Types
 * 
 * Type definitions for Workflow Engine Platform following Decision Engine patterns.
 * Stateful orchestration layer for multi-step business processes.
 * 
 * @see docs/WORKFLOW_ENGINE_ARCHITECTURE.md
 */

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Step execution status
 */
export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Workflow context (execution state + shared data)
 */
export interface WorkflowContext {
  /** Unique workflow execution ID */
  executionId: string;
  
  /** Workflow definition ID */
  workflowId: string;
  
  /** Workflow version */
  workflowVersion: string;
  
  /** Tenant context */
  tenantId: string;
  
  /** User who triggered workflow */
  userId?: string;
  
  /** Correlation ID for tracing */
  correlationId: string;
  
  /** Current step index */
  currentStepIndex: number;
  
  /** Shared data (mutable, passed between steps) */
  data: Record<string, unknown>;
  
  /** Step execution results (immutable history) */
  stepResults: StepExecutionResult[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Step output (returned by IStep.execute())
 */
export interface StepOutput {
  /** Output data to merge into workflow context */
  [key: string]: unknown;
  
  /** Special control flags (optional) */
  _control?: {
    /** Pause workflow after this step */
    pause?: boolean;
    
    /** Skip remaining steps */
    skipRemaining?: boolean;
    
    /** Jump to specific step by name */
    nextStepName?: string;
  };
}

/**
 * Step execution result (stored in context.stepResults)
 */
export interface StepExecutionResult {
  /** Step name */
  stepName: string;
  
  /** Execution status */
  status: StepExecutionStatus;
  
  /** Output data (if completed) */
  output?: Record<string, unknown>;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Execution time in milliseconds */
  executionTime?: number;
  
  /** Retry count */
  retryCount?: number;
  
  /** Whether step should pause workflow */
  shouldPause?: boolean;
  
  /** Next step name (for conditional branching) */
  nextStepName?: string;
  
  /** Whether to skip remaining steps */
  shouldSkipRemainingSteps?: boolean;
}

/**
 * Workflow execution result (returned by WorkflowEngine.execute())
 */
export interface WorkflowExecutionResult {
  /** Execution ID */
  executionId: string;
  
  /** Execution status */
  status: WorkflowExecutionStatus;
  
  /** Output data (final context.data) */
  output?: Record<string, unknown>;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Step execution results */
  steps: StepExecutionResult[];
  
  /** Total execution time in milliseconds */
  executionTime?: number;
}

/**
 * Retry policy for step execution
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  maxAttempts: number;
  
  /** Initial delay in milliseconds */
  delayMs: number;
  
  /** Backoff strategy */
  backoff?: 'linear' | 'exponential';
  
  /** Maximum delay cap (for exponential backoff) */
  maxDelayMs?: number;
  
  /** Retry only on specific error types */
  retryOn?: (error: Error) => boolean;
}

/**
 * Step interface (base abstraction for all workflow steps)
 */
export interface IStep {
  /** Unique step name */
  name: string;
  
  /** Step type (for logging/debugging) */
  type: 'decision' | 'action' | 'condition' | 'parallel';
  
  /** Step description (optional) */
  description?: string;
  
  /** Retry policy (optional) */
  retryPolicy?: RetryPolicy;
  
  /** Continue workflow even if this step fails */
  continueOnError?: boolean;
  
  /** Execute the step logic */
  execute(context: WorkflowContext): Promise<StepOutput>;
  
  /** Compensation logic (rollback) - optional */
  compensate?(context: WorkflowContext): Promise<void>;
}

/**
 * Workflow definition (declarative DSL)
 */
export interface WorkflowDefinition {
  /** Unique workflow ID */
  id: string;
  
  /** Workflow version (semver) */
  version: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Workflow steps (executed in order) */
  steps: IStep[];
  
  /** Default retry policy for all steps */
  defaultRetryPolicy?: RetryPolicy;
  
  /** Workflow timeout (ms) */
  timeout?: number;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow execution record (stored in database)
 */
export interface WorkflowExecution {
  /** Unique execution ID */
  id: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Workflow definition ID */
  workflowId: string;
  
  /** Workflow version */
  workflowVersion: string;
  
  /** Execution status */
  status: WorkflowExecutionStatus;
  
  /** Workflow context */
  context: WorkflowContext;
  
  /** Started timestamp */
  startedAt: Date;
  
  /** Completed timestamp */
  completedAt?: Date;
  
  /** Error message (if failed) */
  errorMessage?: string;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Step execution record (stored in database)
 */
export interface StepExecution {
  /** Unique step execution ID */
  id: string;
  
  /** Workflow execution ID (FK) */
  workflowExecutionId: string;
  
  /** Step name */
  stepName: string;
  
  /** Step index */
  stepIndex: number;
  
  /** Execution status */
  status: StepExecutionStatus;
  
  /** Input data */
  inputData?: Record<string, unknown>;
  
  /** Output data */
  outputData?: Record<string, unknown>;
  
  /** Error message (if failed) */
  errorMessage?: string;
  
  /** Retry count */
  retryCount: number;
  
  /** Started timestamp */
  startedAt?: Date;
  
  /** Completed timestamp */
  completedAt?: Date;
  
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Helper: Create initial workflow context
 */
export function createWorkflowContext(
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
