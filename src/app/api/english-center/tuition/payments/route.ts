import { NextRequest, NextResponse } from 'next/server';
import { TuitionBillingService } from '@/products/bella-english-center/services/tuition-billing.service';
import { RecordTuitionPaymentInput } from '@/products/bella-english-center/types/tuition-billing.types';
import { apiError, getEnglishCenterApiContext } from '../../_shared';

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: RecordTuitionPaymentInput = {
      invoiceId: body.invoiceId,
      payerPartyId: body.payerPartyId || null,
      amountMinor: body.amountMinor,
      currency: body.currency || 'VND',
      method: body.method,
      paymentDate: body.paymentDate,
      idempotencyKey: body.idempotencyKey,
      externalReference: body.externalReference || null,
      ledgerPosting: body.ledgerPosting,
      allocatedBy: body.allocatedBy || auth.context.userId,
      metadata: body.metadata,
    };

    if (!input.invoiceId || !input.amountMinor || !input.method || !input.paymentDate || !input.idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceId, amountMinor, method, paymentDate, idempotencyKey' },
        { status: 400 }
      );
    }

    const service = new TuitionBillingService(auth.context.supabase);
    const payment = await service.recordPayment(auth.context.tenantId, input);

    return NextResponse.json(payment, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/tuition/payments error:');
  }
}
