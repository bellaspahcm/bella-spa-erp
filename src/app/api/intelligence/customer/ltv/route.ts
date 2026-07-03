/**
 * API Route: Customer LTV (Lifetime Value)
 * 
 * GET /api/intelligence/customer/ltv
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - cohortMonth: string (optional) - Filter by cohort month (YYYY-MM format)
 * - valueTier: string (optional) - Filter by value tier (VIP, High Value, Medium Value, etc.)
 * - limit: number (optional) - Limit number of results
 * 
 * Returns: CustomerLTV[] with cache metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCustomerIntelligenceService } from '@/services/intelligence/customer';
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
    
    const cohortMonth = searchParams.get('cohortMonth');
    const valueTier = searchParams.get('valueTier');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // Validate cohort month format if provided
    if (cohortMonth && !/^\d{4}-\d{2}$/.test(cohortMonth)) {
      return NextResponse.json(
        { error: 'Invalid cohortMonth format (must be YYYY-MM)' },
        { status: 400 }
      );
    }

    // Validate limit if provided
    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter (must be positive integer)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getCustomerIntelligenceService();
    const result = await service.getCustomerLTV(
      tenantId,
      cohortMonth ?? undefined,
      valueTier ?? undefined,
      limit
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Customer LTV error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get customer LTV', details: errorMessage },
      { status: 500 }
    );
  }
}
