import { NextRequest, NextResponse } from 'next/server';
import { EngagementService } from '@/products/bella-english-center/services/engagement.service';
import { QueueEngagementMessageInput } from '@/products/bella-english-center/types/engagement.types';
import { apiError, getEnglishCenterApiContext } from '../../_shared';

async function createEngagementService(supabase: ReturnType<typeof import('@/lib/supabase-server').createClient>) {
  const [{ partyEngine }, { StudentContractImpl }] = await Promise.all([
    import('@/platform/party'),
    import('@/platform/education/contracts/student.contract.impl'),
  ]);

  return new EngagementService(supabase, {
    students: new StudentContractImpl(),
    parties: partyEngine,
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: QueueEngagementMessageInput = {
      templateId: body.templateId || null,
      triggerType: body.triggerType,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      englishEnrollmentId: body.englishEnrollmentId,
      studentPartyId: body.studentPartyId,
      branchId: body.branchId || null,
      content: body.content,
      recipients: body.recipients,
      requiresAcknowledgement: body.requiresAcknowledgement,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata,
      dispatchNow: body.dispatchNow === true,
    };

    if (
      !input.triggerType ||
      !input.sourceType ||
      !input.sourceId ||
      !input.englishEnrollmentId ||
      !input.studentPartyId ||
      !input.content ||
      !Array.isArray(input.recipients) ||
      !input.idempotencyKey
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: triggerType, sourceType, sourceId, englishEnrollmentId, studentPartyId, content, recipients, idempotencyKey',
        },
        { status: 400 }
      );
    }

    const service = await createEngagementService(auth.context.supabase);
    const message = await service.queueMessage(auth.context.tenantId, input);

    return NextResponse.json(message, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/engagement/messages error:');
  }
}
