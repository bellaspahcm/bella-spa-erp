/**
 * @fileoverview English Center Single Branch API
 * 
 * GET /api/english-center/branches/[id] - Get branch details
 * PATCH /api/english-center/branches/[id] - Update branch
 * DELETE /api/english-center/branches/[id] - Archive branch
 */

import { NextRequest, NextResponse } from 'next/server';
import { englishBranchService } from '@/products/bella-english-center/services/branch.service';
import { createClient } from '@/lib/supabase-server';
import { EnglishBranchRepository } from '@/products/bella-english-center/services/branch.repository';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    const branch = await englishBranchService.getBranch(params.id, tenantId);

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Get academic summary
    const supabase = createClient();
    const branchRepository = new EnglishBranchRepository(supabase);
    const summary = await branchRepository.getBranchSummary(
      params.id,
      tenantId
    );

    return NextResponse.json({
      success: true,
      branch,
      summary,
    });
  } catch (error) {
    console.error('[GET /api/english-center/branches/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branch' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, address, phone, email, capacity, openingHours } = body;

    const branch = await englishBranchService.updateBranch(params.id, tenantId, {
      name,
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
    console.error('[PATCH /api/english-center/branches/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update branch' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    await englishBranchService.archiveBranch(params.id, tenantId);

    return NextResponse.json({
      success: true,
      message: 'Branch archived successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/english-center/branches/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to archive branch' },
      { status: 500 }
    );
  }
}
