/**
 * POST /api/admin/partners/[id]/webhook-logs/[logId]/retry
 * 
 * Retry một webhook delivery cụ thể
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { APIErrorCode } from '@/types/api-gateway';

interface RouteContext {
  params: Promise<{
    id: string;
    logId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: partnerId, logId } = await context.params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001' as APIErrorCode,
          },
        },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Tenant not found',
            code: 'TENANT_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Role check
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Forbidden',
            code: 'AUTHZ_001' as APIErrorCode,
          },
        },
        { status: 403 }
      );
    }

    // Verify partner belongs to tenant
    const { data: partner } = await supabase
      .from('api_partners' as never)
      .select('id, webhook_url, webhook_secret')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!partner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Partner not found',
            code: 'VAL_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // In real implementation:
    // 1. Fetch webhook log from database
    // 2. Verify it belongs to this partner
    // 3. Check if retry is allowed (attempt < max_attempts)
    // 4. Send webhook request to partner's endpoint
    // 5. Update log with new attempt and result
    // 6. Return success/failure

    // Mock implementation
    console.log(`Retrying webhook ${logId} for partner ${partnerId}`);

    // Simulate webhook retry
    const retrySuccess = Math.random() > 0.3; // 70% success rate

    return NextResponse.json({
      success: true,
      data: {
        log_id: logId,
        retry_attempted: true,
        retry_success: retrySuccess,
        new_attempt_number: 2,
        response_status: retrySuccess ? 200 : 500,
        message: retrySuccess
          ? 'Webhook sent successfully'
          : 'Webhook retry failed, will retry again later',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Webhook retry API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001' as APIErrorCode,
        },
      },
      { status: 500 }
    );
  }
}
