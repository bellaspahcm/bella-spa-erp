import { createClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper: Get tenant ID from user (with fallback to users table)
 */
async function getTenantIdForUser(supabase: any, user: any): Promise<string | null> {
  // Try metadata first
  const tenantId = user.user_metadata?.tenant_id;
  
  if (tenantId) return tenantId;
  
  // Fallback: Query users table
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  
  return userData?.tenant_id || null;
}

/**
 * GET /api/admin/booking-engine/metrics
 * 
 * Fetches aggregated metrics from Decision Engine providers
 * for the Booking Engine Dashboard.
 * 
 * Query Parameters:
 * - startDate: ISO timestamp (default: 7 days ago)
 * - endDate: ISO timestamp (default: now)
 * 
 * Returns:
 * - assignment: Assignment provider stats
 * - conflict: Conflict detection stats
 * - capacity: Capacity management stats
 * - performance: Provider performance stats
 * - override: Manager override usage stats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant ID (with fallback)
    const tenantId = await getTenantIdForUser(supabase, user);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID not found in metadata or users table' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    // Call RPC function
    const { data: metrics, error: rpcError } = await supabase.rpc(
      'get_booking_engine_metrics',
      {
        p_tenant_id: tenantId,
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (rpcError) {
      console.error('[BookingEngineMetrics] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to fetch metrics', details: rpcError.message },
        { status: 500 }
      );
    }

    // Return metrics with cache headers (cache for 1 minute)
    return NextResponse.json(
      {
        success: true,
        data: metrics || {},
        meta: {
          tenantId,
          startDate,
          endDate,
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('[BookingEngineMetrics] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/booking-engine/metrics
 * 
 * Records a Decision Engine metric event.
 * Called by booking creation flow after each provider execution.
 * 
 * Body:
 * - providerType: 'capacity_management' | 'auto_assignment' | 'conflict_detection'
 * - operation: string (e.g., 'checkCapacity', 'assignKtv', 'detectConflicts')
 * - success: boolean
 * - outcome: string (e.g., 'available', 'full', 'assigned', 'conflict_blocked')
 * - executionTimeMs: number
 * - bookingId?: UUID
 * - customerId?: UUID
 * - ktvId?: UUID
 * - metadata?: object (provider-specific data)
 * - skipFlags?: { capacity?: boolean, conflict?: boolean, assignment?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant ID (with fallback)
    const tenantId = await getTenantIdForUser(supabase, user);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID not found in metadata or users table' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      providerType,
      operation,
      success,
      outcome,
      executionTimeMs,
      bookingId,
      customerId,
      ktvId,
      metadata,
      skipFlags,
    } = body;

    // Validate required fields
    if (!providerType || !operation || success === undefined || !executionTimeMs) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['providerType', 'operation', 'success', 'executionTimeMs'],
        },
        { status: 400 }
      );
    }

    // Insert metric record
    const { data: metric, error: insertError } = await supabase
      .from('decision_engine_metrics')
      .insert({
        tenant_id: tenantId,
        provider_type: providerType,
        operation,
        success,
        outcome,
        execution_time_ms: executionTimeMs,
        booking_id: bookingId || null,
        customer_id: customerId || null,
        ktv_id: ktvId || null,
        metadata: metadata || null,
        was_capacity_skipped: skipFlags?.capacity || false,
        was_conflict_skipped: skipFlags?.conflict || false,
        was_assignment_skipped: skipFlags?.assignment || false,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('[BookingEngineMetrics] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to record metric', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: metric,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[BookingEngineMetrics] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
