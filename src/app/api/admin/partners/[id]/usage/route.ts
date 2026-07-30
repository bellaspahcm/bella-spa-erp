/**
 * API Route: /api/admin/partners/[id]/usage
 * 
 * GET: Lấy thống kê sử dụng API của đối tác
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { subDays } from 'date-fns';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface LogEntry {
  id: string;
  created_at: string;
  is_error: boolean;
  response_time_ms: number;
  status_code?: number;
  endpoint?: string;
}

interface PartnerData {
  id: string;
  tenant_id: string;
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: partnerId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'AUTH_001' } },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { success: false, error: { message: 'Tenant not found', code: 'TENANT_001' } },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '7d';
    const days = range === '30d' ? 30 : 7;

    // Get partner
    const { data: partner } = await supabase
      .from('api_partners' as never)
      .select('*')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    const partnerData = partner as PartnerData | null;

    if (!partnerData) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner not found', code: 'VAL_001' } },
        { status: 404 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Fetch aggregated stats
    const { data: logs } = await supabase
      .from('api_request_logs' as never)
      .select('*')
      .eq('partner_id', partnerId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const allLogs = logs || [];

    // Calculate stats
    const totalRequests = allLogs.length;
    const errorRequests = allLogs.filter((l: LogEntry) => l.is_error).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    
    const responseTimes = allLogs.map((l: LogEntry) => l.response_time_ms).filter((t: number) => t > 0);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0;
    
    const sortedTimes = responseTimes.sort((a: number, b: number) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResponseTime = sortedTimes[p95Index] || 0;

    // Group by day - fill all dates in selected range
    const requestsByDayMap = new Map<string, { count: number; errors: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(endDate, i);
      const dateStr = d.toISOString().split('T')[0];
      requestsByDayMap.set(dateStr, { count: 0, errors: 0 });
    }

    allLogs.forEach((log: LogEntry) => {
      const dateStr = log.created_at.split('T')[0];
      if (requestsByDayMap.has(dateStr)) {
        const item = requestsByDayMap.get(dateStr)!;
        item.count++;
        if (log.is_error) {
          item.errors++;
        }
      }
    });

    const requestsByDayArray = Array.from(requestsByDayMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Top endpoints
    const endpointCounts: Record<string, { count: number; totalTime: number }> = {};
    allLogs.forEach((log: LogEntry) => {
      const endpoint = log.endpoint || 'unknown';
      if (!endpointCounts[endpoint]) {
        endpointCounts[endpoint] = { count: 0, totalTime: 0 };
      }
      endpointCounts[endpoint].count++;
      endpointCounts[endpoint].totalTime += log.response_time_ms || 0;
    });

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avg_time: data.count > 0 ? data.totalTime / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate actual requests in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const currentUsageMinute = allLogs.filter((l: LogEntry) => l.created_at >= oneMinuteAgo).length;

    // Rate limit status based on real log counters
    const rateLimitStatus = {
      limit_per_minute: partnerData.rate_limit_per_minute || 100,
      limit_per_day: partnerData.rate_limit_per_day || 5000,
      current_usage_minute: currentUsageMinute,
      current_usage_day: totalRequests,
    };

    return NextResponse.json({
      success: true,
      data: {
        total_requests: totalRequests,
        error_requests: errorRequests,
        error_rate: errorRate,
        avg_response_time: avgResponseTime,
        p95_response_time: p95ResponseTime,
        requests_by_day: requestsByDayArray,
        top_endpoints: topEndpoints,
        rate_limit_status: rateLimitStatus,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching usage stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001',
        },
      },
      { status: 500 }
    );
  }
}
