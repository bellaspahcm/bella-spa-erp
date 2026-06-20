/**
 * GET /api/admin/partners/analytics
 * 
 * Advanced analytics endpoint for multi-partner comparison
 * Returns aggregated metrics and trend data for selected partners
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { z } from 'zod';
import type { APIErrorCode, APIPartner, APIRequestLog } from '@/types/api-gateway';

type PartnerAnalyticsRow = Pick<
  APIPartner,
  'id' | 'partner_name' | 'partner_type' | 'is_sandbox'
>;

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

const querySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
  partner_ids: z.string().min(1), // Comma-separated partner IDs
});

export async function GET(request: NextRequest) {
  try {
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

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'User profile not found',
            code: 'AUTH_001' as APIErrorCode,
          },
        },
        { status: 401 }
      );
    }

    if (!profile.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'User profile is not assigned to a tenant',
            code: 'AUTHZ_001' as APIErrorCode,
          },
        },
        { status: 403 }
      );
    }

    const tenantId = profile.tenant_id;

    // Role check
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'AUTHZ_001' as APIErrorCode,
          },
        },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      range: searchParams.get('range') || '30d',
      partner_ids: searchParams.get('partner_ids') || '',
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid query parameters',
            code: 'VAL_001' as APIErrorCode,
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { range, partner_ids } = parsed.data;
    const partnerIdArray = partner_ids.split(',').filter(Boolean);

    if (partnerIdArray.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'At least one partner_id is required',
            code: 'VAL_002' as APIErrorCode,
          },
        },
        { status: 400 }
      );
    }

    // Calculate date range
    const now = new Date();
    const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch analytics data for each partner
    const analyticsPromises = partnerIdArray.map(async (partnerId) => {
      // Verify partner belongs to tenant
      const { data: partner, error: partnerError } = (await supabase
        .from('api_partners' as never)
        .select('id, partner_name, partner_type, is_sandbox')
        .eq('id', partnerId)
        .eq('tenant_id', tenantId)
        .maybeSingle()) as unknown as QueryResult<PartnerAnalyticsRow | null>;

      if (partnerError) {
        throw new Error('Failed to load API partner analytics scope: ' + partnerError.message);
      }

      if (!partner) {
        return null; // Skip invalid partners
      }

      // Get request logs for this partner in the time range
      const { data: logs, error: logsError } = (await supabase
        .from('api_request_logs' as never)
        .select('*')
        .eq('partner_id', partnerId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })) as unknown as QueryResult<APIRequestLog[] | null>;

      if (logsError) {
        throw new Error('Failed to load API request logs for analytics: ' + logsError.message);
      }

      const totalLogs = logs ?? [];
      const total_requests = totalLogs.length;
      const error_requests = totalLogs.filter((log) => log.is_error).length;
      const error_rate = total_requests > 0 ? (error_requests / total_requests) * 100 : 0;

      // Calculate response time metrics
      const responseTimes = totalLogs.map((log) => log.response_time_ms).sort((a, b) => a - b);
      const avg_response_time =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
          : 0;
      const p95_index = Math.floor(responseTimes.length * 0.95);
      const p95_response_time = responseTimes[p95_index] || 0;
      const p99_index = Math.floor(responseTimes.length * 0.99);
      const p99_response_time = responseTimes[p99_index] || 0;

      // Calculate uptime (percentage of non-5xx errors)
      const serverErrors = totalLogs.filter(
        (log) => log.is_error && log.status_code >= 500
      ).length;
      const uptime_percent =
        total_requests > 0 ? ((total_requests - serverErrors) / total_requests) * 100 : 100;

      // Cost estimation (hypothetical pricing model: $0.001 per request base + $0.0001 per error)
      const estimated_cost_usd = total_requests * 0.001 + error_requests * 0.0001;
      const cost_per_request = total_requests > 0 ? estimated_cost_usd / total_requests : 0;

      // Revenue estimation (hypothetical business value: $0.05 per successful request)
      const successful_requests = total_requests - error_requests;
      const revenue_generated = successful_requests * 0.05;
      const roi_percent =
        estimated_cost_usd > 0
          ? ((revenue_generated - estimated_cost_usd) / estimated_cost_usd) * 100
          : 0;

      // Daily breakdown
      const dailyMap = new Map<string, { requests: number; errors: number; totalTime: number }>();
      
      for (const log of totalLogs) {
        const dateKey = log.created_at.split('T')[0]; // YYYY-MM-DD
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { requests: 0, errors: 0, totalTime: 0 });
        }
        const dayData = dailyMap.get(dateKey)!;
        dayData.requests += 1;
        if (log.is_error) dayData.errors += 1;
        dayData.totalTime += log.response_time_ms;
      }

      const daily_stats = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          requests: data.requests,
          errors: data.errors,
          avg_response_time: data.requests > 0 ? data.totalTime / data.requests : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        partner_id: partner.id,
        partner_name: partner.partner_name,
        partner_type: partner.partner_type,
        is_sandbox: partner.is_sandbox,
        total_requests,
        error_requests,
        error_rate,
        avg_response_time,
        p95_response_time,
        p99_response_time,
        uptime_percent,
        estimated_cost_usd,
        cost_per_request,
        revenue_generated,
        roi_percent,
        daily_stats,
      };
    });

    const analyticsResults = await Promise.all(analyticsPromises);
    const analyticsData = analyticsResults.filter((result) => result !== null);

    return NextResponse.json({
      success: true,
      data: analyticsData,
      meta: {
        timestamp: new Date().toISOString(),
        range,
        partner_count: analyticsData.length,
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);
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
