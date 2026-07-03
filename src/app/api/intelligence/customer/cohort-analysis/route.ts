/**
 * API Route: Cohort Analysis
 * 
 * GET /api/intelligence/customer/cohort-analysis
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - limit: number (optional) - Limit number of cohorts (default: 12 months)
 * 
 * Returns: CohortAnalysis[] with cache metadata
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
    
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 12; // Default 12 months

    // Validate limit if provided
    if (isNaN(limit) || limit <= 0 || limit > 36) {
      return NextResponse.json(
        { error: 'Invalid limit parameter (must be between 1 and 36)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getCustomerIntelligenceService();
    const result = await service.getCohortAnalysis(tenantId, limit);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Cohort Analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get cohort analysis', details: errorMessage },
      { status: 500 }
    );
  }
}
