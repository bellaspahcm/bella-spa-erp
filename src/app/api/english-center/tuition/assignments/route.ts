import { NextRequest, NextResponse } from 'next/server';
import { TuitionBillingService } from '@/products/bella-english-center/services/tuition-billing.service';
import { AssignTuitionPlanInput } from '@/products/bella-english-center/types/tuition-billing.types';
import { apiError, getEnglishCenterApiContext } from '../../_shared';

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: AssignTuitionPlanInput = {
      tuitionPlanId: body.tuitionPlanId,
      englishEnrollmentId: body.englishEnrollmentId,
      classId: body.classId || null,
      startDate: body.startDate,
      endDate: body.endDate || null,
      metadata: body.metadata,
    };

    if (!input.tuitionPlanId || !input.englishEnrollmentId || !input.startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: tuitionPlanId, englishEnrollmentId, startDate' },
        { status: 400 }
      );
    }

    const service = new TuitionBillingService(auth.context.supabase);
    const assignment = await service.assignTuitionPlan(auth.context.tenantId, input);

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/tuition/assignments error:');
  }
}
