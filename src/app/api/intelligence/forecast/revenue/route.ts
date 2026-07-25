/**
 * Revenue Forecast API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/forecast/revenue
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { forecastService } from '@/services/intelligence/forecast';
import type { ForecastInput } from '@/services/intelligence/forecast/types';

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
    
    // Get tenant_id from user metadata or query
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || user.user_metadata?.tenant_id;
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Parse query parameters — accept 'months' as alias for 'horizon'
    const horizon = parseInt(searchParams.get('months') || searchParams.get('horizon') || '12');
    const modelName = (searchParams.get('model') as any) || undefined;
    const confidenceLevel = parseFloat(searchParams.get('confidence') || '0.95');
    
    if (horizon < 1 || horizon > 12) {
      return NextResponse.json(
        { error: 'Horizon must be between 1 and 12 months' },
        { status: 400 }
      );
    }
    
    // Build forecast input (cast horizon to ForecastHorizon type)
    const input: ForecastInput = {
      tenantId,
      forecastType: 'revenue',
      forecastHorizon: horizon as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
      modelName,
      confidenceLevel,
    };
    
    // Generate forecast
    const result = await forecastService.getRevenueForecast(input);
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    console.error('Revenue forecast error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
