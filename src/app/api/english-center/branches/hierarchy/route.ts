/**
 * @fileoverview English Center Branch Hierarchy API
 * 
 * GET /api/english-center/branches/hierarchy - Get branch hierarchy tree
 */

import { NextRequest, NextResponse } from 'next/server';
import { englishBranchService } from '@/products/bella-english-center/services/branch.service';
import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const rootId = searchParams.get('rootId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    const hierarchy = await englishBranchService.getBranchHierarchy(
      rootId || null,
      tenantId
    );

    return NextResponse.json({
      success: true,
      hierarchy,
      count: hierarchy.length,
    });
  } catch (error) {
    console.error('[GET /api/english-center/branches/hierarchy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branch hierarchy' },
      { status: 500 }
    );
  }
}
