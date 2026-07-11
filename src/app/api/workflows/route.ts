/**
 * Workflow List API
 * 
 * GET /api/workflows
 * List workflow executions for current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowEngineService, WORKFLOW_ENGINE_FEATURE_FLAGS } from '@/services/workflow-engine-service';
import { createClient } from '@/lib/supabase-client';

/**
 * GET /api/workflows
 * List workflow executions
 * 
 * Query params:
 * - workflowId: Filter by workflow ID
 * - status: Filter by status (running, completed, failed, paused, cancelled)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
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

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'User tenant not found'
        },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const workflowId = searchParams.get('workflowId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // List workflow executions
    const workflowService = getWorkflowEngineService();
    const executions = (await workflowService.listExecutions(userData.tenant_id, {
      workflowId,
      status,
      limit,
      offset
    })) as unknown[];

    return NextResponse.json({
      success: true,
      data: executions,
      meta: {
        limit,
        offset,
        count: executions.length
      }
    });

  } catch (error) {
    console.error('[API] List workflows failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
