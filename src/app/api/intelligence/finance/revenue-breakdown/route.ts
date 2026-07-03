/**
 * API Route: Revenue Breakdown
 * 
 * GET /api/intelligence/finance/revenue-breakdown
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * 
 * Returns: RevenueBreakdown with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFinanceIntelligenceService } from '@/services/intelligence/finance/service';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import { getTenantIdFromSessionOrParam } from '../../shared/get-tenant-id';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    
    // Get tenant ID from session or query param
    const tenantIdResult = await getTenantIdFromSessionOrParam(searchParams);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult; // Return error response
    }
    const { tenantId } = tenantIdResult;
    
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date range
    let dateRange: TimePeriod | { startDate: string; endDate: string };
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = period;
    }

    // Call service
    const service = getFinanceIntelligenceService();
    const result = await service.getRevenueBreakdown(tenantId, dateRange);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Revenue breakdown error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get revenue breakdown', details: errorMessage },
      { status: 500 }
    );
  }
}
