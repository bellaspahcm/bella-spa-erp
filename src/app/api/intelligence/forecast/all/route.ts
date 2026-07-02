/**
 * All Forecasts API Route (Bulk)
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/forecast/all
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
    
    // Parse horizons
    const revenueHorizon = parseInt(searchParams.get('revenue_horizon') || '12');
    const churnHorizon = parseInt(searchParams.get('churn_horizon') || '30') as 30 | 60 | 90;
    const demandHorizon = parseInt(searchParams.get('demand_horizon') || '2');
    
    // Generate all forecasts
    const result = await forecastService.getAllForecasts(tenantId, {
      revenue: revenueHorizon,
      churn: churnHorizon,
      demand: demandHorizon,
    });
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Bulk forecast error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
