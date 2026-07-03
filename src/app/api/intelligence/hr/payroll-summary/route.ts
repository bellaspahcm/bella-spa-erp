/**
 * API Route: Payroll Summary
 * 
 * GET /api/intelligence/hr/payroll-summary
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - month: string (required) - Month in YYYY-MM format (e.g., '2026-06')
 * - ktvId: string (optional) - UUID of specific KTV
 * 
 * Returns: PayrollSummary[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHRIntelligenceService } from '@/services/intelligence/hr/service';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';
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
    
    const month = searchParams.get('month');
    const ktvId = searchParams.get('ktvId') || undefined;

    // Validate required params
    if (!month) {
      return NextResponse.json(
        { error: 'Missing required parameter: month (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format (must be YYYY-MM, e.g., 2026-06)' },
        { status: 400 }
      );
    }

    // Validate ktvId if provided
    if (ktvId && !isValidTenantId(ktvId)) {
      return NextResponse.json(
        { error: 'Invalid ktvId format (must be UUID v4)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getHRIntelligenceService();
    const result = await service.getPayrollSummary(tenantId, month, ktvId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Payroll Summary error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get payroll summary', details: errorMessage },
      { status: 500 }
    );
  }
}
