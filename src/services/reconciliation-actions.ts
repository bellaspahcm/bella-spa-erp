'use server';

import { createClient } from '@/lib/supabase-server';
import { getLocalDateString } from '@/lib/utils';
import { findMissingRequiredFields, inferBusinessEventType } from '@/services/accounting/template-rules';
import { assertOpenAccountingPeriod } from './accounting/period-guards';
import { assertLegacyFinanceWriteAllowed } from './accounting/mode';
import { getCurrentUser } from './user-actions';
import type { Database } from '@/types/database.types';

type FinancialAnomaliesData = {
  debt_alerts: unknown[];
  orphaned_revenue: unknown[];
  mismatch_alerts: unknown[];
};

type ReconciliationRole = string | null | undefined;

function canWriteReconciliation(role: ReconciliationRole) {
  return role === 'admin' || role === 'accountant';
}

function resolveAccountingReviewStatus(
  businessEventType: ReturnType<typeof inferBusinessEventType>,
  payload: Record<string, unknown>
) {
  if (!businessEventType) return 'NEEDS_REVIEW';
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? 'NEEDS_REVIEW'
    : 'UNREVIEWED';
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
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType: 'additional',
    });
    const accountingPayload = {
      amount: input.amount,
      payment_method: input.paymentMethod,
      booking_id: input.bookingId,
      reason: `Thu đối soát công nợ - KH: ${customerStr} - Gói: ${packageStr} (Booking: ${shortBookingId})`,
    };
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
      revenue_type: 'additional',
      notes: accountingPayload.reason,
      status: 'confirmed',
      payment_method: input.paymentMethod,
      received_date: receivedDate,
      recorded_by_id: user.id,
      business_event_type: businessEventType,
      accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload,
    };

    const { error } = await supabase.from('revenue').insert(payload);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống khi thu tiền' };
  }
}
