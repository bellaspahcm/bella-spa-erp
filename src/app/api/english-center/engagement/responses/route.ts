import { NextRequest, NextResponse } from 'next/server';
import { EngagementService } from '@/products/bella-english-center/services/engagement.service';
import { RecordEngagementResponseInput } from '@/products/bella-english-center/types/engagement.types';
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
    const input: RecordEngagementResponseInput = {
      recipientId: body.recipientId,
      responseType: body.responseType,
      body: body.body || null,
      actorPartyId: body.actorPartyId,
      respondedAt: body.respondedAt,
      metadata: body.metadata,
    };

    if (!input.recipientId || !input.responseType || !input.actorPartyId) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientId, responseType, actorPartyId' },
        { status: 400 }
      );
    }

    const service = await createEngagementService(auth.context.supabase);
    const response = await service.recordResponse(auth.context.tenantId, input);

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/engagement/responses error:');
  }
}
