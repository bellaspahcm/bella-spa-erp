/**
 * E2 — English Center Enrollments API
 * POST /api/english-center/enrollments - Create enrollment
 * GET /api/english-center/enrollments - List enrollments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { EnglishCenterEnrollmentService } from '@/products/bella-english-center/services/enrollment.service';
import { CreateEnglishEnrollmentInput } from '@/products/bella-english-center/types/enrollment.types';

/**
 * POST /api/english-center/enrollments
 * Create new English Center enrollment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant from user metadata
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: body.studentPartyId,
      courseId: body.courseId,
      branchId: body.branchId,
      programId: body.programId,
      classId: body.classId,
      intake: body.intake,
      englishLevelAtEnrollment: body.englishLevelAtEnrollment,
      metadata: body.metadata,
    };

    // Validate required fields
    if (!input.studentPartyId || !input.courseId || !input.branchId) {
      return NextResponse.json(
        { error: 'Missing required fields: studentPartyId, courseId, branchId' },
        { status: 400 }
      );
    }

    // Create enrollment
    const service = new EnglishCenterEnrollmentService(supabase);
    const enrollment = await service.createEnrollment(tenantId, input);

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/enrollments error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/english-center/enrollments
 * List English Center enrollments with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant from user metadata
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;
    const status = searchParams.get('status') as
      | 'pending'
      | 'active'
      | 'completed'
      | 'cancelled'
      | undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // List enrollments
    const service = new EnglishCenterEnrollmentService(supabase);
    const result = await service.listEnrollments(tenantId, {
      branchId,
      status,
      limit,
      offset,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/enrollments error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
