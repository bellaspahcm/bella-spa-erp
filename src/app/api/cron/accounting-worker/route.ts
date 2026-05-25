import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { RevenueRecognitionService } from '@/services/revenue-recognition';
import { AccountingEngineService } from '@/services/accounting-engine';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Accounting Worker] CRON_SECRET environment variable is not configured.');
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET không được cấu hình trên server.' },
      { status: 500 }
    );
  }

  // Khớp token Authorization
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.warn('[Accounting Worker] Unauthorized trigger attempt.');
    return NextResponse.json(
      { success: false, error: 'Không được phép truy cập (Unauthorized).' },
      { status: 401 }
    );
  }

  console.log('[Accounting Worker] Started scanning outbox queue...');
  
  try {
    const supabase = getAdminClient();

    // 1. Claim next batch of events to process
    const { data: batch, error: claimError } = await supabase.rpc('claim_outbox_batch', {
      p_limit: 50,
    });

    if (claimError) {
      console.error('[Accounting Worker] Failed to claim outbox batch:', claimError);
      return NextResponse.json({ success: false, error: claimError.message }, { status: 500 });
    }

    const typedBatch = (batch as any[]) || [];
    if (typedBatch.length === 0) {
      console.log('[Accounting Worker] No pending outbox events found.');
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[Accounting Worker] Claimed ${typedBatch.length} events for processing.`);

    let successCount = 0;
    let failureCount = 0;

    // 2. Process each event in the batch sequentially to maintain strict transactional order
    for (const event of typedBatch) {
      try {
        const tenantId = event.tenant_id;
        const eventType = event.event_type;
        const refId = event.reference_id;
        const payload = event.payload;

        console.log(`[Accounting Worker] Processing event ${event.id} | Type: ${eventType} | Tenant: ${tenantId}`);

        let journalEntryId: string | null = null;

        // Định tuyến xử lý theo event_type
        switch (eventType) {
          case 'PACKAGE_SALE':
            journalEntryId = await RevenueRecognitionService.handlePackageSale({
              tenantId,
              packageSaleId: refId,
              totalAmount: payload.totalAmount,
              vatRate: payload.vatRate,
              description: payload.description,
              branchId: payload.branchId,
            });
            break;

          case 'SESSION_DONE':
            journalEntryId = await RevenueRecognitionService.handleSessionDone({
              tenantId,
              sessionLogId: refId,
              earnedRevenueAmount: payload.earnedRevenueAmount,
              commissionAmount: payload.commissionAmount,
              ktvId: payload.ktvId,
              branchId: payload.branchId,
              description: payload.description,
            });
            break;

          case 'EXPENSE_RECORDED':
            journalEntryId = await RevenueRecognitionService.handleExpenseRecorded({
              tenantId,
              expenseId: refId,
              amount: payload.amount,
              category: payload.category,
              paymentMethod: payload.paymentMethod,
              description: payload.description,
              branchId: payload.branchId,
            });
            break;

          case 'SALARY_PAID':
            journalEntryId = await RevenueRecognitionService.handleSalaryPaid({
              tenantId,
              salaryRecordId: refId,
              amount: payload.amount,
              paymentMethod: payload.paymentMethod,
              description: payload.description,
              ktvId: payload.ktvId,
              branchId: payload.branchId,
            });
            break;

          case 'INVENTORY_CONSUMED':
            journalEntryId = await RevenueRecognitionService.handleInventoryConsumed({
              tenantId,
              sessionLogId: refId,
              amount: payload.amount,
              description: payload.description,
              branchId: payload.branchId,
            });
            break;

          case 'REFUND_ISSUED':
            journalEntryId = await RevenueRecognitionService.handleRefundIssued({
              tenantId,
              refundId: refId,
              amount: payload.amount,
              paymentMethod: payload.paymentMethod,
              description: payload.description,
              branchId: payload.branchId,
            });
            break;

          case 'MANUAL_ENTRY':
            journalEntryId = await AccountingEngineService.postJournalEntry({
              tenant_id: tenantId,
              description: payload.description,
              lines: payload.lines,
              reference_type: 'MANUAL',
              reference_id: refId,
            });
            break;

          default:
            throw new Error(`Unsupported outbox event type: ${eventType}`);
        }

        // Cập nhật trạng thái COMPLETED
        if (journalEntryId) {
          const { error: completeErr } = await supabase.rpc('mark_outbox_completed', {
            p_outbox_id: event.id,
            p_journal_entry_id: journalEntryId,
          });

          if (completeErr) {
            throw new Error(`Failed to mark outbox completed: ${completeErr.message}`);
          }
          console.log(`[Accounting Worker] Event ${event.id} processed successfully. Entry: ${journalEntryId}`);
          successCount++;
        } else {
          // Trường hợp không phát sinh bút toán (ví dụ doanh số/hoa hồng = 0)
          // Vẫn mark completed với journal_entry_id = null
          const { error: completeErr } = await supabase.rpc('mark_outbox_completed', {
            p_outbox_id: event.id,
            p_journal_entry_id: null as any,
          });
          if (completeErr) {
            throw new Error(`Failed to mark outbox empty completed: ${completeErr.message}`);
          }
          console.log(`[Accounting Worker] Event ${event.id} completed with no journal entries generated.`);
          successCount++;
        }

      } catch (err: any) {
        console.error(`[Accounting Worker] Error processing event ${event.id}:`, err);
        failureCount++;

        // Cập nhật trạng thái FAILED (exponential backoff)
        const errMsg = err?.message || String(err);
        const { error: failErr } = await supabase.rpc('mark_outbox_failed', {
          p_outbox_id: event.id,
          p_error: errMsg,
        });

        if (failErr) {
          console.error(`[Accounting Worker] Critical: Failed to mark outbox as failed for ${event.id}:`, failErr);
        }
      }
    }

    console.log(`[Accounting Worker] Finished batch. Success: ${successCount}, Failures: ${failureCount}`);
    return NextResponse.json({
      success: true,
      processed: typedBatch.length,
      successCount,
      failureCount,
    });

  } catch (globalErr: any) {
    console.error('[Accounting Worker] Critical exception:', globalErr);
    return NextResponse.json(
      { success: false, error: globalErr?.message || 'Lỗi hệ thống khi chạy worker.' },
      { status: 500 }
    );
  }
}
