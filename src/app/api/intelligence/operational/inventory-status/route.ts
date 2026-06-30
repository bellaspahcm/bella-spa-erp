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
import { isValidTenantId } from '@/services/intelligence/shared/helpers';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const stockStatus = searchParams.get('stockStatus') as 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock' | null;

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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Inventory Status error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get inventory status', details: errorMessage },
      { status: 500 }
    );
  }
}
