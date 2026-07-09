/**
 * Workflow Engine Production Service
 * 
 * Production-ready service for executing Workflow Engine workflows.
 * Provides:
 * - Production state manager (Supabase)
 * - Business service integrations
 * - Feature flag support
 * - Error handling and logging
 * - Monitoring integration
 */

import { WorkflowEngine, SupabaseStateManager } from '@/lib/workflow-engine';
import type { WorkflowDefinition, WorkflowContext, WorkflowExecutionResult } from '@/lib/workflow-engine';
import { createClient } from '@/lib/supabase-client';

/**
 * Feature flags for workflow engine
 */
export const WORKFLOW_ENGINE_FEATURE_FLAGS = {
  ENABLED: process.env.FEATURE_WORKFLOW_ENGINE === 'true',
  BOOKING_TO_FULFILLMENT: process.env.FEATURE_WF_BOOKING_FULFILLMENT === 'true',
} as const;

/**
 * Workflow Engine Service Configuration
 */
interface WorkflowEngineServiceConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

/**
 * Workflow Engine Production Service
 */
export class WorkflowEngineService {
  private engine: WorkflowEngine | null = null;
  private stateManager: SupabaseStateManager | null = null;
  private config: WorkflowEngineServiceConfig;

  constructor(config: WorkflowEngineServiceConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize workflow engine with production state manager
   */
  private initialize(): void {
    if (!WORKFLOW_ENGINE_FEATURE_FLAGS.ENABLED) {
      console.log('[WorkflowEngine] Feature flag disabled, skipping initialization');
      return;
    }

    try {
      // Create Supabase state manager
      this.stateManager = new SupabaseStateManager(
        this.config.supabaseUrl,
        this.config.supabaseServiceRoleKey
      );

      // Create workflow engine
      this.engine = new WorkflowEngine(this.stateManager, {
        enableLogging: this.config.enableLogging ?? true,
        enableMetrics: this.config.enableMetrics ?? true
      });

      console.log('[WorkflowEngine] Initialized successfully');
    } catch (error) {
      console.error('[WorkflowEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute a workflow
   * 
   * @param workflow - Workflow definition
   * @param context - Initial workflow context
   * @returns Workflow execution result
   */
  async execute(
    workflow: WorkflowDefinition,
    context: Partial<WorkflowContext>
  ): Promise<WorkflowExecutionResult> {
    if (!this.engine) {
      throw new Error('Workflow Engine not initialized. Check feature flags.');
    }

    const startTime = Date.now();

    try {
      console.log(`[WorkflowEngine] Starting workflow: ${workflow.id}`, {
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });

      const result = await this.engine.execute(workflow, context);

      const executionTime = Date.now() - startTime;
      console.log(`[WorkflowEngine] Workflow completed: ${workflow.id}`, {
        status: result.status,
        executionTime,
        stepCount: result.steps?.length
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[WorkflowEngine] Workflow failed: ${workflow.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        tenantId: context.tenantId
      });

      throw error;
    }
  }

  /**
   * Resume a paused workflow
   * 
   * @param executionId - Workflow execution ID
   * @returns Workflow execution result
   */
  async resume(executionId: string): Promise<WorkflowExecutionResult> {
    if (!this.engine) {
      throw new Error('Workflow Engine not initialized. Check feature flags.');
    }

    console.log(`[WorkflowEngine] Resuming workflow: ${executionId}`);

    try {
      const result = await this.engine.resume(executionId);

      console.log(`[WorkflowEngine] Workflow resumed: ${executionId}`, {
        status: result.status
      });

      return result;
    } catch (error) {
      console.error(`[WorkflowEngine] Resume failed: ${executionId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Cancel a running workflow
   * 
   * @param executionId - Workflow execution ID
   * @param reason - Cancellation reason
   */
  async cancel(executionId: string, reason: string): Promise<void> {
    if (!this.engine) {
      throw new Error('Workflow Engine not initialized. Check feature flags.');
    }

    console.log(`[WorkflowEngine] Cancelling workflow: ${executionId}`, { reason });

    try {
      await this.engine.cancel(executionId, reason);

      console.log(`[WorkflowEngine] Workflow cancelled: ${executionId}`);
    } catch (error) {
      console.error(`[WorkflowEngine] Cancel failed: ${executionId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Get workflow execution details
   * 
   * @param executionId - Workflow execution ID
   * @returns Workflow execution with steps
   */
  async getExecution(executionId: string) {
    if (!this.stateManager) {
      throw new Error('Workflow Engine not initialized. Check feature flags.');
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_workflow_execution_detail', {
      p_execution_id: executionId
    });

    if (error) {
      throw new Error(`Failed to get workflow execution: ${error.message}`);
    }

    return data;
  }

  /**
   * List workflow executions for a tenant
   * 
   * @param tenantId - Tenant ID
   * @param options - Query options
   * @returns List of workflow executions
   */
  async listExecutions(
    tenantId: string,
    options?: {
      workflowId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_workflow_executions', {
      p_tenant_id: tenantId,
      p_workflow_id: options?.workflowId ?? null,
      p_status: options?.status ?? null,
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0
    });

    if (error) {
      throw new Error(`Failed to list workflow executions: ${error.message}`);
    }

    return data;
  }

  /**
   * Check if workflow engine is enabled
   */
  isEnabled(): boolean {
    return WORKFLOW_ENGINE_FEATURE_FLAGS.ENABLED && this.engine !== null;
  }
}

/**
 * Create default workflow engine service instance
 */
export function createWorkflowEngineService(): WorkflowEngineService {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase configuration. Check environment variables.');
  }

  return new WorkflowEngineService({
    supabaseUrl,
    supabaseServiceRoleKey,
    enableLogging: process.env.NODE_ENV !== 'production',
    enableMetrics: true
  });
}

/**
 * Singleton instance for production use
 */
let workflowEngineServiceInstance: WorkflowEngineService | null = null;

/**
 * Get workflow engine service singleton
 */
export function getWorkflowEngineService(): WorkflowEngineService {
  if (!workflowEngineServiceInstance) {
    workflowEngineServiceInstance = createWorkflowEngineService();
  }

  return workflowEngineServiceInstance;
}
