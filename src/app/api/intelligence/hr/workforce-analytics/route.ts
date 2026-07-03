/**
 * API Route: Workforce Analytics
 * 
 * GET /api/intelligence/hr/workforce-analytics
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'current_month' | 'last_month' | 'current_quarter' | 'custom' (optional)
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * 
 * Returns: WorkforceAnalytics[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHRIntelligenceService } from '@/services/intelligence/hr/service';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import { getCurrentUser } from '@/services/user-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId');
    const period = searchParams.get('period') as TimePeriod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get tenant ID from session or query param
    let tenantId: string;
    if (tenantIdParam) {
      tenantId = tenantIdParam;
    } else {
      // Get from session
      const user = await getCurrentUser();
      if (!user?.tenant_id) {
        return NextResponse.json(
          { error: 'User not authenticated or missing tenant context' },
          { status: 401 }
        );
      }
      tenantId = user.tenant_id;
    }

    // Validate tenantId
    if (!isValidTenantId(tenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenantId format (must be UUID v4)' },
        { status: 400 }
      );
    }

    // Build date range
    let dateRange: TimePeriod | { startDate: string; endDate: string } | undefined;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else if (period) {
      dateRange = period;
    }

    // Call service
    const service = getHRIntelligenceService();
    const result = await service.getWorkforceAnalytics(tenantId, dateRange);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Workforce Analytics error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get workforce analytics', details: errorMessage },
      { status: 500 }
    );
  }
}
