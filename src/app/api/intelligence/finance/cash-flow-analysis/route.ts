/**
 * API Route: Cash Flow Analysis
 * 
 * GET /api/intelligence/finance/cash-flow-analysis
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * 
 * Returns: CashFlowAnalysis[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFinanceIntelligenceService } from '@/services/intelligence/finance/service';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    let dateRange: TimePeriod | { startDate: string; endDate: string };
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = period;
    }

    // Call service
    const service = getFinanceIntelligenceService();
    const result = await service.getCashFlowAnalysis(tenantId, dateRange);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Cash flow analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get cash flow analysis', details: errorMessage },
      { status: 500 }
    );
  }
}
