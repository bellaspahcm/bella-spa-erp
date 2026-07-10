import { createClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper: Get tenant ID from user (with fallback to users table)
 */
async function getTenantIdForUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();
  return data?.tenant_id ?? null;
}

/**
 * GET /api/decision-engine/audit
 *
 * Returns paginated audit log from decision_engine_metrics table.
 *
 * Query Parameters:
 *  - tenantId     (optional – overridden by auth tenant for non-admin users)
 *  - decisionType (optional) – maps to provider_type column
 *  - provider     (optional) – maps to provider_type
 *  - status       (optional) – 'success' | 'error' | 'warning'
 *  - dateFrom     (optional) – ISO date string (inclusive)
 *  - dateTo       (optional) – ISO date string (inclusive)
 *  - search       (optional) – searches by id (UUID prefix match)
 *  - page         (default 1)
 *  - limit        (default 25, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve tenant ID
    const tenantId = await getTenantIdForUser(supabase, user.id);
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found for this user' },
        { status: 403 }
      );
    }

    // Parse query params
    const sp = request.nextUrl.searchParams;
    const decisionType = sp.get('decisionType') || '';
    const provider     = sp.get('provider') || '';
    const status       = sp.get('status') || '';
    const dateFrom     = sp.get('dateFrom') || '';
    const dateTo       = sp.get('dateTo') || '';
    const search       = sp.get('search') || '';
    const page         = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit        = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '25', 10)));
    const offset       = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('decision_engine_metrics')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter: decisionType maps to provider_type
    if (decisionType) {
      query = query.ilike('provider_type', `%${decisionType}%`);
    }

    // Filter: provider also maps to provider_type (if separate from decisionType)
    if (provider && !decisionType) {
      query = query.ilike('provider_type', `%${provider}%`);
    }

    // Filter: status – derived from success boolean
    // success=true → 'success', success=false → 'error'
    if (status === 'success') {
      query = query.eq('success', true);
    } else if (status === 'error') {
      query = query.eq('success', false);
    }
    // 'warning' is not stored in current schema – show all for now

    // Filter: date range
    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      // Include the full dateTo day
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    // Filter: search by id
    if (search) {
      query = query.ilike('id', `${search}%`);
    }

    const { data: rows, error: dbError, count } = await query;

    if (dbError) {
      console.error('[GET /api/decision-engine/audit] DB error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Database error', details: dbError.message },
        { status: 500 }
      );
    }

    const total       = count ?? 0;
    const totalPages  = Math.ceil(total / limit);

    // Map rows to AuditLogEntry shape expected by the UI
    const data = (rows ?? []).map((row: Record<string, unknown>) => ({
      id:               row.id as string,
      decision_id:      row.id as string,          // re-use id as decision_id (no separate column)
      decision_type:    row.provider_type as string,
      provider:         row.provider_type as string,
      execution_time_ms: row.execution_time_ms as number,
      status:           (row.success ? 'success' : 'error') as 'success' | 'error' | 'warning',
      tenant_id:        row.tenant_id as string,
      created_at:       row.created_at as string,
      confidence_score: row.metadata
        ? ((row.metadata as Record<string, unknown>).confidence_score as number | undefined)
        : undefined,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      filters: { tenantId, decisionType, provider, status, dateFrom, dateTo, search },
    });
  } catch (error) {
    console.error('[GET /api/decision-engine/audit] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
