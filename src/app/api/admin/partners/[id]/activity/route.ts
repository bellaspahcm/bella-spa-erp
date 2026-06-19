import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EventType = 'api_call' | 'key_rotation' | 'config_change' | 'scope_update' | 'error' | 'webhook' | 'all';

interface ActivityEvent {
  id: string;
  event_type: EventType;
  timestamp: string;
  title: string;
  description: string;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/admin/partners/[id]/activity
 * Fetch activity timeline for a partner
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id: partnerId } = await context.params;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const eventTypeFilter = searchParams.get('event_type') as EventType | null;
    const dateRange = searchParams.get('date_range') || '7d';
    const searchQuery = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Calculate date filter
    let dateFrom: Date | null = null;
    const now = new Date();
    
    switch (dateRange) {
      case '24h':
        dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        dateFrom = null;
        break;
    }

    // Fetch partner to verify access
    const { data: partner, error: partnerError } = await supabase
      .from('api_partners' as never)
      .select('id, partner_name')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partnerData = partner as unknown;

    // Collect all activity events from different sources
    const events: ActivityEvent[] = [];

    // 1. Fetch API request logs
    let logsQuery = supabase
      .from('api_request_logs' as never)
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (dateFrom) {
      logsQuery = logsQuery.gte('created_at', dateFrom.toISOString());
    }

    const { data: logs, error: logsError } = await logsQuery;

    if (logs && logs.length > 0) {
      logs.forEach((log: unknown) => {
        const isError = log.status_code >= 400;
        const isWarning = log.status_code >= 300 && log.status_code < 400;

        // Determine event type from endpoint
        let eventType: EventType = 'api_call';
        if (log.endpoint?.includes('rotation') || log.endpoint?.includes('regenerate-key')) {
          eventType = 'key_rotation';
        } else if (log.endpoint?.includes('webhook')) {
          eventType = 'webhook';
        } else if (log.endpoint?.includes('scopes')) {
          eventType = 'scope_update';
        } else if (log.endpoint?.includes('rotation-policy') || log.endpoint?.includes('config')) {
          eventType = 'config_change';
        } else if (isError) {
          eventType = 'error';
        }

        // Skip if doesn't match event type filter
        if (eventTypeFilter && eventTypeFilter !== 'all' && eventType !== eventTypeFilter) {
          return;
        }

        const event: ActivityEvent = {
          id: `log_${log.id}`,
          event_type: eventType,
          timestamp: log.created_at,
          title: isError
            ? `❌ API Request Failed: ${log.method} ${log.endpoint}`
            : `✅ API Request: ${log.method} ${log.endpoint}`,
          description: isError
            ? `Request failed with status ${log.status_code}`
            : `Request completed successfully in ${log.response_time_ms}ms`,
          status: isError ? 'error' : isWarning ? 'warning' : 'success',
          metadata: {
            method: log.method,
            endpoint: log.endpoint,
            status_code: log.status_code,
            response_time_ms: log.response_time_ms,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
          },
        };

        events.push(event);
      });
    }

    // 2. Fetch key rotation events (from metadata in logs or dedicated table)
    const rotationLogs = logs?.filter((log: unknown) =>
      log.endpoint?.includes('rotate-key') || log.endpoint?.includes('regenerate-key')
    ) || [];

    rotationLogs.forEach((log: unknown) => {
      if (eventTypeFilter && eventTypeFilter !== 'all' && eventTypeFilter !== 'key_rotation') {
        return;
      }

      const metadata = log.metadata || {};
      const event: ActivityEvent = {
        id: `rotation_${log.id}`,
        event_type: 'key_rotation',
        timestamp: log.created_at,
        title: '🔑 API Key Rotated',
        description: metadata.reason || 'API key was rotated for security',
        status: 'info',
        metadata: {
          old_key_prefix: metadata.oldKeyPrefix,
          new_key_prefix: metadata.newKeyPrefix,
          grace_period_days: metadata.gracePeriodDays,
        },
      };

      // Don't duplicate if already added
      if (!events.find((e) => e.id === event.id)) {
        events.push(event);
      }
    });

    // 3. Fetch config change events
    const configLogs = logs?.filter((log: unknown) =>
      log.endpoint?.includes('rotation-policy') || log.endpoint?.includes('scopes')
    ) || [];

    configLogs.forEach((log: unknown) => {
      const isScope = log.endpoint?.includes('scopes');
      const eventType: EventType = isScope ? 'scope_update' : 'config_change';

      if (eventTypeFilter && eventTypeFilter !== 'all' && eventTypeFilter !== eventType) {
        return;
      }

      const event: ActivityEvent = {
        id: `config_${log.id}`,
        event_type: eventType,
        timestamp: log.created_at,
        title: isScope ? '🛡️ Scopes Updated' : '⚙️ Configuration Changed',
        description: isScope
          ? 'API scopes permissions were updated'
          : 'Partner configuration was modified',
        status: 'info',
        metadata: log.metadata || {},
      };

      // Don't duplicate
      if (!events.find((e) => e.id === event.id)) {
        events.push(event);
      }
    });

    // Apply search filter
    let filteredEvents = events;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredEvents = events.filter(
        (event) =>
          event.title.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    // Calculate stats
    const totalEvents = filteredEvents.length;
    const successCount = filteredEvents.filter((e) => e.status === 'success').length;
    const errorCount = filteredEvents.filter((e) => e.status === 'error').length;
    const successRate = totalEvents > 0 ? (successCount / totalEvents) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        events: paginatedEvents,
        stats: {
          total_events: totalEvents,
          success_count: successCount,
          error_count: errorCount,
          success_rate: successRate,
        },
        pagination: {
          total: totalEvents,
          limit,
          offset,
          has_more: offset + limit < totalEvents,
        },
      },
    });
  } catch (error) {
    console.error('Get activity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
