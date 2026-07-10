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
  | 'cancelled';    // Manually cancelled

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
  value: any;                 // Value to compare against
}

/**
 * Decision step configuration
 */
export interface DecisionStepConfig {
  providerType: string;       // e.g., 'booking_approval', 'discount_eligibility'
  input: Record<string, any> | string; // Input context or reference to workflow variables
  outputVariable?: string;    // Store result in this variable (default: step.id)
}

/**
 * Action step configuration
 */
export interface ActionStepConfig {
  actionType: string;         // e.g., 'update_booking', 'send_notification'
  input: Record<string, any> | string;
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
}

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
  steps: WorkflowStep[];
  initialStep: string;        // ID of first step to execute
  
  // Global configuration
  timeout?: number;           // Workflow-level timeout (ms)
  retryStrategy?: RetryStrategy;
  
  // Variables and context
  inputSchema?: Record<string, any>; // JSON Schema for input validation
  outputSchema?: Record<string, any>; // JSON Schema for output validation
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  stepId: string;
  status: StepStatus;
  output?: any;               // Step output data
  error?: Error;
  startedAt: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  retryCount?: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  
  // Execution state
  status: WorkflowStatus;
  currentStep?: string;
  variables: Record<string, any>; // Workflow variables
  
  // Execution history
  stepResults: StepExecutionResult[];
  
  // Metadata
  startedAt: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  
  // Error tracking
  errors?: Error[];
  
  // Tenant isolation
  tenantId: string;
  userId?: string;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  tenantId: string;
  userId?: string;
  input: Record<string, any>;
  
  // Execution behavior
  async?: boolean;            // Run asynchronously (default: true)
  timeout?: number;           // Override workflow timeout
  
  // Observability
  traceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.skipped';

/**
 * Workflow event payload
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowId: string;
  executionId: string;
  stepId?: string;
  timestamp: Date;
  payload: any;
  tenantId: string;
  userId?: string;
}

/**
 * Workflow action handler
 */
export type ActionHandler = (
  config: ActionStepConfig,
  context: WorkflowContext
) => Promise<any>;

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
