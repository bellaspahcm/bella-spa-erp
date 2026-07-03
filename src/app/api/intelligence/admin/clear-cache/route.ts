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

export async function DELETE() {
  try {
    const cache = getCache();
    await cache.clear();

    return NextResponse.json(
      { 
        success: true,
        message: 'Intelligence cache cleared successfully',
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
