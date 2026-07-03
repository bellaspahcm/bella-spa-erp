/**
 * API Route: Employee Performance
 * 
 * GET /api/intelligence/hr/employee-performance
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'current_month' | 'last_month' | 'current_quarter' | 'custom' (optional)
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * - ktvId: string (optional) - UUID of specific KTV
 * - limit: number (optional) - Limit for top performers (default: 10)
 * 
 * Returns: EmployeePerformance[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHRIntelligenceService } from '@/services/intelligence/hr/service';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';
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
    const ktvId = searchParams.get('ktvId') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // Validate ktvId if provided
    if (ktvId && !isValidTenantId(ktvId)) {
      return NextResponse.json(
        { error: 'Invalid ktvId format (must be UUID v4)' },
        { status: 400 }
      );
    }

    // Validate limit if provided
    if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
      return NextResponse.json(
        { error: 'Invalid limit (must be between 1 and 100)' },
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
    const result = await service.getEmployeePerformance(tenantId, dateRange, ktvId, limit);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Employee Performance error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get employee performance', details: errorMessage },
      { status: 500 }
    );
  }
}
