/**
 * API Route: KTV Performance Metrics
 * 
 * GET /api/intelligence/operational/ktv-performance
 * 
 * Query params:
 * - ktvId: string (required) - KTV user ID
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom range)
 * - endDate: string YYYY-MM-DD (optional, for custom range)
 * 
 * Returns: KtvPerformance[] with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOperationalIntelligenceService } from '@/services/intelligence/operational';
import { periodToDateRange, isValidTenantId } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import { getTenantIdFromSessionOrParam } from '../../shared/get-tenant-id';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    
    // Get tenantId from session
    const result = await getTenantIdFromSessionOrParam(searchParams);
    if (result instanceof NextResponse) {
      return result; // Return error response
    }
    const { tenantId } = result;

    const ktvId = searchParams.get('ktvId');
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate required params
    if (!ktvId) {
      return NextResponse.json(
        { error: 'Missing required parameter: ktvId' },
        { status: 400 }
      );
    }

    if (!isValidTenantId(ktvId)) {
      return NextResponse.json(
        { error: 'Invalid ktvId format (must be UUID v4)' },
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
    const serviceResult = await service.getKtvPerformance(tenantId, ktvId, dateRange);

    return NextResponse.json(serviceResult, { status: 200 });
  } catch (error) {
    console.error('[API] KTV Performance error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get KTV performance metrics', details: errorMessage },
      { status: 500 }
    );
  }
}
