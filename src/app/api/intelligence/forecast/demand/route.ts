/**
 * Demand Forecast API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/forecast/demand
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { forecastService } from '@/services/intelligence/forecast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get tenant_id
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || user.user_metadata?.tenant_id;
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Parse query parameters
    const horizon = parseInt(searchParams.get('months') || searchParams.get('horizon') || '2');
    const itemType = (searchParams.get('item_type') || 'service') as 'service' | 'package';
    
    if (horizon < 1 || horizon > 12) {
      return NextResponse.json(
        { error: 'Horizon must be between 1 and 12 months' },
        { status: 400 }
      );
    }
    
    if (!['service', 'package'].includes(itemType)) {
      return NextResponse.json(
        { error: 'Item type must be "service" or "package"' },
        { status: 400 }
      );
    }
    
    // Build forecast input (cast horizon to ForecastHorizon type)
    const input = {
      tenantId,
      forecastType: 'demand' as const,
      forecastHorizon: horizon as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
      itemType,
    };
    
    // Generate forecast
    const result = await forecastService.getDemandForecast(input);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Demand forecast error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
