/**
 * API Route: Customer Segmentation (RFM Analysis)
 * 
 * GET /api/intelligence/customer/segmentation
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - segment: string (optional) - Filter by segment (Champions, Loyal Customers, At Risk, etc.)
 * - limit: number (optional) - Limit number of results
 * 
 * Returns: CustomerSegment[] with cache metadata
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
    const segment = searchParams.get('segment');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

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
    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter (must be positive integer)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getCustomerIntelligenceService();
    const result = await service.getCustomerSegmentation(
      tenantId,
      segment ?? undefined,
      limit
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Customer Segmentation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get customer segmentation', details: errorMessage },
      { status: 500 }
    );
  }
}
