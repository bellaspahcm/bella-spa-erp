/**
 * Leave Request Decision Gate 2 Test API (Failure Injection Testing)
 * 
 * POST /api/leave-requests/[id]/decide-gate2
 * 
 * Allows failure injection for Gate 2 chaos testing via special header.
 * Uses service role key for authorization.
 * 
 * Headers:
 * - X-Gate2-Audit-Fail: "true" - Forces audit logger to fail
 * - X-Gate2-Audit-Timeout: "<ms>" - Forces audit logger to timeout after X ms
 * 
 * Body:
 * {
 *   "approverId": "uuid",
 *   "approverRole": "manager",
 *   "tenantId": "uuid"
 * }
 * 
 * Expected behavior:
 * - Decision ALWAYS succeeds (HTTP 200) even if audit fails
 * - Audit failures are handled by resilient logger (circuit breaker, retry queue)
 * - Health endpoint shows degraded status when audit fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LeaveApprovalIntegration } from '@/lib/decision-engine/integrations/leave-approval/LeaveApprovalIntegration';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const params = await context.params;
    
    // Verify secret key
    const authHeader = request.headers.get('authorization');
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!authHeader || !authHeader.includes(secretKey || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid secret key' },
        { status: 401 }
      );
    }

    // Parse failure injection headers
    const auditFail = request.headers.get('X-Gate2-Audit-Fail') === 'true';
    const auditTimeoutStr = request.headers.get('X-Gate2-Audit-Timeout');
    const auditTimeout = auditTimeoutStr ? parseInt(auditTimeoutStr, 10) : undefined;

    // Inject failure flags into global state (temporary for this request)
    if (auditFail || auditTimeout) {
      // @ts-ignore - Injecting test flags
      globalThis.__GATE2_AUDIT_FAIL__ = auditFail;
      // @ts-ignore
      globalThis.__GATE2_AUDIT_TIMEOUT__ = auditTimeout;
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

    // Create normal Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabase = createClient(supabaseUrl, secretKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[Gate2 Test] Request ID:', params.id);
    console.log('[Gate2 Test] Audit Fail Injection:', auditFail);
    console.log('[Gate2 Test] Audit Timeout Injection:', auditTimeout);

    // Use Decision Engine for approval
    const integration = new LeaveApprovalIntegration(supabase);

    const result = await integration.approveLeaveRequest({
      requestId: params.id,
      approverId,
      approverRole,
      tenantId,
    });

    // Clean up global test flags
    // @ts-ignore
    delete globalThis.__GATE2_AUDIT_FAIL__;
    // @ts-ignore
    delete globalThis.__GATE2_AUDIT_TIMEOUT__;

    // IMPORTANT: Even if audit fails, decision should succeed
    // The resilient audit logger handles failures gracefully
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
      gate2Meta: {
        auditFailInjected: auditFail || !!auditTimeout,
        auditTimeoutMs: auditTimeout,
      },
    });
  } catch (error) {
    console.error('[Gate2 Test] Decision API error:', error);
    
    // CRITICAL: Decision API should NEVER crash due to audit failures
    // This catch block should only trigger for actual business logic errors
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        gate2Meta: {
          criticalFailure: true,
          message: 'Decision API crashed - this should NEVER happen in Gate 2',
        },
      },
      { status: 500 }
    );
  }
}
