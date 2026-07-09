/**
 * Workflow Execution Details API
 * 
 * GET /api/workflows/:executionId
 * Get workflow execution details including all step executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowEngineService, WORKFLOW_ENGINE_FEATURE_FLAGS } from '@/services/workflow-engine-service';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/workflows/:executionId
 * Get workflow execution details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    // Check if workflow engine is enabled
    if (!WORKFLOW_ENGINE_FEATURE_FLAGS.ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow Engine is disabled'
        },
        { status: 503 }
      );
    }

    const { executionId } = params;

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized'
        },
        { status: 401 }
      );
    }

    // Get workflow execution details
    const workflowService = getWorkflowEngineService();
    const execution = await workflowService.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow execution not found'
        },
        { status: 404 }
      );
    }

    // Return execution details
    return NextResponse.json({
      success: true,
      data: execution
    });

  } catch (error) {
    console.error('[API] Get workflow execution failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/:executionId
 * Cancel a running workflow execution
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    // Check if workflow engine is enabled
    if (!WORKFLOW_ENGINE_FEATURE_FLAGS.ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow Engine is disabled'
        },
        { status: 503 }
      );
    }

    const { executionId } = params;

    // Parse request body
    const body = await request.json();
    const reason = body.reason || 'Cancelled by user';

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized'
        },
        { status: 401 }
      );
    }

    // Cancel workflow execution
    const workflowService = getWorkflowEngineService();
    await workflowService.cancel(executionId, reason);

    return NextResponse.json({
      success: true,
      message: 'Workflow cancelled successfully'
    });

  } catch (error) {
    console.error('[API] Cancel workflow execution failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
