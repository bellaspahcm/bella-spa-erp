/**
 * Forecast Accuracy API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/forecast/accuracy
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
    const forecastType = searchParams.get('type') as 'revenue' | 'churn' | 'demand';
    
    if (!forecastType || !['revenue', 'churn', 'demand'].includes(forecastType)) {
      return NextResponse.json(
        { error: 'Type must be "revenue", "churn", or "demand"' },
        { status: 400 }
      );
    }
    
    // Get accuracy metrics
    const result = await forecastService.getForecastAccuracy(tenantId, forecastType);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error: any) {
    console.error('Forecast accuracy error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
