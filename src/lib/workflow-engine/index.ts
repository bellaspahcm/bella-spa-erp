/**
 * Workflow Engine Platform - Main Exports
 * 
 * Stateful orchestration layer for multi-step business processes.
 * Complements Decision Engine by coordinating decisions across workflow steps.
 * 
 * @see docs/WORKFLOW_ENGINE_ARCHITECTURE.md
 */

// ============ Core Types ============
export type {
  WorkflowExecutionStatus,
  StepExecutionStatus,
  WorkflowContext,
  StepOutput,
  StepExecutionResult,
  WorkflowExecutionResult,
  RetryPolicy,
  IStep,
  WorkflowDefinition,
  WorkflowExecution,
  StepExecution
} from './types';

export { createWorkflowContext } from './types';

// ============ Core Engine ============
export { WorkflowEngine } from './workflow-engine';
export type { IWorkflowEngine } from './workflow-engine';

export { WorkflowExecutor, WorkflowExecutionError } from './workflow-executor';
export type { IWorkflowExecutor } from './workflow-executor';

// ============ State Management ============
export { InMemoryStateManager } from './state-manager';
export { SupabaseStateManager } from './supabase-state-manager';
export type { IStateManager } from './state-manager';

// ============ Step Types ============
export {
  DecisionStep,
  createDecisionStep,
  ActionStep,
  createActionStep,
  ConditionStep,
  createConditionStep,
  ParallelStep,
  createParallelStep
} from './steps';

export type {
  IDecisionEngine,
  DecisionContext,
  DecisionResult,
  DecisionStepConfig,
  ActionHandler,
  CompensationHandler,
  PredicateFunction,
  ParallelStrategy
} from './steps';

// ============ Legacy Action Interface (for backward compatibility) ============
export type {
  WorkflowContext as LegacyWorkflowContext,
  ActionConfig,
  ActionResult,
  ActionValidationResult,
  IWorkflowAction
} from './abstractions/IWorkflowAction';

export {
  WorkflowActionRegistry,
  BaseWorkflowAction,
  createActionConfig,
  createActionResult
} from './abstractions/IWorkflowAction';
