/**
 * API Route: Attendance Report
 * 
 * GET /api/intelligence/hr/attendance-report
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - period: 'current_month' | 'last_month' | 'current_quarter' | 'custom' (optional)
 * - startDate: string YYYY-MM-DD (optional, for custom period)
 * - endDate: string YYYY-MM-DD (optional, for custom period)
 * - ktvId: string (optional) - UUID of specific KTV
 * 
 * Returns: AttendanceReport[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHRIntelligenceService } from '@/services/intelligence/hr/service';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const period = searchParams.get('period') as TimePeriod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const ktvId = searchParams.get('ktvId') || undefined;

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

    // Validate ktvId if provided
    if (ktvId && !isValidTenantId(ktvId)) {
      return NextResponse.json(
        { error: 'Invalid ktvId format (must be UUID v4)' },
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
    const result = await service.getAttendanceReport(tenantId, dateRange, ktvId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Attendance Report error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get attendance report', details: errorMessage },
      { status: 500 }
    );
  }
}
