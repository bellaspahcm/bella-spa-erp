/**
 * @fileoverview Workflow Engine Types
 * 
 * Type definitions for the Workflow Engine that orchestrates multi-step
 * business processes with Decision Engine integration.
 * 
 * @module lib/workflow-engine/types
 */

import type { DecisionResult } from '../decision-engine/types';

/**
 * Workflow step types
 */
export type WorkflowStepType = 
  | 'decision'      // Execute a Decision Engine provider
  | 'action'        // Execute a business action (DB update, API call, etc.)
  | 'conditional'   // Branch based on conditions
  | 'parallel'      // Execute multiple steps in parallel
  | 'wait';         // Wait for external event or human approval

/**
 * Workflow execution status
 */
export type WorkflowStatus = 
  | 'pending'       // Workflow created but not started
  | 'running'       // Currently executing
  | 'waiting'       // Waiting for external event/approval
  | 'completed'     // Successfully completed all steps
  | 'failed'        // Execution failed
  | 'cancelled'     // Manually cancelled
  | 'paused';       // Execution paused

/**
 * Step execution status
 */
export type StepStatus = 
  | 'pending'       // Not yet executed
  | 'running'       // Currently executing
  | 'completed'     // Successfully completed
  | 'failed'        // Execution failed
  | 'skipped';      // Skipped due to conditional logic

/**
 * Workflow execution status (alias used in state manager)
 */
export type WorkflowExecutionStatus = WorkflowStatus;

/**
 * Step execution status (alias used in state manager)
 */
export type StepExecutionStatus = StepStatus;

/**
 * Condition operators for branching logic
 */
export type ConditionOperator = 
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'in'
  | 'notIn';

/**
 * Condition definition for branching
 */
export interface WorkflowCondition {
  field: string;              // Field path in workflow context (e.g., 'decision.status')
  operator: ConditionOperator;
  value: unknown;             // Value to compare against
}

/**
 * Decision step configuration
 */
export interface DecisionStepConfig {
  providerType: string;       // e.g., 'booking_approval', 'discount_eligibility'
  input: Record<string, unknown> | string; // Input context or reference to workflow variables
  outputVariable?: string;    // Store result in this variable (default: step.id)
}

/**
 * Action step configuration
 */
export interface ActionStepConfig {
  actionType: string;         // e.g., 'update_booking', 'send_notification'
  input: Record<string, unknown> | string;
  outputVariable?: string;
}

/**
 * Conditional step configuration
 */
export interface ConditionalStepConfig {
  conditions: WorkflowCondition[];
  matchAll?: boolean;         // AND (true) vs OR (false) logic
  thenSteps: string[];        // Step IDs to execute if condition passes
  elseSteps?: string[];       // Step IDs to execute if condition fails
}

/**
 * Parallel step configuration
 */
export interface ParallelStepConfig {
  steps: string[];            // Step IDs to execute in parallel
  waitForAll?: boolean;       // Wait for all (true) vs any (false)
}

/**
 * Wait step configuration
 */
export interface WaitStepConfig {
  eventType?: string;         // Wait for specific event type
  timeout?: number;           // Timeout in milliseconds
  condition?: WorkflowCondition; // Optional condition to proceed
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name: string;
  description?: string;
  
  // Type-specific configuration
  decision?: DecisionStepConfig;
  action?: ActionStepConfig;
  conditional?: ConditionalStepConfig;
  parallel?: ParallelStepConfig;
  wait?: WaitStepConfig;
  
  // Execution behavior
  retryStrategy?: RetryStrategy;
  timeout?: number;           // Step-level timeout (ms)
  
  // Error handling
  onError?: 'fail' | 'continue' | 'retry';
  fallbackStep?: string;      // Step ID to execute on error
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number; // Exponential backoff (default: 1.0 = no backoff)
  backoff?: 'linear' | 'exponential';
  maxDelayMs?: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Whether the workflow completed successfully */
  success?: boolean;
  /** Execution ID (workflow_executions table row id) */
  executionId?: string;
  /** Final workflow status */
  status?: WorkflowExecutionStatus;
  /** Output data produced by the workflow */
  output?: Record<string, unknown>;
  /** Error message if the workflow failed */
  error?: string;
  /** Step-level results (alias: steps) */
  stepResults?: StepExecutionResult[];
  /** Step-level results (used by executor) */
  steps?: StepExecutionResult[];
  /** Execution duration in milliseconds (alias: executionTime) */
  executionTimeMs?: number;
  /** Execution duration in milliseconds (used by executor) */
  executionTime?: number;
}

/**
 * Retry policy alias
 */
export type RetryPolicy = RetryStrategy;

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  
  // Workflow metadata
  tags?: string[];
  createdBy?: string;
  createdAt?: Date;
  
  // Workflow structure
  steps: IStep[];             // Using executable steps interface
  initialStep?: string;       // ID of first step to execute
  
  // Global configuration
  timeout?: number;           // Workflow-level timeout (ms)
  retryStrategy?: RetryStrategy;
  defaultRetryPolicy?: RetryStrategy;
  
  // Variables and context
  inputSchema?: Record<string, unknown>; // JSON Schema for input validation
  outputSchema?: Record<string, unknown>; // JSON Schema for output validation
  metadata?: Record<string, unknown>;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  stepName: string;
  status: StepStatus;
  output?: unknown;               // Step output data
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  executionTime?: number;     // Execution time in ms
  retryCount?: number;
  shouldPause?: boolean;
  shouldSkipRemainingSteps?: boolean;
  nextStepName?: string;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  workflowVersion?: string;
  executionId: string;
  tenantId: string;
  userId?: string;
  correlationId: string;
  currentStepIndex: number;
  data: Record<string, unknown>;
  stepResults: StepExecutionResult[];
  metadata?: Record<string, unknown>;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  tenantId: string;
  userId?: string;
  input: Record<string, unknown>;
  
  // Execution behavior
  async?: boolean;            // Run asynchronously (default: true)
  timeout?: number;           // Override workflow timeout
  
  // Observability
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.step.started'
  | 'workflow.step.completed'
  | 'workflow.step.failed'
  | 'workflow.step.skipped'
  | 'workflow.step.retrying';

/**
 * Workflow event payload
 */
export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  timestamp: Date;
  payload?: unknown;
  data: unknown;
  tenantId: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Workflow action handler
 */
export type ActionHandler = (
  config: ActionStepConfig,
  context: WorkflowContext
) => Promise<unknown>;

/**
 * Workflow action registry
 */
export interface ActionRegistry {
  register(actionType: string, handler: ActionHandler): void;
  get(actionType: string): ActionHandler | undefined;
  has(actionType: string): boolean;
}

/**
 * Workflow engine configuration
 */
export interface WorkflowEngineConfig {
  // Storage backend (in-memory for now, DB later)
  storage?: 'memory' | 'database';
  
  // Default timeouts
  defaultWorkflowTimeout?: number;
  defaultStepTimeout?: number;
  
  // Retry defaults
  defaultRetryStrategy?: RetryStrategy;
  
  // Observability
  enableMetrics?: boolean;
  enableAuditTrail?: boolean;
  enableEvents?: boolean;
  
  // Performance
  maxConcurrentWorkflows?: number;
  maxParallelSteps?: number;
}

/**
 * IStep abstraction interface
 */
export interface IStep {
  name: string;
  type: string;
  description?: string;
  retryPolicy?: RetryStrategy;
  continueOnError?: boolean;
  execute(context: WorkflowContext): Promise<StepOutput>;
  compensate?(context: WorkflowContext): Promise<void>;
}

/**
 * Step execution output
 */
export interface StepOutput {
  [key: string]: unknown;
  _control?: {
    pause?: boolean;
    skipRemaining?: boolean;
    nextStepName?: string;
  };
}

/**
 * Workflow execution record
 */
export interface WorkflowExecution {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowExecutionStatus;
  context: WorkflowContext;
  result?: WorkflowExecutionResult;
  startedAt: Date;
  completedAt?: Date;
  pausedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Step execution record
 */
export interface StepExecution {
  id: string;
  workflowExecutionId: string;
  stepName: string;
  stepIndex: number;
  status: StepExecutionStatus;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  createdAt: Date;
}

/**
 * Helper to initialize workflow context
 */
export function createWorkflowContext(params: Partial<WorkflowContext> & Pick<WorkflowContext, 'workflowId' | 'tenantId'>): WorkflowContext {
  return {
    executionId: params.executionId ?? crypto.randomUUID(),
    workflowId: params.workflowId,
    workflowVersion: params.workflowVersion ?? '1.0.0',
    tenantId: params.tenantId,
    userId: params.userId,
    correlationId: params.correlationId ?? crypto.randomUUID(),
    currentStepIndex: params.currentStepIndex ?? 0,
    data: params.data ?? {},
    stepResults: params.stepResults ?? [],
    metadata: params.metadata
  };
}
