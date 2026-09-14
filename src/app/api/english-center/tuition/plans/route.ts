import { NextRequest, NextResponse } from 'next/server';
import { TuitionBillingService } from '@/products/bella-english-center/services/tuition-billing.service';
import { CreateTuitionPlanInput } from '@/products/bella-english-center/types/tuition-billing.types';
import { apiError, getEnglishCenterApiContext } from '../../_shared';

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: CreateTuitionPlanInput = {
      branchId: body.branchId || null,
      programId: body.programId || null,
      classId: body.classId || null,
      code: body.code,
      name: body.name,
      billingCycle: body.billingCycle,
      amountMinor: body.amountMinor,
      currency: body.currency || 'VND',
      metadata: body.metadata,
    };

    if (!input.code || !input.name || !input.billingCycle || !input.amountMinor) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, billingCycle, amountMinor' },
        { status: 400 }
      );
    }

    const service = new TuitionBillingService(auth.context.supabase);
    const plan = await service.createTuitionPlan(auth.context.tenantId, input);

    return NextResponse.json(plan, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/tuition/plans error:');
  }
}
