/**
 * Supabase State Manager
 * 
 * Production implementation of IStateManager using Supabase database.
 * Persists workflow execution state to workflow_executions and workflow_step_executions tables.
 * 
 * Architecture Compliance:
 * - Follows Principle #8: Engine never accesses database directly
 * - All DB operations abstracted behind IStateManager interface
 * - Supports transactions for atomicity
 * - Full audit trail via database records
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { IStateManager } from './state-manager';
import type {
  WorkflowExecution,
  WorkflowContext,
  WorkflowExecutionStatus,
  WorkflowExecutionResult,
  StepExecutionStatus
} from './types';

/**
 * Database row types for workflow engine tables.
 * These tables are not in the auto-generated schema types, so we
 * define them here and type-assert query results to these interfaces.
 */
interface WorkflowExecutionRow {
  id: string;
  tenant_id: string;
  workflow_id: string;
  workflow_version: string;
  status: WorkflowExecutionStatus;
  context: WorkflowContext;
  result?: WorkflowExecutionResult;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  paused_at?: string;
  created_at: string;
  updated_at: string;
}

interface StepExecutionRow {
  id: string;
  workflow_execution_id: string;
  step_name: string;
  step_index: number;
  status: StepExecutionStatus;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  created_at: string;
  updated_at: string;
}

/** Helper: type-assert raw Supabase result to our typed row */
function asWorkflowRow(data: unknown): WorkflowExecutionRow {
  return data as WorkflowExecutionRow;
}

function asStepRow(data: unknown): StepExecutionRow {
  return data as StepExecutionRow;
}

/**
 * Supabase State Manager
 *
 * Production-ready state persistence using Supabase PostgreSQL.
 * Uses base SupabaseClient (without generated schema generics) since the
 * workflow_executions and workflow_step_executions tables are not yet
 * in the auto-generated database types. Results are type-asserted to
 * the WorkflowExecutionRow / StepExecutionRow interfaces above.
 */
export class SupabaseStateManager implements IStateManager {
  // SupabaseClient without schema generic — library default handles table typing.
  // We type-assert results instead of relying on generated schema types.
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create new workflow execution record
   */
  async createExecution(params: {
    workflowId: string;
    workflowVersion: string;
    context: WorkflowContext;
    status: WorkflowExecutionStatus;
    startedAt: Date;
  }): Promise<WorkflowExecution> {
    const now = new Date().toISOString();
    
    const row: Partial<WorkflowExecutionRow> = {
      id: params.context.executionId,
      tenant_id: params.context.tenantId,
      workflow_id: params.workflowId,
      workflow_version: params.workflowVersion,
      status: params.status,
      context: params.context,
      started_at: params.startedAt.toISOString(),
      created_at: now,
      updated_at: now
    };

    const { data, error } = await this.client
      .from('workflow_executions')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create workflow execution: ${error.message}`);
    }

    return this.mapRowToExecution(asWorkflowRow(data));
  }

  /**
   * Get workflow execution by ID
   * @throws Error if execution not found
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    const { data, error } = await this.client
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) {
      throw new Error(`Failed to get workflow execution: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Workflow execution not found: ${executionId}`);
    }

    return this.mapRowToExecution(asWorkflowRow(data));
  }

  /**
   * Find workflow execution by correlation ID
   */
  async findByCorrelationId(correlationId: string): Promise<WorkflowExecution | null> {
    const { data, error } = await this.client
      .from('workflow_executions')
      .select('*')
      .eq('context->>correlationId', correlationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Not found is OK
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find workflow execution: ${error.message}`);
    }

    return data ? this.mapRowToExecution(asWorkflowRow(data)) : null;
  }

  /**
   * Update workflow execution context
   */
  async updateContext(
    executionId: string,
    context: WorkflowContext
  ): Promise<void> {
    const { error } = await this.client
      .from('workflow_executions')
      .update({
        context,
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      throw new Error(`Failed to update workflow context: ${error.message}`);
    }
  }

  /**
   * Update workflow execution status
   */
  async updateStatus(
    executionId: string,
    status: WorkflowExecutionStatus
  ): Promise<void> {
    const { error } = await this.client
      .from('workflow_executions')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      throw new Error(`Failed to update workflow status: ${error.message}`);
    }
  }

  /**
   * Create or update step execution record
   */
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
    const now = new Date().toISOString();

    const row: Partial<StepExecutionRow> = {
      workflow_execution_id: executionId,
      step_name: stepData.stepName,
      step_index: stepData.stepIndex,
      status: stepData.status,
      input_data: stepData.inputData,
      output_data: stepData.outputData,
      error_message: stepData.errorMessage,
      retry_count: stepData.retryCount ?? 0,
      started_at: stepData.startedAt?.toISOString(),
      completed_at: stepData.completedAt?.toISOString(),
      execution_time_ms: stepData.executionTimeMs,
      updated_at: now
    };

    // Try to find existing step execution
    const { data: existing } = await this.client
      .from('workflow_step_executions')
      .select('id')
      .eq('workflow_execution_id', executionId)
      .eq('step_name', stepData.stepName)
      .single();

    if (existing) {
      // Update existing
      const existingRow = asStepRow(existing);
      const { error } = await this.client
        .from('workflow_step_executions')
        .update(row)
        .eq('id', existingRow.id);

      if (error) {
        throw new Error(`Failed to update step execution: ${error.message}`);
      }
    } else {
      // Insert new
      const { error } = await this.client
        .from('workflow_step_executions')
        .insert({
          ...row,
          created_at: now
        });

      if (error) {
        throw new Error(`Failed to insert step execution: ${error.message}`);
      }
    }
  }

  /**
   * Complete workflow execution
   */
  async completeExecution(
    executionId: string,
    result: WorkflowExecutionResult
  ): Promise<void> {
    const { error } = await this.client
      .from('workflow_executions')
      .update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      throw new Error(`Failed to complete workflow execution: ${error.message}`);
    }
  }

  /**
   * Fail workflow execution
   */
  async failExecution(
    executionId: string,
    error: Error
  ): Promise<void> {
    const { error: dbError } = await this.client
      .from('workflow_executions')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (dbError) {
      throw new Error(`Failed to mark workflow as failed: ${dbError.message}`);
    }
  }

  /**
   * Pause workflow execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const { error } = await this.client
      .from('workflow_executions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      throw new Error(`Failed to pause workflow execution: ${error.message}`);
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const { error } = await this.client
      .from('workflow_executions')
      .update({
        status: 'running',
        paused_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      throw new Error(`Failed to resume workflow execution: ${error.message}`);
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelExecution(executionId: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        error_message: reason,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      throw new Error(`Failed to cancel workflow execution: ${error.message}`);
    }
  }

  /**
   * Map database row to WorkflowExecution
   */
  private mapRowToExecution(row: WorkflowExecutionRow): WorkflowExecution {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      workflowId: row.workflow_id,
      workflowVersion: row.workflow_version,
      status: row.status,
      context: row.context,
      result: row.result,
      errorMessage: row.error_message,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
