/**
 * API Route: Capacity Utilization
 * 
 * GET /api/intelligence/operational/capacity-utilization
 * 
 * Query params:
 * - tenantId: string (required)
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom range)
 * - endDate: string YYYY-MM-DD (optional, for custom range)
 * 
 * Returns: CapacityUtilization[] with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOperationalIntelligenceService } from '@/services/intelligence/operational';
import { periodToDateRange, isValidTenantId } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate required params
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required parameter: tenantId' },
        { status: 400 }
      );
    }

    if (!isValidTenantId(tenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenantId format (must be UUID v4)' },
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
    const result = await service.getCapacityUtilization(tenantId, dateRange);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Capacity Utilization error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get capacity utilization metrics', details: errorMessage },
      { status: 500 }
    );
  }
}
