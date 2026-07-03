/**
 * API Route: Cash Flow Forecast
 * 
 * GET /api/intelligence/finance/cash-flow-forecast
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - forecastMonths: number (optional, default: 3, range: 1-12)
 * 
 * Returns: CashFlowForecast[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFinanceIntelligenceService } from '@/services/intelligence/finance/service';
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
    
    const forecastMonthsParam = searchParams.get('forecastMonths');

    // Parse and validate forecastMonths
    const forecastMonths = forecastMonthsParam ? parseInt(forecastMonthsParam, 10) : 3;

    if (isNaN(forecastMonths)) {
      return NextResponse.json(
        { error: 'Invalid forecastMonths (must be a number)' },
        { status: 400 }
      );
    }

    if (forecastMonths < 1 || forecastMonths > 12) {
      return NextResponse.json(
        { error: 'Invalid forecastMonths (must be between 1 and 12)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getFinanceIntelligenceService();
    const result = await service.getCashFlowForecast(tenantId, forecastMonths);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Cash flow forecast error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get cash flow forecast', details: errorMessage },
      { status: 500 }
    );
  }
}
