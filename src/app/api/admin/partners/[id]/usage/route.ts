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
    const { data: partner } = await (supabase as any)
      .from('api_partners')
      .select('*')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!partner) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner not found', code: 'VAL_001' } },
        { status: 404 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Fetch aggregated stats
    const { data: logs } = await (supabase as any)
      .from('api_request_logs')
      .select('*')
      .eq('partner_id', partnerId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const allLogs = logs || [];

    // Calculate stats
    const totalRequests = allLogs.length;
    const errorRequests = allLogs.filter((l: any) => l.is_error).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    
    const responseTimes = allLogs.map((l: any) => l.response_time_ms).filter((t: number) => t > 0);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0;
    
    const sortedTimes = responseTimes.sort((a: number, b: number) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResponseTime = sortedTimes[p95Index] || 0;

    // Group by day
    const requestsByDay: Record<string, { count: number; errors: number }> = {};
    allLogs.forEach((log: any) => {
      const date = log.created_at.split('T')[0];
      if (!requestsByDay[date]) {
        requestsByDay[date] = { count: 0, errors: 0 };
      }
      requestsByDay[date].count++;
      if (log.is_error) {
        requestsByDay[date].errors++;
      }
    });

    const requestsByDayArray = Object.entries(requestsByDay).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Top endpoints
    const endpointCounts: Record<string, { count: number; totalTime: number }> = {};
    allLogs.forEach((log: any) => {
      if (!endpointCounts[log.endpoint]) {
        endpointCounts[log.endpoint] = { count: 0, totalTime: 0 };
      }
      endpointCounts[log.endpoint].count++;
      endpointCounts[log.endpoint].totalTime += log.response_time_ms || 0;
    });

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avg_time: data.count > 0 ? data.totalTime / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Rate limit status (mock - would come from real-time data)
    const rateLimitStatus = {
      limit_per_minute: partner.rate_limit_per_minute || 100,
      limit_per_day: partner.rate_limit_per_day || 5000,
      current_usage_minute: Math.floor(Math.random() * (partner.rate_limit_per_minute || 100) * 0.3),
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
  } catch (error: any) {
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
