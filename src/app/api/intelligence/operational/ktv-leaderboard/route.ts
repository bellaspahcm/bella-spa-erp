/**
 * API Route: KTV Leaderboard
 * 
 * GET /api/intelligence/operational/ktv-leaderboard
 * 
 * Query params:
 * - tenantId: string (required)
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom range)
 * - endDate: string YYYY-MM-DD (optional, for custom range)
 * - metric: 'revenue' | 'sessions' | 'rating' (optional, default: 'revenue')
 * - limit: number (optional, default: 10)
 * 
 * Returns: KtvLeaderboardEntry[] with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOperationalIntelligenceService } from '@/services/intelligence/operational';
import { periodToDateRange } from '@/services/intelligence/shared/helpers';
import { getTenantIdFromSessionOrParam } from '../../shared/get-tenant-id';
import type { TimePeriod } from '@/services/intelligence/shared/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const metric = (searchParams.get('metric') || 'revenue') as 'revenue' | 'sessions' | 'rating';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Auto-fetch tenantId from session or fallback to query param
    const tenantIdResult = await getTenantIdFromSessionOrParam(searchParams);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const { tenantId } = tenantIdResult;

    // Validate metric
    if (!['revenue', 'sessions', 'rating'].includes(metric)) {
      return NextResponse.json(
        { error: 'Invalid metric (must be: revenue, sessions, or rating)' },
        { status: 400 }
      );
    }

    // Build date range
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else if (period) {
      dateRange = periodToDateRange(period);
    } else {
      dateRange = periodToDateRange('month'); // Default: current month
    }

    // Call service
    const service = getOperationalIntelligenceService();
    const result = await service.getKtvLeaderboard(tenantId, dateRange, metric, limit);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] KTV Leaderboard error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get KTV leaderboard', details: errorMessage },
      { status: 500 }
    );
  }
}
