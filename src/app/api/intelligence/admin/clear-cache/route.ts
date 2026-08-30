/**
 * Admin API: Clear Intelligence Layer Cache
 * 
 * DELETE /api/intelligence/admin/clear-cache
 * 
 * Force clears all cached Intelligence data.
 * Use when data has been updated and cache needs immediate refresh.
 */

import { NextResponse } from 'next/server';
import { getCache } from '@/services/intelligence/cache';
import { createServiceClient } from '@/lib/supabase-service-client';

export async function DELETE() {
  try {
    const cache = getCache();
    await cache.clear();

    // Refresh database materialized views
    const supabase = createServiceClient();
    if (supabase) {
      console.log('[API/clear-cache] Refreshing database materialized views...');
      const [financeRefresh, intelligenceRefresh] = await Promise.all([
        supabase.rpc('refresh_all_finance_mvs'),
        supabase.rpc('refresh_all_intelligence_materialized_views'),
      ]);
      if (financeRefresh.error) {
        console.warn('[API/clear-cache] Failed to refresh finance materialized views:', financeRefresh.error);
      }
      if (intelligenceRefresh.error) {
        console.warn('[API/clear-cache] Failed to refresh operational materialized views:', intelligenceRefresh.error);
      }
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Intelligence cache and database views refreshed successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Clear cache error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to clear cache', details: errorMessage },
      { status: 500 }
    );
  }
}
