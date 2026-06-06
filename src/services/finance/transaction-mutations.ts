'use server';

import { revalidatePath } from 'next/cache';
import { getLocalDateString } from '@/lib/utils';
import { resolveTenantId } from './shared';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { buildRevenueAccountingMetadata, inferBusinessEventType } from '@/services/accounting/template-rules';
import { resolveReviewStatus } from './transaction-review';
import type { Database } from '@/types/database.types';

type RevenueInsert = Database['public']['Tables']['revenue']['Insert'];
type RevenueUpdate = Database['public']['Tables']['revenue']['Update'];
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];
type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase-server')['createClient']>>;

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function withRollbackFailure(error: unknown, rollbackError: string) {
  const message = getErrorMessage(error);
  return rollbackError ? `${message}; rollback failed: ${rollbackError}` : message;
}

async function rollbackRevenueConfirmation(
  supabase: SupabaseClient,
  id: string,
  payload: RevenueUpdate,
) {
  const { error } = await supabase
    .from('revenue')
    .update(payload)
    .eq('id', id);

  return error?.message || '';
}

async function rollbackExpenseConfirmation(
  supabase: SupabaseClient,
  id: string,
  payload: ExpenseUpdate,
) {
  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id);

  return error?.message || '';
}

async function rollbackSalaryRecord(
  supabase: SupabaseClient,
  id: string,
  payload: SalaryRecordUpdate,
) {
  const { error } = await supabase
    .from('salary_records')
    .update(payload)
    .eq('id', id);

  return error?.message || '';
}

async function deleteInsertedFinanceRow(
  supabase: SupabaseClient,
  table: 'expenses' | 'revenue',
  id: string,
) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  return error?.message || '';
}

const PACKAGE_SALE_REVENUE_TYPES = ['deposit', 'remaining_payment', 'package_payment', 'package_sale'];
const VALID_REVENUE_TYPES = ['deposit', 'session_completed', 'additional', 'package_payment', 'remaining_payment', 'refund'];

function normalizeFinanceCategory(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function isRevenueRefundInput(amount: number, category: string) {
  return amount < 0 || normalizeFinanceCategory(category) === 'refund';
}

function isRevenueRefundType(revenueType: string | null | undefined) {
  return normalizeFinanceCategory(revenueType) === 'refund';
}

function buildRefundOutboxPayload(input: {
  amount: number;
  paymentMethod?: string | null;
  description?: string | null;
  branchId: string;
}) {
  const amount = Math.abs(input.amount);

  return {
    amount,
    deferredRefundAmount: 0,
    revenueReductionAmount: amount,
    paymentMethod: input.paymentMethod || 'bank_transfer',
    description: input.description || 'Hoan tien khach hang',
    branchId: input.branchId,
  };
}

function assertOutboxEnqueued(result: unknown, eventType: string) {
  if (result === false) {
    throw new Error(`Failed to enqueue ${eventType} accounting event`);
  }
}

export async function confirmTransaction(id: string, type: 'revenue' | 'expense') {
  const { assertLegacyFinanceWriteAllowed } = await import('../accounting-actions');
  await assertLegacyFinanceWriteAllowed('Xác nhận giao dịch Finance legacy');

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  const today = getLocalDateString();

  if (type === 'revenue') {
    const { data: existingRev, error: existingRevError } = await supabase
      .from('revenue')
      .select('revenue_type, amount, payment_method, booking_id, notes, tenant_id, status, received_date, business_event_type, accounting_review_status, accounting_metadata')
      .eq('id', id)
      .single();

    if (existingRevError) {
      console.error(`Error fetching revenue before confirmation:`, existingRevError);
      throw new Error(`Failed to fetch revenue before confirmation: ${existingRevError.message}`);
    }

    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType: existingRev?.revenue_type,
    });
    const accountingPayload = buildRevenueAccountingMetadata({
      revenueType: existingRev?.revenue_type,
      amount: Number(existingRev?.amount || 0),
      paymentMethod: existingRev?.payment_method,
      bookingId: existingRev?.booking_id,
      reason: existingRev?.notes,
    });
    const revenueRollbackPayload: RevenueUpdate = {
      status: existingRev?.status,
      received_date: existingRev?.received_date,
      business_event_type: existingRev?.business_event_type,
      accounting_review_status: existingRev?.accounting_review_status,
      accounting_metadata: existingRev?.accounting_metadata,
    };
    await assertOpenAccountingPeriod(supabase, {
      tenantId: existingRev?.tenant_id,
      date: today,
      context: 'Confirm revenue transaction',
    });
    const revenueUpdatePayload: RevenueUpdate = {
      status: 'confirmed',
      received_date: today,
      business_event_type: businessEventType,
      accounting_review_status: resolveReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload,
    };

    const { data: updatedRev, error } = await supabase
      .from('revenue')
      .update(revenueUpdatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error(`Error confirming revenue:`, error);
      throw new Error(`Failed to confirm revenue: ${error.message}`);
    }

    // Enqueue the accounting event that matches the confirmed revenue source type.
    if (updatedRev && updatedRev.tenant_id && isRevenueRefundType(updatedRev.revenue_type)) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      try {
        const enqueued = await enqueueWithAutoClient(
          supabase,
          {
            tenantId: updatedRev.tenant_id,
            eventType: 'REFUND_ISSUED',
            referenceType: 'REVENUE',
            referenceId: updatedRev.id,
            payload: buildRefundOutboxPayload({
              amount: Number(updatedRev.amount),
              paymentMethod: updatedRev.payment_method,
              description: updatedRev.notes,
              branchId: updatedRev.tenant_id,
            }),
          },
          '[confirmTransaction]'
        );
        assertOutboxEnqueued(enqueued, 'REFUND_ISSUED');
      } catch (outboxError) {
        const rollbackError = await rollbackRevenueConfirmation(supabase, id, revenueRollbackPayload);
        throw new Error(withRollbackFailure(outboxError, rollbackError));
      }
    } else if (updatedRev && updatedRev.tenant_id && PACKAGE_SALE_REVENUE_TYPES.includes(updatedRev.revenue_type || '')) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      try {
        const enqueued = await enqueueWithAutoClient(
          supabase,
          {
            tenantId: updatedRev.tenant_id,
            eventType: 'PACKAGE_SALE',
            referenceType: 'REVENUE',
            referenceId: updatedRev.id,
            payload: {
              totalAmount: Number(updatedRev.amount),
              vatRate: 0,
              description: updatedRev.notes || 'Xác nhận thanh toán gói dịch vụ',
              // TODO Phase 29: dùng branch_id thực khi multi-branch
              branchId: updatedRev.tenant_id,
            },
          },
          '[confirmTransaction]'
        );
        assertOutboxEnqueued(enqueued, 'PACKAGE_SALE');
      } catch (outboxError) {
        const rollbackError = await rollbackRevenueConfirmation(supabase, id, revenueRollbackPayload);
        throw new Error(withRollbackFailure(outboxError, rollbackError));
      }
    }
  } else {
    const { data: existingExpense, error: existingExpenseError } = await supabase
      .from('expenses')
      .select('category, amount, description, tenant_id, status, expense_date, business_event_type, accounting_review_status, accounting_metadata')
      .eq('id', id)
      .single();

    if (existingExpenseError) {
      console.error(`Error fetching expense before confirmation:`, existingExpenseError);
      throw new Error(`Failed to fetch expense before confirmation: ${existingExpenseError.message}`);
    }

    const businessEventType = inferBusinessEventType({
      sourceTable: 'expenses',
      category: existingExpense?.category,
    });
    const accountingPayload = {
      amount: Number(existingExpense?.amount || 0),
      payment_method: 'bank_transfer',
      expense_date: today,
      description: existingExpense?.description,
    };
    const expenseRollbackPayload: ExpenseUpdate = {
      status: existingExpense?.status,
      expense_date: existingExpense?.expense_date,
      business_event_type: existingExpense?.business_event_type,
      accounting_review_status: existingExpense?.accounting_review_status,
      accounting_metadata: existingExpense?.accounting_metadata,
    };
    await assertOpenAccountingPeriod(supabase, {
      tenantId: existingExpense?.tenant_id,
      date: today,
      context: 'Confirm expense transaction',
    });
    const expenseUpdatePayload: ExpenseUpdate = {
      status: 'approved',
      expense_date: today,
      business_event_type: businessEventType,
      accounting_review_status: resolveReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload,
    };

    const { data: updatedExpense, error } = await supabase
      .from('expenses')
      .update(expenseUpdatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error(`Error confirming expense:`, error);
      throw new Error(`Failed to confirm expense: ${error.message}`);
    }

    // ⭐ Enqueue EXPENSE_RECORDED or SALARY_PAID event
    if (updatedExpense && updatedExpense.tenant_id) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');

      if (updatedExpense.category === 'salary') {
        const salaryRecordIdMatch = updatedExpense.description?.match(/\[salary_record_id:([^\]]*)\]/);
        const ktvIdMatch = updatedExpense.description?.match(/\[ktv_id:([^\]]*)\]/);
        const salaryRecordId = salaryRecordIdMatch ? salaryRecordIdMatch[1] : null;
        const ktvId = ktvIdMatch ? ktvIdMatch[1] : null;

        if (salaryRecordId && ktvId) {
          const { data: existingSalaryRecord, error: salaryRecordFetchError } = await supabase
            .from('salary_records')
            .select('status, paid_date, paid_method, business_event_type, accounting_review_status, accounting_metadata')
            .eq('id', salaryRecordId)
            .single();

          if (salaryRecordFetchError) {
            const rollbackError = await rollbackExpenseConfirmation(supabase, id, expenseRollbackPayload);
            throw new Error(withRollbackFailure(salaryRecordFetchError, rollbackError));
          }

          const salaryBusinessEventType = inferBusinessEventType({
            sourceTable: 'salary_records',
            status: 'paid',
          });
          const salaryAccountingPayload = {
            amount: Number(updatedExpense.amount),
            payment_method: 'bank_transfer',
            ktv_id: ktvId,
            month_year: today.slice(0, 7),
          };
          const salaryRecordUpdatePayload: SalaryRecordUpdate = {
            status: 'paid',
            paid_date: today,
            paid_method: 'bank_transfer',
            business_event_type: salaryBusinessEventType,
            accounting_review_status: resolveReviewStatus(salaryBusinessEventType, salaryAccountingPayload),
            accounting_metadata: salaryAccountingPayload,
          };
          const salaryRecordRollbackPayload: SalaryRecordUpdate = {
            status: existingSalaryRecord?.status,
            paid_date: existingSalaryRecord?.paid_date,
            paid_method: existingSalaryRecord?.paid_method,
            business_event_type: existingSalaryRecord?.business_event_type,
            accounting_review_status: existingSalaryRecord?.accounting_review_status,
            accounting_metadata: existingSalaryRecord?.accounting_metadata,
          };

          // Update salary record status to 'paid'
          const { error: salaryRecordUpdateError } = await supabase
            .from('salary_records')
            .update(salaryRecordUpdatePayload)
            .eq('id', salaryRecordId);

          if (salaryRecordUpdateError) {
            console.error('[confirmTransaction] Failed to update salary record status:', salaryRecordUpdateError);
            const rollbackError = await rollbackExpenseConfirmation(supabase, id, expenseRollbackPayload);
            throw new Error(withRollbackFailure(salaryRecordUpdateError, rollbackError));
          }

          try {
            const enqueued = await enqueueWithAutoClient(
              supabase,
              {
                tenantId: updatedExpense.tenant_id,
                eventType: 'SALARY_PAID',
                referenceType: 'SALARY_RECORD',
                referenceId: salaryRecordId,
                payload: {
                  amount: Number(updatedExpense.amount),
                  paymentMethod: 'bank_transfer',
                  description: updatedExpense.description || 'Thanh toán lương',
                  ktvId,
                  // TODO Phase 29: dùng branch_id thực khi multi-branch
                  branchId: updatedExpense.tenant_id,
                },
              },
              '[confirmTransaction]'
            );
            assertOutboxEnqueued(enqueued, 'SALARY_PAID');
          } catch (outboxError) {
            const salaryRollbackError = await rollbackSalaryRecord(supabase, salaryRecordId, salaryRecordRollbackPayload);
            const expenseRollbackError = await rollbackExpenseConfirmation(supabase, id, expenseRollbackPayload);
            const rollbackError = [salaryRollbackError, expenseRollbackError].filter(Boolean).join('; ');
            throw new Error(withRollbackFailure(outboxError, rollbackError));
          }
          revalidatePath('/dashboard/finance');
          return { success: true };
        }
      }

      try {
        const enqueued = await enqueueWithAutoClient(
          supabase,
          {
            tenantId: updatedExpense.tenant_id,
            eventType: 'EXPENSE_RECORDED',
            referenceType: 'EXPENSE',
            referenceId: updatedExpense.id,
            payload: {
              amount: Number(updatedExpense.amount),
              category: updatedExpense.category,
              paymentMethod: 'bank_transfer', // default
              description: updatedExpense.description || 'Chi phí vận hành',
              // TODO Phase 29: dùng branch_id thực khi multi-branch
              branchId: updatedExpense.tenant_id,
            },
          },
          '[confirmTransaction]'
        );
        assertOutboxEnqueued(enqueued, 'EXPENSE_RECORDED');
      } catch (outboxError) {
        const rollbackError = await rollbackExpenseConfirmation(supabase, id, expenseRollbackPayload);
        throw new Error(withRollbackFailure(outboxError, rollbackError));
      }
    }
  }

  revalidatePath('/dashboard/finance');
  return { success: true };
}

export async function recordTransaction(data: {
  amount: number;
  type: 'revenue' | 'expense';
  category: string;
  notes: string;
  status?: string;
  booking_id?: string;
}) {
  const { assertLegacyFinanceWriteAllowed } = await import('../accounting-actions');
  await assertLegacyFinanceWriteAllowed('Ghi nhận giao dịch Finance legacy');

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const tenantId = await resolveTenantId();

  try {
    if (data.type === 'expense') {
      // Map frontend categories to valid DB values
      const catMap: Record<string, string> = {
        'office_rent': 'rent',
        'other_admin': 'other',
        'materials': 'materials',
        'maintenance': 'maintenance'
      };
      const dbCategory = catMap[data.category] || data.category || 'other';

      // expenses.status: 'approved' | 'submitted' | 'rejected'
      const dbStatus = data.status === 'confirmed' ? 'approved' : 'submitted';
      const expenseDate = getLocalDateString();
      const businessEventType = inferBusinessEventType({
        sourceTable: 'expenses',
        category: dbCategory,
      });
      const accountingPayload = {
        amount: Math.abs(data.amount),
        payment_method: 'bank_transfer',
        expense_date: expenseDate,
        description: data.notes,
      };
      await assertOpenAccountingPeriod(supabase, {
        tenantId,
        date: expenseDate,
        context: 'Record expense transaction',
      });
      const expenseInsertPayload: ExpenseInsert = {
        amount: Math.abs(data.amount),
        category: dbCategory,
        description: data.notes,
        status: dbStatus,
        expense_date: expenseDate,
        tenant_id: tenantId,
        business_event_type: businessEventType,
        accounting_review_status: resolveReviewStatus(businessEventType, accountingPayload),
        accounting_metadata: accountingPayload,
      };

      const { data: result, error } = await supabase
        .from('expenses')
        .insert(expenseInsertPayload)
        .select()
        .single();

      if (error) {
        console.error('[recordTransaction] expense error:', error);
        throw error;
      }

      // ⭐ Ghi nhận Outbox nếu đã được phê duyệt
      if (dbStatus === 'approved' && result) {
        const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
        try {
          const enqueued = await enqueueWithAutoClient(
            supabase,
            {
              tenantId,
              eventType: 'EXPENSE_RECORDED',
              referenceType: 'EXPENSE',
              referenceId: result.id,
              payload: {
                amount: Math.abs(data.amount),
                category: dbCategory,
                paymentMethod: 'bank_transfer',
                description: data.notes || 'Chi phí vận hành',
                // TODO Phase 29: dùng branch_id thực khi multi-branch
                branchId: tenantId,
              },
            },
            '[recordTransaction]'
          );
          assertOutboxEnqueued(enqueued, 'EXPENSE_RECORDED');
        } catch (outboxError) {
          const rollbackError = await deleteInsertedFinanceRow(supabase, 'expenses', result.id);
          throw new Error(withRollbackFailure(outboxError, rollbackError));
        }
      }

      revalidatePath('/dashboard/finance');
      return result;
    } else {
      // revenue.status: 'confirmed' | 'pending'
      const dbStatus = data.status === 'confirmed' ? 'confirmed' : 'pending';

      // Map frontend categories to valid DB revenue_type values
      const dbRevenueType = isRevenueRefundInput(data.amount, data.category)
        ? 'refund'
        : VALID_REVENUE_TYPES.includes(data.category)
          ? data.category
          : 'additional';
      const receivedDate = getLocalDateString();
      const businessEventType = inferBusinessEventType({
        sourceTable: 'revenue',
        revenueType: dbRevenueType,
      });
      const accountingPayload = buildRevenueAccountingMetadata({
        revenueType: dbRevenueType,
        amount: data.amount,
        paymentMethod: 'bank_transfer',
        bookingId: data.booking_id || null,
        reason: data.notes,
      });
      await assertOpenAccountingPeriod(supabase, {
        tenantId,
        date: receivedDate,
        context: 'Record revenue transaction',
      });
      const revenueInsertPayload: RevenueInsert = {
        amount: Math.abs(data.amount),
        notes: data.notes,
        booking_id: data.booking_id || null,
        revenue_type: dbRevenueType,
        payment_method: 'bank_transfer',
        status: dbStatus,
        received_date: receivedDate,
        tenant_id: tenantId,
        business_event_type: businessEventType,
        accounting_review_status: resolveReviewStatus(businessEventType, accountingPayload),
        accounting_metadata: accountingPayload,
      };

      const { data: result, error } = await supabase
        .from('revenue')
        .insert(revenueInsertPayload)
        .select()
        .single();

      if (error) {
        console.error('[recordTransaction] revenue error:', error);
        throw error;
      }

      // Enqueue the accounting event that matches the newly recorded revenue source type.
      if (dbStatus === 'confirmed' && result && isRevenueRefundType(dbRevenueType)) {
        const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
        try {
          const enqueued = await enqueueWithAutoClient(
            supabase,
            {
              tenantId,
              eventType: 'REFUND_ISSUED',
              referenceType: 'REVENUE',
              referenceId: result.id,
              payload: buildRefundOutboxPayload({
                amount: data.amount,
                paymentMethod: 'bank_transfer',
                description: data.notes,
                branchId: tenantId,
              }),
            },
            '[recordTransaction]'
          );
          assertOutboxEnqueued(enqueued, 'REFUND_ISSUED');
        } catch (outboxError) {
          const rollbackError = await deleteInsertedFinanceRow(supabase, 'revenue', result.id);
          throw new Error(withRollbackFailure(outboxError, rollbackError));
        }
      } else if (dbStatus === 'confirmed' && result && PACKAGE_SALE_REVENUE_TYPES.includes(dbRevenueType)) {
        const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
        try {
          const enqueued = await enqueueWithAutoClient(
            supabase,
            {
              tenantId,
              eventType: 'PACKAGE_SALE',
              referenceType: 'REVENUE',
              referenceId: result.id,
              payload: {
                totalAmount: Math.abs(data.amount),
                vatRate: 0,
                description: data.notes || 'Giao dịch doanh thu cọc/thanh toán gói',
                // TODO Phase 29: dùng branch_id thực khi multi-branch
                branchId: tenantId,
              },
            },
            '[recordTransaction]'
          );
          assertOutboxEnqueued(enqueued, 'PACKAGE_SALE');
        } catch (outboxError) {
          const rollbackError = await deleteInsertedFinanceRow(supabase, 'revenue', result.id);
          throw new Error(withRollbackFailure(outboxError, rollbackError));
        }
      }

      revalidatePath('/dashboard/finance');
      return result;
    }
  } catch (error: unknown) {
    console.error('[recordTransaction] failure:', error);
    throw new Error(error instanceof Error ? error.message : 'Lỗi hệ thống khi ghi nhận giao dịch');
  }
}
