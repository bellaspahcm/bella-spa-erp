/**
 * Package Recommendation API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/recommendation/package
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { recommendationService } from '@/services/intelligence/recommendation';
import type { PackageRecommendationInput } from '@/services/intelligence/recommendation/types';

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
    
    // Get parameters
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || user.user_metadata?.tenant_id;
    const customerId = searchParams.get('customer_id');
    
    if (!tenantId || !customerId) {
      return NextResponse.json(
        { error: 'Tenant ID and Customer ID are required' },
        { status: 400 }
      );
    }
    
    // Parse optional parameters
    const limit = parseInt(searchParams.get('limit') || '3');
    const algorithm = (searchParams.get('algorithm') as any) || undefined;
    
    // Parse filters
    const minPrice = searchParams.get('min_price') ? parseFloat(searchParams.get('min_price')!) : undefined;
    const maxPrice = searchParams.get('max_price') ? parseFloat(searchParams.get('max_price')!) : undefined;
    const minSessions = searchParams.get('min_sessions') ? parseInt(searchParams.get('min_sessions')!) : undefined;
    const maxSessions = searchParams.get('max_sessions') ? parseInt(searchParams.get('max_sessions')!) : undefined;
    
    // Build input
    const input: PackageRecommendationInput = {
      tenantId,
      customerId,
      limit,
      algorithm,
      filters: {
        minPrice,
        maxPrice,
        minSessions,
        maxSessions,
      },
    };
    
    // Get recommendations
    const result = await recommendationService.getPackageRecommendations(input);
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    console.error('Package recommendation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
