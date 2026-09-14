import { NextRequest, NextResponse } from 'next/server';
import { LearningOperationsService } from '@/products/bella-english-center/services/learning-operations.service';
import { MarkSessionAttendanceInput } from '@/products/bella-english-center/types/learning-operations.types';
import { apiError, getEnglishCenterApiContext, parseRequiredSearchParam } from '../../_shared';

export async function GET(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const sessionId = parseRequiredSearchParam(searchParams, 'sessionId');
    if (sessionId instanceof NextResponse) return sessionId;

    const { AttendanceContractImpl } = await import('@/platform/education/contracts/attendance.contract.impl');
    const service = new LearningOperationsService(auth.context.supabase, {
      attendance: new AttendanceContractImpl(),
    });
    const result = await service.getSessionAttendance(auth.context.tenantId, sessionId);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return apiError(error, 'GET /api/english-center/learning/attendance error:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: MarkSessionAttendanceInput = {
      sessionId: body.sessionId,
      rollCallTime: body.rollCallTime,
      markedBy: body.markedBy || auth.context.userId,
      attendance: body.attendance,
    };

    if (!input.sessionId || !Array.isArray(input.attendance) || input.attendance.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, attendance' },
        { status: 400 }
      );
    }

    const { AttendanceContractImpl } = await import('@/platform/education/contracts/attendance.contract.impl');
    const service = new LearningOperationsService(auth.context.supabase, {
      attendance: new AttendanceContractImpl(),
    });
    const result = await service.markSessionAttendance(auth.context.tenantId, input);

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/learning/attendance error:');
  }
}
