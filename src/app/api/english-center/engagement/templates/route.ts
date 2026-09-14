import { NextRequest, NextResponse } from 'next/server';
import { EngagementService } from '@/products/bella-english-center/services/engagement.service';
import { CreateEngagementTemplateInput } from '@/products/bella-english-center/types/engagement.types';
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
    const input: CreateEngagementTemplateInput = {
      branchId: body.branchId || null,
      code: body.code,
      name: body.name,
      category: body.category,
      defaultChannels: body.defaultChannels || ['in_app'],
      titleTemplate: body.titleTemplate,
      bodyTemplate: body.bodyTemplate,
      requiresAcknowledgement: Boolean(body.requiresAcknowledgement),
      metadata: body.metadata,
    };

    if (!input.code || !input.name || !input.category || !input.titleTemplate || !input.bodyTemplate) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, category, titleTemplate, bodyTemplate' },
        { status: 400 }
      );
    }

    const service = await createEngagementService(auth.context.supabase);
    const template = await service.createTemplate(auth.context.tenantId, input);

    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/engagement/templates error:');
  }
}
