/**
 * @fileoverview English Center Branches API
 * 
 * GET /api/english-center/branches - List active branches
 * POST /api/english-center/branches - Create branch
 */

import { NextRequest, NextResponse } from 'next/server';
import { englishBranchService } from '@/products/bella-english-center/services/branch.service';
import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    const branches = await englishBranchService.getActiveBranches(tenantId);

    return NextResponse.json({
      success: true,
      branches,
      count: branches.length,
    });
  } catch (error) {
    console.error('[GET /api/english-center/branches] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      name,
      code,
      regionId,
      address,
      phone,
      email,
      capacity,
      openingHours,
    } = body;

    if (!tenantId || !name || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, name, code' },
        { status: 400 }
      );
    }

    const branch = await englishBranchService.createBranch({
      tenantId,
      name,
      code,
      regionId,
      address,
      phone,
      email,
      capacity,
      openingHours,
    });

    return NextResponse.json({
      success: true,
      branch,
    });
  } catch (error) {
    console.error('[POST /api/english-center/branches] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create branch' },
      { status: 500 }
    );
  }
}
