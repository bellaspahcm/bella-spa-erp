/**
 * API Route: Monthly P&L Statements
 * 
 * GET /api/intelligence/finance/monthly-pnl
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'current_month' | 'last_month' | 'custom' (optional, default: 'current_month')
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * 
 * Returns: MonthlyPnL[] with cache metadata
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
    const period = (searchParams.get('period') || 'current_month') as TimePeriod;
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
    const result = await service.getMonthlyPnL(tenantId, dateRange);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Monthly P&L error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get monthly P&L statements', details: errorMessage },
      { status: 500 }
    );
  }
}
