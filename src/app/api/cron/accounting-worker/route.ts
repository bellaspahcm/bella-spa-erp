import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { RevenueRecognitionService } from '@/services/revenue-recognition';
import { AccountingEngineService, type JournalEntryInput } from '@/services/accounting-engine';

export const dynamic = 'force-dynamic';

type AdminClient = ReturnType<typeof getAdminClient>;
type OutboxEvent = Database['public']['Functions']['claim_outbox_batch']['Returns'][number];
type OutboxPayload = Record<string, Json | undefined>;
type WorkerEventResult = {
  eventId: string;
  eventType: string;
  referenceId: string;
  status: 'completed' | 'failed' | 'critical_failed';
  journalEntryId?: string | null;
  error?: string;
  markFailedError?: string;
};
type MarkOutboxCompletedRpc = (
  fn: 'mark_outbox_completed',
  args: { p_outbox_id: string; p_journal_entry_id: string | null }
) => ReturnType<AdminClient['rpc']>;

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

function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error === null || error === undefined) return fallback;
  return String(error);
}

function asPayloadRecord(payload: Json): OutboxPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid outbox payload: payload must be an object.');
  }
  return payload;
}

function readRequiredNumber(payload: OutboxPayload, key: string) {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Invalid outbox payload: ${key} must be a number.`);
}

function readOptionalNumber(payload: OutboxPayload, key: string, defaultValue = 0) {
  const value = payload[key];
  if (value === undefined || value === null) return defaultValue;
  return readRequiredNumber(payload, key);
}

function readRequiredString(payload: OutboxPayload, key: string) {
  const value = payload[key];
  if (typeof value === 'string') return value;
  throw new Error(`Invalid outbox payload: ${key} must be a string.`);
}

function readOptionalString(payload: OutboxPayload, key: string) {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  throw new Error(`Invalid outbox payload: ${key} must be a string.`);
}

function readJournalLines(payload: OutboxPayload): JournalEntryInput['lines'] {
  const lines = payload.lines;
  if (!Array.isArray(lines)) {
    throw new Error('Invalid outbox payload: lines must be an array.');
  }

  return lines.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      throw new Error(`Invalid outbox payload: lines[${index}] must be an object.`);
    }

    return {
      account_id: readRequiredString(line, 'account_id'),
      debit_amount: readRequiredNumber(line, 'debit_amount'),
      credit_amount: readRequiredNumber(line, 'credit_amount'),
      branch_id: readOptionalString(line, 'branch_id'),
      ktv_id: readOptionalString(line, 'ktv_id'),
      cost_center_id: readOptionalString(line, 'cost_center_id'),
    };
  });
}

async function markOutboxCompleted(supabase: AdminClient, outboxId: string, journalEntryId: string | null) {
  const markCompleted = supabase.rpc as unknown as MarkOutboxCompletedRpc;
  return markCompleted('mark_outbox_completed', {
    p_outbox_id: outboxId,
    p_journal_entry_id: journalEntryId,
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

    const typedBatch: OutboxEvent[] = batch || [];
    if (typedBatch.length === 0) {
      console.log('[Accounting Worker] No pending outbox events found.');
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[Accounting Worker] Claimed ${typedBatch.length} events for processing.`);

    let successCount = 0;
    let failureCount = 0;
    let criticalFailureCount = 0;
    const details: WorkerEventResult[] = [];

    // 2. Process each event in the batch sequentially to maintain strict transactional order
    for (const event of typedBatch) {
      try {
        const tenantId = event.tenant_id;
        const eventType = event.event_type;
        const refId = event.reference_id;
        const payload = asPayloadRecord(event.payload);

        console.log(`[Accounting Worker] Processing event ${event.id} | Type: ${eventType} | Tenant: ${tenantId}`);

        let journalEntryId: string | null = null;

        // Định tuyến xử lý theo event_type
        switch (eventType) {
          case 'PACKAGE_SALE':
            journalEntryId = await RevenueRecognitionService.handlePackageSale({
              tenantId,
              packageSaleId: refId,
              totalAmount: readRequiredNumber(payload, 'totalAmount'),
              vatRate: readOptionalNumber(payload, 'vatRate'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'SESSION_DONE':
            journalEntryId = await RevenueRecognitionService.handleSessionDone({
              tenantId,
              sessionLogId: refId,
              earnedRevenueAmount: readRequiredNumber(payload, 'earnedRevenueAmount'),
              commissionAmount: readRequiredNumber(payload, 'commissionAmount'),
              ktvId: readRequiredString(payload, 'ktvId'),
              branchId: readOptionalString(payload, 'branchId'),
              description: readRequiredString(payload, 'description'),
            });
            break;

          case 'EXPENSE_RECORDED':
            journalEntryId = await RevenueRecognitionService.handleExpenseRecorded({
              tenantId,
              expenseId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              category: readRequiredString(payload, 'category'),
              paymentMethod: readRequiredString(payload, 'paymentMethod'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'SALARY_PAID':
            journalEntryId = await RevenueRecognitionService.handleSalaryPaid({
              tenantId,
              salaryRecordId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              paymentMethod: readOptionalString(payload, 'paymentMethod'),
              description: readRequiredString(payload, 'description'),
              ktvId: readRequiredString(payload, 'ktvId'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'INVENTORY_CONSUMED':
            journalEntryId = await RevenueRecognitionService.handleInventoryConsumed({
              tenantId,
              sessionLogId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'REFUND_ISSUED':
            journalEntryId = await RevenueRecognitionService.handleRefundIssued({
              tenantId,
              refundId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              paymentMethod: readOptionalString(payload, 'paymentMethod'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'MANUAL_ENTRY':
            journalEntryId = await AccountingEngineService.postJournalEntry({
              tenant_id: tenantId,
              description: readRequiredString(payload, 'description'),
              lines: readJournalLines(payload),
              reference_type: 'MANUAL',
              reference_id: refId,
            });
            break;

          default:
            throw new Error(`Unsupported outbox event type: ${eventType}`);
        }

        // Cập nhật trạng thái COMPLETED
        if (journalEntryId) {
          const { error: completeErr } = await markOutboxCompleted(supabase, event.id, journalEntryId);

          if (completeErr) {
            throw new Error(`Failed to mark outbox completed: ${completeErr.message}`);
          }
          console.log(`[Accounting Worker] Event ${event.id} processed successfully. Entry: ${journalEntryId}`);
          successCount++;
          details.push({
            eventId: event.id,
            eventType,
            referenceId: refId,
            status: 'completed',
            journalEntryId,
          });
        } else {
          // Trường hợp không phát sinh bút toán (ví dụ doanh số/hoa hồng = 0)
          // Vẫn mark completed với journal_entry_id = null
          const { error: completeErr } = await markOutboxCompleted(supabase, event.id, null);
          if (completeErr) {
            throw new Error(`Failed to mark outbox empty completed: ${completeErr.message}`);
          }
          console.log(`[Accounting Worker] Event ${event.id} completed with no journal entries generated.`);
          successCount++;
          details.push({
            eventId: event.id,
            eventType,
            referenceId: refId,
            status: 'completed',
            journalEntryId: null,
          });
        }

      } catch (err: unknown) {
        console.error(`[Accounting Worker] Error processing event ${event.id}:`, err);
        failureCount++;

        // Cập nhật trạng thái FAILED (exponential backoff)
        const errMsg = getErrorMessage(err);
        const { error: failErr } = await supabase.rpc('mark_outbox_failed', {
          p_outbox_id: event.id,
          p_error: errMsg,
        });

        if (failErr) {
          console.error(`[Accounting Worker] Critical: Failed to mark outbox as failed for ${event.id}:`, failErr);
          criticalFailureCount++;
          details.push({
            eventId: event.id,
            eventType: event.event_type,
            referenceId: event.reference_id,
            status: 'critical_failed',
            error: errMsg,
            markFailedError: failErr.message,
          });
        } else {
          details.push({
            eventId: event.id,
            eventType: event.event_type,
            referenceId: event.reference_id,
            status: 'failed',
            error: errMsg,
          });
        }
      }
    }

    console.log(`[Accounting Worker] Finished batch. Success: ${successCount}, Failures: ${failureCount}`);
    const status = criticalFailureCount > 0
      ? 'critical_failure'
      : failureCount === 0 ? 'success' : 'partial_failure';

    return NextResponse.json({
      success: failureCount === 0 && criticalFailureCount === 0,
      status,
      processed: typedBatch.length,
      successCount,
      failureCount,
      criticalFailureCount,
      details,
    });

  } catch (globalErr: unknown) {
    console.error('[Accounting Worker] Critical exception:', globalErr);
    return NextResponse.json(
      { success: false, error: getErrorMessage(globalErr) || 'Lỗi hệ thống khi chạy worker.' },
      { status: 500 }
    );
  }
}
