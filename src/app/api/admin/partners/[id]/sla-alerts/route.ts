/**
 * Admin API: Partner SLA Alerts
 * 
 * @endpoint GET /api/admin/partners/[id]/sla-alerts - Get alert history
 * @endpoint POST /api/admin/partners/[id]/sla-alerts - Acknowledge/resolve alert
 * 
 * Manages SLA alert records for a partner including:
 * - Alert history with filters (severity, status, type)
 * - Active alerts
 * - Alert acknowledgment and resolution
 * 
 * @module api/admin/partners/[id]/sla-alerts
 * @since 2026-06-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  SLAAlert,
  SLAAlertSeverity,
  SLAAlertStatus,
  SLAAlertType,
  SLATimeRange,
  APIResponse,
  PaginatedAPIResponse,
} from '@/types/api-gateway';

/**
 * GET /api/admin/partners/[id]/sla-alerts
 * 
 * Query params:
 * - severity: 'info' | 'warning' | 'critical'
 * - status: 'active' | 'resolved' | 'acknowledged'
 * - alert_type: 'uptime' | 'latency' | 'error_rate' | 'availability'
 * - time_range: '1h' | '24h' | '7d' | '30d'
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    
    const severity = searchParams.get('severity') as SLAAlertSeverity | null;
    const status = searchParams.get('status') as SLAAlertStatus | null;
    const alertType = searchParams.get('alert_type') as SLAAlertType | null;
    const timeRange = searchParams.get('time_range') as SLATimeRange | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    // Only admin/owner can view SLA alerts
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
      .select('id, tenant_id')
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

    // Calculate time window if time_range provided
    let startTime: Date | undefined;
    if (timeRange) {
      const now = new Date();
      const timeWindows: Record<SLATimeRange, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      startTime = new Date(now.getTime() - timeWindows[timeRange]);
    }

    // Since sla_alerts table doesn't exist yet, generate mock data
    // In production, this would query: supabase.from('sla_alerts').select(...)
    
    // Generate realistic mock alerts
    const mockAlerts = generateMockAlerts(partnerId, profile.tenant_id, 30);
    
    // Apply filters
    let filteredAlerts = mockAlerts;
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(a => a.severity === severity);
    }
    
    if (status) {
      filteredAlerts = filteredAlerts.filter(a => a.status === status);
    }
    
    if (alertType) {
      filteredAlerts = filteredAlerts.filter(a => a.alert_type === alertType);
    }
    
    if (startTime) {
      filteredAlerts = filteredAlerts.filter(a => 
        new Date(a.triggered_at) >= startTime!
      );
    }

    // Sort by triggered_at desc (most recent first)
    filteredAlerts.sort((a, b) => 
      new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
    );

    // Pagination
    const total = filteredAlerts.length;
    const paginatedAlerts = filteredAlerts.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return NextResponse.json(
      {
        success: true,
        data: paginatedAlerts,
        pagination: {
          total,
          limit,
          offset,
          has_more: hasMore,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      } satisfies PaginatedAPIResponse<SLAAlert>,
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('[GET /api/admin/partners/[id]/sla-alerts] Error:', error);
    
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

/**
 * POST /api/admin/partners/[id]/sla-alerts
 * 
 * Body:
 * - action: 'acknowledge' | 'resolve'
 * - alert_id: string
 * - notes?: string
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await context.params;
    const body = await request.json();
    const { action, alert_id, notes: _notes } = body;

    if (!action || !alert_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Missing required fields: action, alert_id',
            code: 'VAL_002',
          },
        } satisfies APIResponse,
        { status: 400 }
      );
    }

    if (!['acknowledge', 'resolve'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid action. Must be "acknowledge" or "resolve"',
            code: 'VAL_001',
          },
        } satisfies APIResponse,
        { status: 400 }
      );
    }

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
      .select('tenant_id, role, full_name')
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

    // Only admin/owner can manage alerts
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
      .select('id, tenant_id')
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

    // In production, update alert in database:
    // const { data: updatedAlert } = await supabase
    //   .from('sla_alerts')
    //   .update({
    //     status: action === 'acknowledge' ? 'acknowledged' : 'resolved',
    //     acknowledged_at: action === 'acknowledge' ? new Date().toISOString() : undefined,
    //     resolved_at: action === 'resolve' ? new Date().toISOString() : undefined,
    //     metadata: { ...metadata, notes, updated_by: profile.full_name }
    //   })
    //   .eq('id', alert_id)
    //   .eq('partner_id', partnerId)
    //   .select()
    //   .single();

    // For now, return success with mock response
    const now = new Date().toISOString();
    const mockUpdatedAlert: Partial<SLAAlert> = {
      id: alert_id,
      status: action === 'acknowledge' ? 'acknowledged' : 'resolved',
      acknowledged_at: action === 'acknowledge' ? now : undefined,
      resolved_at: action === 'resolve' ? now : undefined,
      updated_at: now,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          message: `Alert ${action}d successfully`,
          alert: mockUpdatedAlert,
        },
        meta: {
          timestamp: now,
        },
      } satisfies APIResponse,
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('[POST /api/admin/partners/[id]/sla-alerts] Error:', error);
    
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

/**
 * Generate mock SLA alerts for testing
 * In production, this would be replaced with actual database queries
 */
function generateMockAlerts(
  partnerId: string,
  tenantId: string,
  count: number
): SLAAlert[] {
  const alerts: SLAAlert[] = [];
  const now = new Date();

  const alertTemplates = [
    {
      alert_type: 'latency' as SLAAlertType,
      severity: 'warning' as SLAAlertSeverity,
      title: 'High Response Time Detected',
      message: 'P95 response time exceeded 300ms threshold',
      metric_name: 'p95_response_time_ms',
      metric_value: 456,
      threshold_value: 300,
    },
    {
      alert_type: 'error_rate' as SLAAlertType,
      severity: 'critical' as SLAAlertSeverity,
      title: 'Error Rate Spike',
      message: 'Error rate exceeded 5% threshold',
      metric_name: 'error_rate_percent',
      metric_value: 8.5,
      threshold_value: 5.0,
    },
    {
      alert_type: 'uptime' as SLAAlertType,
      severity: 'critical' as SLAAlertSeverity,
      title: 'Uptime Below Target',
      message: 'Service uptime dropped below 99.5%',
      metric_name: 'uptime_percent',
      metric_value: 98.2,
      threshold_value: 99.5,
    },
    {
      alert_type: 'availability' as SLAAlertType,
      severity: 'critical' as SLAAlertSeverity,
      title: 'Service Unavailable',
      message: 'Multiple consecutive failures detected',
      metric_name: 'consecutive_failures',
      metric_value: 5,
      threshold_value: 3,
    },
    {
      alert_type: 'latency' as SLAAlertType,
      severity: 'info' as SLAAlertSeverity,
      title: 'Response Time Elevated',
      message: 'Average response time slightly elevated',
      metric_name: 'avg_response_time_ms',
      metric_value: 250,
      threshold_value: 200,
    },
  ];

  const statuses: SLAAlertStatus[] = ['active', 'acknowledged', 'resolved'];

  for (let i = 0; i < count; i++) {
    const template = alertTemplates[i % alertTemplates.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const hoursAgo = Math.floor(Math.random() * 168); // Random within last 7 days
    const triggeredAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    let acknowledgedAt: string | undefined;
    let resolvedAt: string | undefined;
    let durationMinutes: number | undefined;

    if (status === 'acknowledged' || status === 'resolved') {
      const ackMinutesAfter = Math.floor(Math.random() * 60) + 5; // 5-65 minutes
      acknowledgedAt = new Date(triggeredAt.getTime() + ackMinutesAfter * 60 * 1000).toISOString();
    }

    if (status === 'resolved') {
      const resolveMinutesAfterAck = Math.floor(Math.random() * 120) + 10; // 10-130 minutes
      resolvedAt = new Date(
        new Date(acknowledgedAt!).getTime() + resolveMinutesAfterAck * 60 * 1000
      ).toISOString();
      durationMinutes = Math.floor((new Date(resolvedAt).getTime() - triggeredAt.getTime()) / 60000);
    }

    const notificationChannels: ('email' | 'webhook' | 'telegram')[] = [];
    if (template.severity === 'critical') {
      notificationChannels.push('email', 'webhook', 'telegram');
    } else if (template.severity === 'warning') {
      notificationChannels.push('email', 'webhook');
    } else {
      notificationChannels.push('webhook');
    }

    alerts.push({
      id: `alert_${partnerId.slice(0, 8)}_${i + 1}`,
      partner_id: partnerId,
      tenant_id: tenantId,
      
      alert_type: template.alert_type,
      severity: template.severity,
      status,
      
      title: template.title,
      message: template.message,
      
      metric_name: template.metric_name,
      metric_value: template.metric_value,
      threshold_value: template.threshold_value,
      
      triggered_at: triggeredAt.toISOString(),
      acknowledged_at: acknowledgedAt,
      resolved_at: resolvedAt,
      
      duration_minutes: durationMinutes,
      
      notification_sent: true,
      notification_channels_used: notificationChannels,
      
      metadata: {
        triggered_by: 'system',
        acknowledged_by: acknowledgedAt ? 'Admin User' : undefined,
        resolved_by: resolvedAt ? 'Admin User' : undefined,
      },
      
      created_at: triggeredAt.toISOString(),
      updated_at: resolvedAt || acknowledgedAt || triggeredAt.toISOString(),
    });
  }

  return alerts;
}
