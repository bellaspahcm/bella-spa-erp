/**
 * Leave Request Decision API
 * 
 * POST /api/leave-requests/[id]/decide
 * 
 * Uses Decision Engine to approve/reject leave requests.
 * 
 * Body:
 * {
 *   "action": "approve" | "reject"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "approved": true,
 *   "reason": "All approval criteria met",
 *   "decisionId": "dec_abc123",
 *   "metadata": {
 *     "confidence": 0.95,
 *     "executionTimeMs": 42
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { LeaveApprovalIntegration } from '@/lib/decision-engine/integrations/leave-approval/LeaveApprovalIntegration';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // 1. Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get user profile (for role and tenant)
    const { data: profile } = await supabase
      .from('users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!profile.tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID not found' },
        { status: 400 }
      );
    }

    // 3. Use Decision Engine for approval
    const integration = new LeaveApprovalIntegration(supabase);

    const result = await integration.approveLeaveRequest({
      requestId: params.id,
      approverId: user.id,
      approverRole: profile.role,
      tenantId: profile.tenant_id,
    });

    // 4. Return result
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.reason,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      approved: result.approved,
      reason: result.reason,
      decisionId: result.decisionId,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Leave decision API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
