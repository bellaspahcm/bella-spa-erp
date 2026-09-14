import { NextRequest, NextResponse } from 'next/server';
import { LearningOperationsService } from '@/products/bella-english-center/services/learning-operations.service';
import { RecordLearningProgressInput } from '@/products/bella-english-center/types/learning-operations.types';
import { apiError, getEnglishCenterApiContext, parseRequiredSearchParam } from '../../_shared';

export async function GET(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const englishEnrollmentId = parseRequiredSearchParam(searchParams, 'englishEnrollmentId');
    if (englishEnrollmentId instanceof NextResponse) return englishEnrollmentId;

    const { AssessmentContractImpl } = await import('@/platform/education/contracts/assessment.contract.impl');
    const service = new LearningOperationsService(auth.context.supabase, {
      assessment: new AssessmentContractImpl(),
    });
    const progress = await service.listLearningProgressByEnrollment(
      auth.context.tenantId,
      englishEnrollmentId
    );

    return NextResponse.json({ progress }, { status: 200 });
  } catch (error: unknown) {
    return apiError(error, 'GET /api/english-center/learning/progress error:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: RecordLearningProgressInput = {
      englishEnrollmentId: body.englishEnrollmentId,
      sessionId: body.sessionId || undefined,
      progressLabel: body.progressLabel,
      skillArea: body.skillArea || undefined,
      notes: body.notes || null,
      recordedBy: body.recordedBy || auth.context.userId,
      recordedAt: body.recordedAt,
      score: body.score,
      metadata: body.metadata,
    };

    if (!input.englishEnrollmentId || !input.progressLabel) {
      return NextResponse.json(
        { error: 'Missing required fields: englishEnrollmentId, progressLabel' },
        { status: 400 }
      );
    }

    const { AssessmentContractImpl } = await import('@/platform/education/contracts/assessment.contract.impl');
    const service = new LearningOperationsService(auth.context.supabase, {
      assessment: new AssessmentContractImpl(),
    });
    const progress = await service.recordLearningProgress(auth.context.tenantId, input);

    return NextResponse.json(progress, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/learning/progress error:');
  }
}
