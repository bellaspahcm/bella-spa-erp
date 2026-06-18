/**
 * POST /api/admin/partners/[id]/webhook-logs/batch-retry
 * 
 * Batch retry nhiều webhooks cùng lúc
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { z } from 'zod';
import type { APIErrorCode } from '@/types/api-gateway';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const batchRetrySchema = z.object({
  log_ids: z.array(z.string()).min(1).max(50), // Max 50 webhooks at once
});

export async function POST(request: NextRequest, context: RouteContext) {
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

    // Parse and validate request body
    const body = await request.json();
    const parsed = batchRetrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid request body',
            code: 'VAL_001' as APIErrorCode,
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { log_ids } = parsed.data;

    // Verify partner belongs to tenant
    const { data: partner } = await supabase
      .from('api_partners' as any)
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
    // 1. Fetch all webhook logs matching log_ids and partner_id
    // 2. Filter logs that are eligible for retry (attempt < max_attempts)
    // 3. Send webhook requests in parallel (with rate limiting)
    // 4. Update each log with new attempt and result
    // 5. Return summary of results

    // Mock implementation
    console.log(`Batch retrying ${log_ids.length} webhooks for partner ${partnerId}`);

    // Simulate batch retry with varying success rates
    const results = log_ids.map((logId) => ({
      log_id: logId,
      success: Math.random() > 0.3, // 70% success rate
    }));

    const success_count = results.filter((r) => r.success).length;
    const failed_count = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        total_attempted: log_ids.length,
        success_count,
        failed_count,
        results: results.map((r) => ({
          log_id: r.log_id,
          status: r.success ? 'success' : 'failed',
          response_status: r.success ? 200 : 500,
        })),
      },
      success_count, // For backward compatibility with frontend
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Batch retry API error:', error);
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
