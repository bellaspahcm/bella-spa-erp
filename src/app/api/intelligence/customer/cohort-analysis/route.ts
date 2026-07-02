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
import { isValidTenantId } from '@/services/intelligence/shared/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 12; // Default 12 months

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
