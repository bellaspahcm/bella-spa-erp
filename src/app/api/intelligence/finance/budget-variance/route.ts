/**
 * API Route: Budget Variance Analysis
 * 
 * GET /api/intelligence/finance/budget-variance
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - month: string (required) - Month in YYYY-MM format (e.g., '2026-06')
 * 
 * Returns: BudgetVariance[] with cache metadata
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
    const month = searchParams.get('month');

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

    if (!month) {
      return NextResponse.json(
        { error: 'Missing required parameter: month' },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format (must be YYYY-MM, e.g., 2026-06)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getFinanceIntelligenceService();
    const result = await service.getBudgetVariance(tenantId, month);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Budget variance error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get budget variance', details: errorMessage },
      { status: 500 }
    );
  }
}
