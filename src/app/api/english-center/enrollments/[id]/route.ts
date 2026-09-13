/**
 * E2 — English Center Enrollment Detail API
 * GET /api/english-center/enrollments/:id - Get enrollment detail
 * PATCH /api/english-center/enrollments/:id - Update enrollment context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { EnglishCenterEnrollmentService } from '@/products/bella-english-center/services/enrollment.service';
import { UpdateEnglishEnrollmentInput } from '@/products/bella-english-center/types/enrollment.types';

/**
 * GET /api/english-center/enrollments/:id
 * Get enrollment detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const enrollmentId = params.id;

    // Get enrollment
    const service = new EnglishCenterEnrollmentService(supabase);
    const enrollment = await service.getEnrollment(tenantId, enrollmentId);

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    return NextResponse.json(enrollment, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/enrollments/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/english-center/enrollments/:id
 * Update enrollment context (class, program, metadata)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const enrollmentId = params.id;

    // Parse request body
    const body = await request.json();
    const input: UpdateEnglishEnrollmentInput = {
      classId: body.classId,
      programId: body.programId,
      metadata: body.metadata,
    };

    // Update enrollment context
    const service = new EnglishCenterEnrollmentService(supabase);
    const enrollment = await service.updateEnrollmentContext(tenantId, enrollmentId, input);

    return NextResponse.json(enrollment, { status: 200 });
  } catch (error: unknown) {
    console.error('PATCH /api/english-center/enrollments/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
