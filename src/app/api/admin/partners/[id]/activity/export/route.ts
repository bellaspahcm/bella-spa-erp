import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EventType = 'api_call' | 'key_rotation' | 'config_change' | 'scope_update' | 'error' | 'webhook' | 'all';

/**
 * GET /api/admin/partners/[id]/activity/export
 * Export activity timeline to CSV
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

    // Fetch logs
    let logsQuery = supabase
      .from('api_request_logs' as never)
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(1000); // Max 1000 for export

    if (dateFrom) {
      logsQuery = logsQuery.gte('created_at', dateFrom.toISOString());
    }

    const { data: logs, error: logsError } = await logsQuery;

    if (logsError || !logs) {
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    // Generate CSV
    const headers = [
      'Timestamp',
      'Event Type',
      'Title',
      'Description',
      'Status',
      'Method',
      'Endpoint',
      'Status Code',
      'Response Time (ms)',
      'IP Address',
    ];

    const rows = logs.map((log: unknown) => {
      const isError = log.status_code >= 400;
      const isWarning = log.status_code >= 300 && log.status_code < 400;

      let eventType = 'api_call';
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

      // Skip if doesn't match filter
      if (eventTypeFilter && eventTypeFilter !== 'all' && eventType !== eventTypeFilter) {
        return null;
      }

      return [
        new Date(log.created_at).toISOString(),
        eventType,
        `${log.method} ${log.endpoint}`,
        isError ? `Failed with status ${log.status_code}` : 'Success',
        isError ? 'error' : isWarning ? 'warning' : 'success',
        log.method,
        log.endpoint,
        log.status_code,
        log.response_time_ms,
        log.ip_address || 'N/A',
      ];
    }).filter(Boolean);

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row: unknown) =>
        row.map((cell: unknown) => {
          // Escape commas and quotes in CSV
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ),
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="partner-${partnerId}-activity-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export activity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
