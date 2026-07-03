/**
 * API Route: RFM Analysis (Detailed Recency, Frequency, Monetary Scores)
 * 
 * GET /api/intelligence/customer/rfm-analysis
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * 
 * Returns: CustomerSegment[] with detailed RFM scores and cache metadata
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

    // Call service
    const service = getCustomerIntelligenceService();
    const result = await service.getRFMAnalysis(tenantId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] RFM Analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get RFM analysis', details: errorMessage },
      { status: 500 }
    );
  }
}
