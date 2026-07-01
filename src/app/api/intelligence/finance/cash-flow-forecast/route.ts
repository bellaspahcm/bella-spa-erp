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
import { isValidTenantId } from '@/services/intelligence/shared/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const forecastMonthsParam = searchParams.get('forecastMonths');

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
