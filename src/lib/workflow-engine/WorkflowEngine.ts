/**
 * @fileoverview Workflow Engine Core Implementation
 * 
 * Central orchestration engine for multi-step business processes with
 * Decision Engine integration, state management, and error handling.
 * 
 * @module lib/workflow-engine/WorkflowEngine
 */

import { EventEmitter } from 'events';
import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowExecutionOptions,
  WorkflowStep,
  WorkflowStepType,
  StepExecutionResult,
  StepStatus,
  WorkflowStatus,
  WorkflowCondition,
  ConditionOperator,
  ActionRegistry,
  ActionHandler,
  WorkflowEngineConfig,
  WorkflowEvent,
  WorkflowEventType,
  RetryStrategy,
} from './types';
import { DecisionEngine } from '../decision-engine/DecisionEngine';
import type { DecisionContext } from '../decision-engine/types';

/**
 * Workflow Engine - Orchestrates multi-step business processes
 * 
 * Features:
 * - Step-based execution (decision/action/conditional/parallel/wait)
 * - Decision Engine integration
 * - State management and persistence
 * - Error handling and retry logic
 * - Event emission for observability
 * - Conditional branching
 * - Parallel execution
 * 
 * @example
 * ```typescript
 * const engine = new WorkflowEngine();
 * 
 * // Define workflow
 * const workflow: WorkflowDefinition = {
 *   id: 'booking-approval-flow',
 *   name: 'Booking Approval Workflow',
 *   version: '1.0.0',
 *   initialStep: 'check-capacity',
 *   steps: [
 *     {
 *       id: 'check-capacity',
 *       type: 'decision',
 *       name: 'Check Capacity',
 *       decision: {
 *         providerType: 'booking_capacity',
*         input: 'context.booking',
 *         outputVariable: 'capacityResult'
 *       }
 *     },
 *     {
 *       id: 'check-discount',
 *       type: 'decision',
 *       name: 'Check Discount Eligibility',
 *       decision: {
 *         providerType: 'discount_eligibility',
 *         input: 'context.customer',
 *         outputVariable: 'discountResult'
 *       }
 *     }
 *   ]
 * };
 * 
 * // Execute workflow
 * const context = await engine.execute(workflow, {
 *   tenantId: 'tenant-123',
 *   userId: 'user-456',
 *   input: {
 *     booking: { ... },
 *     customer: { ... }
 *   }
 * });
 * ```
 */
export class WorkflowEngine extends EventEmitter {
  private decisionEngine: DecisionEngine;
  private actionRegistry: Map<string, ActionHandler>;
  private workflowDefinitions: Map<string, WorkflowDefinition>;
  private runningWorkflows: Map<string, WorkflowContext>;
  private config: Required<WorkflowEngineConfig>;

  constructor(config: WorkflowEngineConfig = {}) {
    super();
    
    this.decisionEngine = new DecisionEngine();
    this.actionRegistry = new Map();
    this.workflowDefinitions = new Map();
    this.runningWorkflows = new Map();
    
    // Set default configuration
    this.config = {
      storage: config.storage || 'memory',
      defaultWorkflowTimeout: config.defaultWorkflowTimeout || 300000, // 5 minutes
      defaultStepTimeout: config.defaultStepTimeout || 30000, // 30 seconds
      defaultRetryStrategy: config.defaultRetryStrategy || {
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2.0
      },
      enableMetrics: config.enableMetrics ?? true,
      enableAuditTrail: config.enableAuditTrail ?? true,
      enableEvents: config.enableEvents ?? true,
      maxConcurrentWorkflows: config.maxConcurrentWorkflows || 100,
