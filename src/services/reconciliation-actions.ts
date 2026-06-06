'use server';

import { createClient } from '@/lib/supabase-server';
import { getLocalDateString } from '@/lib/utils';
import {
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus,
} from '@/services/accounting/template-rules';
import { assertOpenAccountingPeriod } from './accounting/period-guards';
import { assertLegacyFinanceWriteAllowed } from './accounting/mode';
import { getCurrentUser } from './user-actions';
import type { Database } from '@/types/database.types';
import {
  getInterBranchClearingRecordsResult,
  type InterBranchClearingRecord,
} from './clearing-actions';

type FinancialAnomaliesData = {
  debt_alerts: unknown[];
  orphaned_revenue: unknown[];
  mismatch_alerts: unknown[];
};

type FinancialReconciliationCollectionHistory = {
  revenue_id: string;
  amount: number | string | null;
  received_date: string | null;
  notes: string | null;
  payment_method: string | null;
  booking_id: string | null;
  customer_name: string;
};

type RevenueHistoryRow = {
  id: string;
  amount: number | string | null;
  received_date: string | null;
  notes: string | null;
  payment_method: string | null;
  booking_id: string | null;
  bookings?: {
    customers?: {
      name_mother?: string | null;
      name_baby?: string | null;
    } | null;
  } | null;
};

type FinancialReconciliationSnapshot = FinancialAnomaliesData & {
  tenant_id: string;
  collection_history: FinancialReconciliationCollectionHistory[];
  clearing_records: InterBranchClearingRecord[];
  clearing_error: string | null;
};

type ReconciliationRole = string | null | undefined;

function canWriteReconciliation(role: ReconciliationRole) {
  return role === 'admin' || role === 'accountant';
}

function assertOutboxEnqueued(result: unknown, eventType: string) {
  if (result === false) {
    throw new Error(`Failed to enqueue ${eventType} accounting event`);
  }
}

function withRollbackFailure(error: unknown, rollbackError: string) {
  const message = error instanceof Error ? error.message : 'Lỗi hệ thống';
  return rollbackError ? `${message}; rollback failed: ${rollbackError}` : message;
}

async function deleteInsertedRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  revenueId: string,
) {
  const { error } = await supabase
    .from('revenue')
    .delete()
    .eq('id', revenueId);

  return error?.message || '';
}

export async function getFinancialAnomalies() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized or missing tenant ID', data: null };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_financial_anomalies', {
      p_tenant_id: user.tenant_id,
    });

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return {
      success: true,
      data: data as FinancialAnomaliesData,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load financial anomalies',
      data: null,
    };
  }
}

export async function getFinancialReconciliationSnapshot(): Promise<{
  success: boolean;
  error?: string;
  data: FinancialReconciliationSnapshot | null;
}> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Không tìm thấy thông tin chi nhánh', data: null };
    }

    const supabase = await createClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_financial_anomalies', {
      p_tenant_id: user.tenant_id,
    });

    if (rpcError) {
      return {
        success: false,
        error: `Lỗi tải bản đối soát tài chính: ${rpcError.message}`,
        data: null,
      };
    }

    const { data: historyData, error: historyError } = await supabase
      .from('revenue')
      .select(`
        id, amount, received_date, notes, payment_method, booking_id,
        bookings (
          customers (
            name_mother, name_baby
          )
        )
      `)
      .eq('tenant_id', user.tenant_id)
      .in('revenue_type', ['additional', 'remaining_payment'])
      .order('received_date', { ascending: false });

    if (historyError) {
      return {
        success: false,
        error: `Lỗi tải lịch sử thu nợ: ${historyError.message}`,
        data: null,
      };
    }

    const historyRows = (historyData || []) as unknown as RevenueHistoryRow[];
    const collectionHistory: FinancialReconciliationCollectionHistory[] = historyRows.map((item) => ({
      revenue_id: item.id,
      amount: item.amount,
      received_date: item.received_date,
      notes: item.notes,
      payment_method: item.payment_method,
      booking_id: item.booking_id,
      customer_name: item.bookings?.customers?.name_mother || item.bookings?.customers?.name_baby || 'Khách hàng',
    }));

    const anomalies = (rpcData || {}) as Partial<FinancialAnomaliesData>;
    const clearingResult = await getInterBranchClearingRecordsResult(user.tenant_id);

    return {
      success: true,
      data: {
        tenant_id: user.tenant_id,
        debt_alerts: Array.isArray(anomalies.debt_alerts) ? anomalies.debt_alerts : [],
        orphaned_revenue: Array.isArray(anomalies.orphaned_revenue) ? anomalies.orphaned_revenue : [],
        mismatch_alerts: Array.isArray(anomalies.mismatch_alerts) ? anomalies.mismatch_alerts : [],
        collection_history: collectionHistory,
        clearing_records: clearingResult.data,
        clearing_error: clearingResult.success ? null : clearingResult.error,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Không thể tải dữ liệu đối soát',
      data: null,
    };
  }
}

export async function allocateOrphanedRevenue(revenueId: string, bookingId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.tenant_id || !canWriteReconciliation(user.role)) {
      return { success: false, error: 'Không có quyền thực hiện thao tác này' };
    }
    await assertLegacyFinanceWriteAllowed('Phân bổ doanh thu treo');

    const supabase = await createClient();
    const { data: existingRevenue, error: existingRevenueError } = await supabase
      .from('revenue')
      .select('received_date, tenant_id')
      .eq('id', revenueId)
      .eq('tenant_id', user.tenant_id)
      .is('booking_id', null)
      .single();

    if (existingRevenueError || !existingRevenue) {
      return { success: false, error: existingRevenueError?.message || 'Không tìm thấy doanh thu treo' };
    }

    await assertOpenAccountingPeriod(supabase, {
      tenantId: existingRevenue.tenant_id,
      date: existingRevenue.received_date,
      context: 'Allocate orphaned revenue',
    });

    const payload: Database['public']['Tables']['revenue']['Update'] = {
      booking_id: bookingId,
      status: 'confirmed',
    };

    const { error } = await supabase
      .from('revenue')
      .update(payload)
      .eq('id', revenueId)
      .eq('tenant_id', user.tenant_id)
      .is('booking_id', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to allocate revenue' };
  }
}

export async function collectDebtPayment(input: {
  bookingId: string;
  amount: number;
  paymentMethod: 'bank_transfer' | 'cash';
  customerName?: string | null;
  packageName?: string | null;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.tenant_id || !canWriteReconciliation(user.role)) {
      return { success: false, error: 'Không có quyền thu tiền' };
    }
    await assertLegacyFinanceWriteAllowed('Thu đối soát công nợ');

    if (!input.bookingId) return { success: false, error: 'Thiếu booking cần thu tiền' };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: 'Số tiền không hợp lệ' };
    }

    const customerStr = input.customerName || 'Khách hàng';
    const packageStr = input.packageName || 'Gói Dịch Vụ';
    const shortBookingId = input.bookingId.split('-')[0]?.toUpperCase() || 'N/A';
    const revenueType = 'remaining_payment';
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType,
    });
    const accountingPayload = buildRevenueAccountingMetadata({
      revenueType,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      bookingId: input.bookingId,
      reason: `Thu đối soát công nợ - KH: ${customerStr} - Gói: ${packageStr} (Booking: ${shortBookingId})`,
    });
    const receivedDate = getLocalDateString();
    const supabase = await createClient();
    await assertOpenAccountingPeriod(supabase, {
      tenantId: user.tenant_id,
      date: receivedDate,
      context: 'Collect debt payment',
    });

    const payload: Database['public']['Tables']['revenue']['Insert'] = {
      tenant_id: user.tenant_id,
      booking_id: input.bookingId,
      amount: input.amount,
      revenue_type: revenueType,
      notes: accountingPayload.reason,
      status: 'confirmed',
      payment_method: input.paymentMethod,
      received_date: receivedDate,
      recorded_by_id: user.id,
      business_event_type: businessEventType,
      accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload,
    };

    const { data: insertedRevenue, error } = await supabase
      .from('revenue')
      .insert(payload)
      .select('id, tenant_id, amount, notes')
      .single();
    if (error) return { success: false, error: error.message };
    if (!insertedRevenue?.id) {
      return { success: false, error: 'Không thể xác định giao dịch thu nợ vừa tạo' };
    }

    const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
    try {
      const enqueued = await enqueueWithAutoClient(
        supabase,
        {
          tenantId: user.tenant_id,
          eventType: 'PACKAGE_SALE',
          referenceType: 'REVENUE',
          referenceId: insertedRevenue.id,
          payload: {
            totalAmount: Math.abs(input.amount),
            vatRate: 0,
            description: insertedRevenue.notes || accountingPayload.reason || 'Thu đối soát công nợ',
            branchId: user.tenant_id,
          },
        },
        '[collectDebtPayment]'
      );
      assertOutboxEnqueued(enqueued, 'PACKAGE_SALE');
    } catch (outboxError) {
      const rollbackError = await deleteInsertedRevenue(supabase, insertedRevenue.id);
      return { success: false, error: withRollbackFailure(outboxError, rollbackError) };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống khi thu tiền' };
  }
}
