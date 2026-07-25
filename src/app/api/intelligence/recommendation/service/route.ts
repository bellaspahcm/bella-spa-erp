/**
 * Service Recommendation API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * GET /api/intelligence/recommendation/service
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { recommendationService } from '@/services/intelligence/recommendation';
import type { ServiceRecommendationInput } from '@/services/intelligence/recommendation/types';

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
    const limit = parseInt(searchParams.get('limit') || '5');
    const algorithm = (searchParams.get('algorithm') as ServiceRecommendationInput['algorithm']) || undefined;
    const excludeServices = searchParams.get('exclude')?.split(',') || [];
    
    // Parse filters
    const minPrice = searchParams.get('min_price') ? parseFloat(searchParams.get('min_price')!) : undefined;
    const maxPrice = searchParams.get('max_price') ? parseFloat(searchParams.get('max_price')!) : undefined;
    const category = searchParams.get('category') || undefined;
    const minRating = searchParams.get('min_rating') ? parseFloat(searchParams.get('min_rating')!) : undefined;
    
    // Build input
    const input: ServiceRecommendationInput = {
      tenantId,
      customerId,
      limit,
      algorithm,
      excludeServices: excludeServices.length > 0 ? excludeServices : undefined,
      filters: {
        minPrice,
        maxPrice,
        category,
        minRating,
      },
    };
    
    // Get recommendations
    const result = await recommendationService.getServiceRecommendations(input);
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    console.error('Service recommendation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
