/**
 * Admin API: Partner SLA Metrics
 * 
 * @endpoint GET /api/admin/partners/[id]/sla-metrics
 * 
 * Fetch SLA metrics for a partner including:
 * - Uptime percentage and downtime minutes
 * - Latency metrics (avg, p95, p99, max)
 * - Error rate and request volume
 * - Compliance status and score
 * - Optional time series data for charts
 * 
 * @module api/admin/partners/[id]/sla-metrics
 * @since 2026-06-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  SLAMetrics,
  SLATimeRange,
  SLAComplianceStatus,
  APIResponse,
} from '@/types/api-gateway';

interface LogEntry {
  id: string;
  created_at: string;
  is_error: boolean;
  response_time_ms: number;
  status_code?: number;
}

/**
 * GET /api/admin/partners/[id]/sla-metrics
 * 
 * Query params:
 * - time_range: '1h' | '24h' | '7d' | '30d' (default: '24h')
 * - include_time_series: 'true' | 'false' (default: 'false')
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('time_range') || '24h') as SLATimeRange;
    const includeTimeSeries = searchParams.get('include_time_series') === 'true';

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001',
          },
        } satisfies APIResponse,
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
            code: 'TENANT_001',
          },
        } satisfies APIResponse,
        { status: 404 }
      );
    }

    // Only admin/owner can view SLA metrics
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'AUTHZ_001',
          },
        } satisfies APIResponse,
        { status: 403 }
      );
    }

    // Verify partner exists and belongs to tenant
    const { data: partner } = await supabase
      .from('api_partners' as never)
      .select('id, tenant_id, partner_name, is_active')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!partner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Partner not found',
            code: 'VAL_001',
          },
        } satisfies APIResponse,
        { status: 404 }
      );
    }

    // Calculate time window
    const now = new Date();
    const timeWindows: Record<SLATimeRange, number> = {
      '1h': 60 * 60 * 1000,           // 1 hour in ms
      '24h': 24 * 60 * 60 * 1000,     // 24 hours
      '7d': 7 * 24 * 60 * 60 * 1000,  // 7 days
      '30d': 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    
    const windowMs = timeWindows[timeRange];
    const startTime = new Date(now.getTime() - windowMs);

    // Query request logs for metrics calculation
    const { data: logs, error: logsError } = await supabase
      .from('api_request_logs' as never)
      .select('status_code, response_time_ms, is_error, created_at')
      .eq('partner_id', partnerId)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('[GET /api/admin/partners/[id]/sla-metrics] Logs query error:', logsError);
    }

    const requestLogs = logs || [];

    // Calculate metrics
    const totalRequests = requestLogs.length;
    const failedRequests = requestLogs.filter((log: LogEntry) => log.is_error).length;
    const successfulRequests = totalRequests - failedRequests;
    const errorRatePercent = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // Latency metrics
    const responseTimes = requestLogs.map((log: LogEntry) => log.response_time_ms).filter(Boolean);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum: number, t: number) => sum + t, 0) / responseTimes.length
      : 0;

    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.ceil(sortedTimes.length * 0.95) - 1;
    const p99Index = Math.ceil(sortedTimes.length * 0.99) - 1;
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;
    const maxResponseTime = sortedTimes[sortedTimes.length - 1] || 0;

    // Uptime calculation (simplified: based on error rate)
    // In a real system, this would track actual service availability
    const uptimePercent = totalRequests > 0 ? ((successfulRequests / totalRequests) * 100) : 100;
    const downtimeMinutes = ((100 - uptimePercent) / 100) * (windowMs / 60000);

    // Availability status
    let availabilityStatus: 'up' | 'down' | 'degraded' = 'up';
    if (uptimePercent < 95) {
      availabilityStatus = 'down';
    } else if (uptimePercent < 99) {
      availabilityStatus = 'degraded';
    }

    // Request volume
    const requestsPerMinute = totalRequests / (windowMs / 60000);
    
    // Peak requests per minute (calculate from time series)
    let requestsPerMinutePeak = requestsPerMinute;
    if (requestLogs.length > 0) {
      // Group by minute and find peak
      const minuteBuckets = new Map<string, number>();
      requestLogs.forEach((log: LogEntry) => {
        const minute = new Date(log.created_at).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
        minuteBuckets.set(minute, (minuteBuckets.get(minute) || 0) + 1);
      });
      requestsPerMinutePeak = Math.max(...Array.from(minuteBuckets.values()), 0);
    }

    // Compliance status (based on thresholds - using "standard" tier defaults)
    const uptimeTarget = 99.5;
    const p95LatencyTarget = 300;
    const errorRateTarget = 3.0;

    const isUptimeCompliant = uptimePercent >= uptimeTarget;
    const isLatencyCompliant = p95ResponseTime <= p95LatencyTarget;
    const isErrorRateCompliant = errorRatePercent <= errorRateTarget;

    let complianceStatus: SLAComplianceStatus = 'compliant';
    if (!isUptimeCompliant || !isLatencyCompliant || !isErrorRateCompliant) {
      const breachCount = [!isUptimeCompliant, !isLatencyCompliant, !isErrorRateCompliant].filter(Boolean).length;
      if (breachCount >= 2) {
        complianceStatus = 'breached';
      } else {
        complianceStatus = 'at_risk';
      }
    }

    // Compliance percentage (average of individual compliances)
    const uptimeCompliance = Math.min((uptimePercent / uptimeTarget) * 100, 100);
    const latencyCompliance = p95ResponseTime > 0 
      ? Math.max(100 - ((p95ResponseTime / p95LatencyTarget) - 1) * 100, 0)
      : 100;
    const errorRateCompliance = errorRatePercent > 0
      ? Math.max(100 - ((errorRatePercent / errorRateTarget) - 1) * 100, 0)
      : 100;
    
    const compliancePercent = (uptimeCompliance + latencyCompliance + errorRateCompliance) / 3;

    // Time series data (optional)
    let timeSeries: SLAMetrics['time_series'];
    if (includeTimeSeries) {
      // Group logs by time bucket (hourly for 7d/30d, every 10 min for 1h/24h)
      const bucketSize = ['7d', '30d'].includes(timeRange) ? 60 : 10; // minutes
      const buckets = new Map<string, LogEntry[]>();

      requestLogs.forEach((log: LogEntry) => {
        const timestamp = new Date(log.created_at);
        const bucketKey = new Date(
          timestamp.getTime() - (timestamp.getTime() % (bucketSize * 60 * 1000))
        ).toISOString();
        
        if (!buckets.has(bucketKey)) {
          buckets.set(bucketKey, []);
        }
        buckets.get(bucketKey)!.push(log);
      });

      timeSeries = Array.from(buckets.entries())
        .map(([timestamp, logs]) => {
          const total = logs.length;
          const errors = logs.filter((l: LogEntry) => l.is_error).length;
          const times = logs.map((l: LogEntry) => l.response_time_ms).filter(Boolean);
          const avgTime = times.length > 0
            ? times.reduce((sum, t) => sum + t, 0) / times.length
            : 0;
          const bucketUptime = total > 0 ? ((total - errors) / total) * 100 : 100;

          return {
            timestamp,
            requests: total,
            errors,
            avg_response_time: Math.round(avgTime),
            uptime_percent: Math.round(bucketUptime * 100) / 100,
          };
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // Build response
    const metrics: SLAMetrics = {
      partner_id: partnerId,
      time_range: timeRange,
      
      uptime_percent: Math.round(uptimePercent * 100) / 100,
      downtime_minutes: Math.round(downtimeMinutes * 100) / 100,
      availability_status: availabilityStatus,
      
      avg_response_time_ms: Math.round(avgResponseTime),
      p95_response_time_ms: Math.round(p95ResponseTime),
      p99_response_time_ms: Math.round(p99ResponseTime),
      max_response_time_ms: Math.round(maxResponseTime),
      
      total_requests: totalRequests,
      successful_requests: successfulRequests,
      failed_requests: failedRequests,
      error_rate_percent: Math.round(errorRatePercent * 100) / 100,
      
      requests_per_minute_avg: Math.round(requestsPerMinute * 100) / 100,
      requests_per_minute_peak: Math.round(requestsPerMinutePeak),
      
      compliance_status: complianceStatus,
      compliance_percent: Math.round(compliancePercent * 100) / 100,
      
      time_series: timeSeries,
      
      calculated_at: now.toISOString(),
      last_updated_at: now.toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        data: metrics,
        meta: {
          timestamp: now.toISOString(),
        },
      } satisfies APIResponse<SLAMetrics>,
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('[GET /api/admin/partners/[id]/sla-metrics] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: 'SERVER_001',
        },
      } satisfies APIResponse,
      { status: 500 }
    );
  }
}
