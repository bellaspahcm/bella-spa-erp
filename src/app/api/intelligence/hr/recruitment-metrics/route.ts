/**
 * API Route: Recruitment Metrics
 * 
 * GET /api/intelligence/hr/recruitment-metrics
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'current_month' | 'last_month' | 'current_quarter' | 'custom' (optional)
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * 
 * Returns: RecruitmentMetrics[] with cache metadata
 * 
 * Note: Requires recruitment tables (recruitment_candidates, recruitment_positions, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHRIntelligenceService } from '@/services/intelligence/hr/service';
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
    
    const period = searchParams.get('period') as TimePeriod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date range
    let dateRange: TimePeriod | { startDate: string; endDate: string } | undefined;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else if (period) {
      dateRange = period;
    }

    // Call service
    const service = getHRIntelligenceService();
    const result = await service.getRecruitmentMetrics(tenantId, dateRange);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Recruitment Metrics error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get recruitment metrics', details: errorMessage },
      { status: 500 }
    );
  }
}
