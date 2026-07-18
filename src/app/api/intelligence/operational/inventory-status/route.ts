/**
 * API Route: Inventory Status
 * 
 * GET /api/intelligence/operational/inventory-status
 * 
 * Query params:
 * - tenantId: string (required)
 * - stockStatus: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock' (optional)
 * 
 * Returns: InventoryStatus[] with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOperationalIntelligenceService } from '@/services/intelligence/operational';
import { getTenantIdFromSessionOrParam } from '../../shared/get-tenant-id';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const stockStatus = searchParams.get('stockStatus') as 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock' | null;

    // Auto-fetch tenantId from session or fallback to query param
    const tenantIdResult = await getTenantIdFromSessionOrParam(searchParams);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const { tenantId } = tenantIdResult;

    // Validate stockStatus if provided
    if (stockStatus && !['out_of_stock', 'low_stock', 'medium_stock', 'high_stock'].includes(stockStatus)) {
      return NextResponse.json(
        { error: 'Invalid stockStatus (must be: out_of_stock, low_stock, medium_stock, or high_stock)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getOperationalIntelligenceService();
    const result = await service.getInventoryStatus(tenantId, stockStatus || undefined);

    const response = NextResponse.json(result, { status: 200 });
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (error) {
    console.error('[API] Inventory Status error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get inventory status', details: errorMessage },
      { status: 500 }
    );
  }
}
