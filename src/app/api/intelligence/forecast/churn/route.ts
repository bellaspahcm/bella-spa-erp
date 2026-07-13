/**
 * Churn Forecast API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/forecast/churn
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
    // Accept 'months' param and map to nearest valid churn horizon (30/60/90 days)
    const monthsParam = parseInt(searchParams.get('months') || '0');
    let horizon: 30 | 60 | 90;
    if (monthsParam > 0) {
      // Map months to days: 1 month ≈ 30 days, 2 months ≈ 60 days, 3+ months ≈ 90 days
      const days = monthsParam <= 1 ? 30 : monthsParam <= 2 ? 60 : 90;
      horizon = days as 30 | 60 | 90;
    } else {
      horizon = parseInt(searchParams.get('horizon') || '30') as 30 | 60 | 90;
    }
    
    if (![30, 60, 90].includes(horizon)) {
      return NextResponse.json(
        { error: 'Horizon must be 30, 60, or 90 days' },
        { status: 400 }
      );
    }
    
    // Build forecast input
    const input: ForecastInput = {
      tenantId,
      forecastType: 'churn',
      forecastHorizon: horizon as 30 | 60 | 90,
    };
    
    // Generate forecast
    const result = await forecastService.getChurnForecast(input);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Churn forecast failed', message: result.error?.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Churn forecast error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
