'use server';

import { createClient } from '@/lib/supabase-server';
import { getLocalDateString } from '@bella/shared';;
import {
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus,
} from '@/core/services/accounting/template-rules';
import { assertOpenAccountingPeriod } from '../core/services/accounting/period-guards';
import { assertLegacyFinanceWriteAllowed } from '../core/services/accounting/mode';
import { getCurrentUser } from './user-actions';
import type { Database } from '@/types/database.types';
import {
  assertOutboxEnqueued,
  buildPackageSaleOutboxEvent,
} from '@/lib/business-rules/accounting-outbox';
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
type RevenueRow = Database['public']['Tables']['revenue']['Row'];
type RevenueUpdate = Database['public']['Tables']['revenue']['Update'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type OrphanedRevenueSnapshot = Pick<
  RevenueRow,
  | 'amount'
  | 'payment_method'
  | 'notes'
  | 'received_date'
  | 'tenant_id'
  | 'status'
  | 'revenue_type'
  | 'business_event_type'
  | 'accounting_review_status'
  | 'accounting_metadata'
>;
type AllocationBookingTarget = Pick<BookingRow, 'id' | 'tenant_id' | 'status' | 'package_name' | 'deposit_amount'>;

const PACKAGE_ALLOCATION_REVENUE_TYPES = new Set(['deposit', 'remaining_payment', 'package_payment', 'package_sale']);

function canWriteReconciliation(role: ReconciliationRole) {
  return role === 'admin' || role === 'accountant';
}

function normalizeRevenueType(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function resolveAllocatedRevenueType(
  existingType: string | null,
  amount: number | string | null,
  booking: AllocationBookingTarget,
) {
  const normalizedType = normalizeRevenueType(existingType);
  if (PACKAGE_ALLOCATION_REVENUE_TYPES.has(normalizedType)) {
    return normalizedType;
  }

  const revenueAmount = Math.abs(Number(amount ?? 0));
  const depositAmount = Number(booking.deposit_amount ?? 0);
  if (Number.isFinite(revenueAmount) && Number.isFinite(depositAmount) && depositAmount > 0 && revenueAmount <= depositAmount) {
    return 'deposit';
  }

  return 'remaining_payment';
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

async function rollbackAllocatedRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  revenueId: string,
  tenantId: string,
  payload: RevenueUpdate,
) {
  const { error } = await supabase
    .from('revenue')
    .update(payload)
    .eq('id', revenueId)
    .eq('tenant_id', tenantId);

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

    if (!revenueId || !bookingId) {
      return { success: false, error: 'Thiếu giao dịch hoặc booking cần phân bổ' };
    }

    const supabase = await createClient();
    const { data: existingRevenue, error: existingRevenueError } = await supabase
      .from('revenue')
      .select('amount, payment_method, notes, received_date, tenant_id, status, revenue_type, business_event_type, accounting_review_status, accounting_metadata')
      .eq('id', revenueId)
      .eq('tenant_id', user.tenant_id)
      .is('booking_id', null)
      .single();

    if (existingRevenueError || !existingRevenue) {
      return { success: false, error: existingRevenueError?.message || 'Không tìm thấy doanh thu treo' };
    }

    const orphanedRevenue = existingRevenue as OrphanedRevenueSnapshot;
    const { data: targetBooking, error: targetBookingError } = await supabase
      .from('bookings')
      .select('id, tenant_id, status, package_name, deposit_amount')
      .eq('id', bookingId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (targetBookingError || !targetBooking) {
      return { success: false, error: targetBookingError?.message || 'Không tìm thấy booking cần phân bổ' };
    }

    const booking = targetBooking as AllocationBookingTarget;
    if (booking.status === 'cancelled' || booking.status === 'inquiry') {
      return { success: false, error: 'Booking chưa đủ điều kiện nhận phân bổ tiền treo' };
    }

    const amount = Number(orphanedRevenue.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Số tiền treo không hợp lệ' };
    }

    await assertOpenAccountingPeriod(supabase, {
      tenantId: orphanedRevenue.tenant_id,
      date: orphanedRevenue.received_date,
      context: 'Allocate orphaned revenue',
    });

    const revenueType = resolveAllocatedRevenueType(orphanedRevenue.revenue_type, amount, booking);
    const reason = `Phân bổ tiền treo vào booking ${bookingId.split('-')[0]?.toUpperCase() || bookingId}`;
    const accountingPayload = buildRevenueAccountingMetadata({
      revenueType,
      amount,
      paymentMethod: orphanedRevenue.payment_method,
      bookingId,
      reason,
    });
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType,
    });
    const rollbackPayload: RevenueUpdate = {
      booking_id: null,
      status: orphanedRevenue.status,
      revenue_type: orphanedRevenue.revenue_type,
      business_event_type: orphanedRevenue.business_event_type,
      accounting_review_status: orphanedRevenue.accounting_review_status,
      accounting_metadata: orphanedRevenue.accounting_metadata,
    };
    const payload: RevenueUpdate = {
      booking_id: bookingId,
      status: 'confirmed',
      revenue_type: revenueType,
      business_event_type: businessEventType,
      accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload,
    };

    const { data: updatedRevenue, error } = await supabase
      .from('revenue')
      .update(payload)
      .eq('id', revenueId)
      .eq('tenant_id', user.tenant_id)
      .is('booking_id', null)
      .select('id, tenant_id, amount, notes')
      .single();

    if (error) return { success: false, error: error.message };
    if (!updatedRevenue?.id) {
      return { success: false, error: 'Không thể xác định giao dịch tiền treo vừa phân bổ' };
    }

    const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
    try {
      const enqueued = await enqueueWithAutoClient(
        supabase,
        buildPackageSaleOutboxEvent({
          tenantId: user.tenant_id,
          revenueId: updatedRevenue.id,
          totalAmount: Math.abs(amount),
          description: orphanedRevenue.notes || reason,
        }),
        '[allocateOrphanedRevenue]'
      );
      assertOutboxEnqueued(enqueued, 'PACKAGE_SALE');
    } catch (outboxError) {
      const rollbackError = await rollbackAllocatedRevenue(supabase, revenueId, user.tenant_id, rollbackPayload);
      return { success: false, error: withRollbackFailure(outboxError, rollbackError) };
    }

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
    // NOTE: Thu nợ (debt collection) luôn được phép ở mọi chế độ kế toán.
    // Bản ghi revenue được tạo ra có đầy đủ business_event_type + accounting_metadata
    // tương thích với Professional Core. KHÔNG chặn nghiệp vụ này.


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
        buildPackageSaleOutboxEvent({
          tenantId: user.tenant_id,
          revenueId: insertedRevenue.id,
          totalAmount: Math.abs(input.amount),
          description: insertedRevenue.notes || accountingPayload.reason || 'Thu đối soát công nợ',
        }),
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
