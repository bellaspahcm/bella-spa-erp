/**
 * E2 — English Center Enrollment Activate API
 * POST /api/english-center/enrollments/:id/activate - Activate enrollment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { EnglishCenterEnrollmentService } from '@/products/bella-english-center/services/enrollment.service';

/**
 * POST /api/english-center/enrollments/:id/activate
 * Activate enrollment (delegates to Platform Enrollment Contract)
 */
export async function POST(
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

    // Activate enrollment
    const service = new EnglishCenterEnrollmentService(supabase);
    const enrollment = await service.activateEnrollment(tenantId, enrollmentId);

    return NextResponse.json(enrollment, { status: 200 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/enrollments/:id/activate error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
