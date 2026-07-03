/**
 * API Route: Inventory Forecast
 * 
 * GET /api/intelligence/operational/inventory-forecast
 * 
 * Query params:
 * - productId: string (required) - Product ID
 * - days: number (optional, default: 30) - Forecast horizon in days
 * 
 * Returns: InventoryForecast with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOperationalIntelligenceService } from '@/services/intelligence/operational';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';
import { getTenantIdFromSessionOrParam } from '../../shared/get-tenant-id';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    
    // Get tenantId from session
    const result = await getTenantIdFromSessionOrParam(searchParams);
    if (result instanceof NextResponse) {
      return result; // Return error response
    }
    const { tenantId } = result;

    const productId = searchParams.get('productId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Validate required params
    if (!productId) {
      return NextResponse.json(
        { error: 'Missing required parameter: productId' },
        { status: 400 }
      );
    }

    if (!isValidTenantId(productId)) {
      return NextResponse.json(
        { error: 'Invalid productId format (must be UUID v4)' },
        { status: 400 }
      );
    }

    // Validate days
    if (isNaN(days) || days <= 0 || days > 365) {
      return NextResponse.json(
        { error: 'Invalid days parameter (must be between 1 and 365)' },
        { status: 400 }
      );
    }

    // Call service
    const service = getOperationalIntelligenceService();
    const serviceResult = await service.getInventoryForecast(tenantId, productId, days);

    return NextResponse.json(serviceResult, { status: 200 });
  } catch (error) {
    console.error('[API] Inventory Forecast error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get inventory forecast', details: errorMessage },
      { status: 500 }
    );
  }
}
