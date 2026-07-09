/**
 * Workflow Execution API
 * 
 * POST /api/workflows/execute
 * Execute a workflow by ID with provided context
 * 
 * Feature flags:
 * - FEATURE_WORKFLOW_ENGINE: Enable workflow engine
 * - FEATURE_WF_BOOKING_FULFILLMENT: Enable booking fulfillment workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowEngineService, WORKFLOW_ENGINE_FEATURE_FLAGS } from '@/services/workflow-engine-service';
import { executeBookingFulfillment } from '@/services/workflows/booking-fulfillment-workflow';
import { createClient } from '@/lib/supabase/server';

/**
 * Execute workflow request body
 */
interface ExecuteWorkflowRequest {
  workflowId: string;
  tenantId: string;
  userId?: string;
  correlationId?: string;
  data: Record<string, unknown>;
}

/**
 * POST /api/workflows/execute
 * Execute a workflow
 */
export async function POST(request: NextRequest) {
  try {
    // Check if workflow engine is enabled
    if (!WORKFLOW_ENGINE_FEATURE_FLAGS.ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow Engine is disabled. Enable FEATURE_WORKFLOW_ENGINE=true'
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body: ExecuteWorkflowRequest = await request.json();

    // Validate required fields
    if (!body.workflowId || !body.tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workflowId, tenantId'
        },
        { status: 400 }
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

    // Route to specific workflow implementation
    let result;

    switch (body.workflowId) {
      case 'booking-to-fulfillment-v1': {
        // Check feature flag
        if (!WORKFLOW_ENGINE_FEATURE_FLAGS.BOOKING_TO_FULFILLMENT) {
          return NextResponse.json(
            {
              success: false,
              error: 'Booking fulfillment workflow is disabled. Enable FEATURE_WF_BOOKING_FULFILLMENT=true'
            },
            { status: 503 }
          );
        }

        // Execute booking fulfillment workflow
        const bookingId = body.data.bookingId as string;
        
        if (!bookingId) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing bookingId in data'
            },
            { status: 400 }
          );
        }

        result = await executeBookingFulfillment({
          bookingId,
          tenantId: body.tenantId,
          userId: body.userId || user.id
        });

        break;
      }

      default: {
        return NextResponse.json(
          {
            success: false,
            error: `Unknown workflow ID: ${body.workflowId}`
          },
          { status: 404 }
        );
      }
    }

    // Return result
    return NextResponse.json({
      success: true,
      data: {
        executionId: result.executionId,
        status: result.status,
        output: result.output,
        steps: result.steps?.map(step => ({
          name: step.stepName,
          status: step.status,
          executionTime: step.executionTime
        }))
      }
    });

  } catch (error) {
    console.error('[API] Workflow execution failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
