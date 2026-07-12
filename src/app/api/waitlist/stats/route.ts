/**
 * Waitlist Statistics API
 * 
 * GET /api/waitlist/stats - Get waitlist statistics
 * 
 * @module api/waitlist/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getWaitlistStats } from '@/services/waitlist/waitlist-service';

/**
 * GET /api/waitlist/stats
 * 
 * Get waitlist statistics for dashboard
 * 
 * Query params:
 * - tenant_id (required)
 * - period (optional: today|week|month, default: week)
 * 
 * Response:
 * {
 *   tenant_id: string
 *   period: string
 *   total_entries: number
 *   active_entries: number
 *   notified_entries: number
 *   converted_entries: number
 *   expired_entries: number
 *   conversion_rate: number (percentage)
 *   avg_wait_minutes: number
 *   avg_position: number
 *   top_services: Array<{
 *     package_id: string
 *     package_name: string
 *     entry_count: number
 *     conversion_rate: number
 *   }>
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const tenant_id = searchParams.get('tenant_id');
    const period = (searchParams.get('period') || 'week') as 'today' | 'week' | 'month';

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // Validate period
    const validPeriods = ['today', 'week', 'month'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: `period must be one of: ${validPeriods.join(', ')}` },
        { status: 400 }
      );
    }

    // Get stats
    const stats = await getWaitlistStats(tenant_id, period);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API /waitlist/stats GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
