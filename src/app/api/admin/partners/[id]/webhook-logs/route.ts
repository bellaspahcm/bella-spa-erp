/**
 * GET /api/admin/partners/[id]/webhook-logs
 * 
 * Lấy tất cả webhook delivery logs của partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { APIErrorCode } from '@/types/api-gateway';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: partnerId } = await context.params;
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
      .select('id')
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

    // Fetch webhook logs (hypothetical table structure)
    // In real implementation, this would query api_webhook_logs table
    const mockLogs = generateMockWebhookLogs(partnerId);

    return NextResponse.json({
      success: true,
      data: mockLogs,
      meta: {
        timestamp: new Date().toISOString(),
        total: mockLogs.length,
      },
    });
  } catch (error) {
    console.error('Webhook logs API error:', error);
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

// Mock webhook logs generator (for demo purposes)
function generateMockWebhookLogs(partnerId: string) {
  const events = [
    'order.created',
    'order.completed',
    'payment.received',
    'invoice.issued',
    'booking.confirmed',
  ];
  
  const logs = [];
  const now = Date.now();
  
  for (let i = 0; i < 20; i++) {
    const isSuccess = Math.random() > 0.3; // 70% success rate
    const attemptNumber = isSuccess ? 1 : Math.floor(Math.random() * 3) + 1;
    const maxAttempts = 3;
    const createdAt = new Date(now - i * 3600000); // 1 hour intervals
    
    logs.push({
      id: `wh_${Date.now()}_${i}`,
      partner_id: partnerId,
      event_type: events[Math.floor(Math.random() * events.length)],
      webhook_url: 'https://partner-api.example.com/webhooks',
      request_payload: {
        event: events[Math.floor(Math.random() * events.length)],
        data: { id: `obj_${i}`, amount: 1000000 + i * 10000 },
        timestamp: createdAt.toISOString(),
      },
      request_headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': 'sha256=...',
      },
      response_status: isSuccess ? 200 : Math.random() > 0.5 ? 500 : 404,
      response_body: isSuccess ? { success: true } : { error: 'Internal server error' },
      response_time_ms: isSuccess ? Math.floor(Math.random() * 500) + 50 : null,
      attempt_number: attemptNumber,
      max_attempts: maxAttempts,
      is_success: isSuccess,
      error_message: isSuccess ? null : 'Connection timeout or server error',
      next_retry_at: !isSuccess && attemptNumber < maxAttempts 
        ? new Date(createdAt.getTime() + 60000 * Math.pow(2, attemptNumber - 1)).toISOString()
        : null,
      created_at: createdAt.toISOString(),
      delivered_at: isSuccess ? new Date(createdAt.getTime() + 200).toISOString() : null,
    });
  }
  
  return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
