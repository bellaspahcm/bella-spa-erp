/**
 * API Route: Churn Risk Analysis
 * 
 * GET /api/intelligence/customer/churn-risk
 * 
 * Query params:
 * - tenantId: string (required) - UUID of tenant
 * - riskLevel: 'High' | 'Medium' | 'Low' (optional) - Filter by risk level
 * - limit: number (optional) - Limit number of results (default: high-risk customers)
 * 
 * Returns: CustomerActivitySummary[] with cache metadata
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
    const riskLevel = searchParams.get('riskLevel');
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

    // Validate risk level if provided
    if (riskLevel && !['High', 'Medium', 'Low'].includes(riskLevel)) {
      return NextResponse.json(
        { error: 'Invalid riskLevel (must be High, Medium, or Low)' },
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
    const result = await service.getChurnRiskAnalysis(
      tenantId,
      riskLevel as 'High' | 'Medium' | 'Low' | undefined,
      limit
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Churn Risk Analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get churn risk analysis', details: errorMessage },
      { status: 500 }
    );
  }
}
