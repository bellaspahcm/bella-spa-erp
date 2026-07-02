/**
 * Upsell Recommendation API Route
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * POST /api/intelligence/recommendation/upsell
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { recommendationService } from '@/services/intelligence/recommendation';
import type { UpsellRecommendationInput } from '@/services/intelligence/recommendation/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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
    
    // Parse request body
    const body = await request.json();
    const { 
      tenant_id,
      customer_id,
      current_items,
      limit,
      algorithm,
    } = body;
    
    const tenantId = tenant_id || user.user_metadata?.tenant_id;
    
    if (!tenantId || !customer_id) {
      return NextResponse.json(
        { error: 'Tenant ID and Customer ID are required' },
        { status: 400 }
      );
    }
    
    if (!current_items || !Array.isArray(current_items) || current_items.length === 0) {
      return NextResponse.json(
        { error: 'Current items are required (array of {itemId, itemType})' },
        { status: 400 }
      );
    }
    
    // Build input
    const input: UpsellRecommendationInput = {
      tenantId,
      customerId: customer_id,
      currentItems: current_items.map((item: any) => ({
        itemId: item.item_id || item.itemId,
        itemType: item.item_type || item.itemType,
      })),
      limit: limit || 3,
      algorithm,
    };
    
    // Get recommendations
    const result = await recommendationService.getUpsellRecommendations(input);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Upsell recommendation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
