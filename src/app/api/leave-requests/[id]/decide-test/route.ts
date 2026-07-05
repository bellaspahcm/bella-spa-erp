/**
 * Leave Request Decision Test API (Gate 1 Testing Only)
 * 
 * POST /api/leave-requests/[id]/decide-test
 * 
 * Bypasses authentication for Gate 1 validation.
 * Uses service role key for authorization.
 * 
 * Body:
 * {
 *   "approverId": "uuid",
 *   "approverRole": "manager",
 *   "tenantId": "uuid"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { LeaveApprovalIntegration } from '@/lib/decision-engine/integrations/leave-approval/LeaveApprovalIntegration';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify service role key
    const authHeader = request.headers.get('authorization');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid service role key' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { approverId, approverRole, tenantId } = body;

    if (!approverId || !approverRole || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: approverId, approverRole, tenantId' },
        { status: 400 }
      );
    }

    // Create admin Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[Gate1 Test] Request ID:', params.id);
    console.log('[Gate1 Test] Supabase URL:', supabaseUrl);
    console.log('[Gate1 Test] Service role key present:', !!serviceRoleKey);

    // Quick test: can we query leave_requests?
    const { data: testQuery, error: testError } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('id', params.id)
      .single();
    
    console.log('[Gate1 Test] Test query result:', testQuery);
    console.log('[Gate1 Test] Test query error:', testError);

    // Use Decision Engine for approval
    const integration = new LeaveApprovalIntegration(supabase);

    const result = await integration.approveLeaveRequest({
      requestId: params.id,
      approverId,
      approverRole,
      tenantId,
    });

    // Return result
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
    console.error('Leave decision test API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
