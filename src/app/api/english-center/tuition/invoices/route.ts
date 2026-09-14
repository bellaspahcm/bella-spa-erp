import { NextRequest, NextResponse } from 'next/server';
import { TuitionBillingService } from '@/products/bella-english-center/services/tuition-billing.service';
import { IssueTuitionInvoiceInput } from '@/products/bella-english-center/types/tuition-billing.types';
import { apiError, getEnglishCenterApiContext, parseRequiredSearchParam } from '../../_shared';

export async function GET(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const invoiceId = parseRequiredSearchParam(searchParams, 'invoiceId');
    if (invoiceId instanceof NextResponse) return invoiceId;

    const service = new TuitionBillingService(auth.context.supabase);
    const receivable = await service.getReceivableView(auth.context.tenantId, invoiceId);

    return NextResponse.json(receivable, { status: 200 });
  } catch (error: unknown) {
    return apiError(error, 'GET /api/english-center/tuition/invoices error:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input: IssueTuitionInvoiceInput = {
      assignmentId: body.assignmentId,
      invoiceNumber: body.invoiceNumber,
      dueDate: body.dueDate,
      lines: body.lines,
      discountAmountMinor: body.discountAmountMinor,
      issuedAt: body.issuedAt,
      ledgerPosting: body.ledgerPosting,
      metadata: body.metadata,
    };

    if (!input.assignmentId || !input.invoiceNumber || !input.dueDate || !Array.isArray(input.lines)) {
      return NextResponse.json(
        { error: 'Missing required fields: assignmentId, invoiceNumber, dueDate, lines' },
        { status: 400 }
      );
    }

    const service = new TuitionBillingService(auth.context.supabase);
    const invoice = await service.issueInvoice(auth.context.tenantId, input);

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, 'POST /api/english-center/tuition/invoices error:');
  }
}
