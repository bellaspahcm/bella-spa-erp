'use server';

import { createClient } from '@/lib/supabase-server';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { revalidatePath } from 'next/cache';
import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ClearingRecordRow = Database['public']['Tables']['inter_branch_clearing_records']['Row'];
type ClearingRecordUpdate = Database['public']['Tables']['inter_branch_clearing_records']['Update'];
type InterBranchClearingRole = 'debtor' | 'creditor';
type EnqueuedClearingEvent = { tenantId: string; referenceId: string };

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

export interface InterBranchClearingRecord {
  id: string;
  clearing_number: string;
  month_year: string;
  debtor_tenant_id: string;
  creditor_tenant_id: string;
  session_count: number;
  clearing_rate: number;
  calculated_amount: number;
  status: 'pending' | 'cleared' | 'cancelled';
  created_at: string;
  cleared_at: string | null;
  payment_method: string | null;
  notes: string | null;
  debtor?: {
    id: string;
    name: string;
  } | null;
  creditor?: {
    id: string;
    name: string;
  } | null;
}

export type InterBranchClearingRecordsResult =
  | { success: true; data: InterBranchClearingRecord[]; error?: never }
  | { success: false; data: InterBranchClearingRecord[]; error: string };

function getInvalidClearingStatusMessage(status: string | null | undefined) {
  if (status === 'cleared') return 'Bản ghi đối soát đã được gạch nợ.';
  if (status === 'cancelled') return 'Bản ghi đối soát đã bị hủy, không thể gạch nợ.';
  return 'Bản ghi đối soát không còn ở trạng thái chờ gạch nợ.';
}

function getClearingAmount(record: Pick<ClearingRecordRow, 'calculated_amount'>) {
  const amount = Number(record.calculated_amount);
  return Number.isFinite(amount) ? amount : 0;
}

function buildClearingAccountingPayload(input: {
  record: Pick<
    ClearingRecordRow,
    | 'id'
    | 'clearing_number'
    | 'month_year'
    | 'session_count'
    | 'clearing_rate'
    | 'calculated_amount'
  >;
  debtorTenantId: string;
  creditorTenantId: string;
  paymentMethod: string;
  role: InterBranchClearingRole;
}) {
  const amount = getClearingAmount(input.record);
  return {
    amount,
    paymentMethod: input.paymentMethod,
    role: input.role,
    debtorTenantId: input.debtorTenantId,
    creditorTenantId: input.creditorTenantId,
    debtor_tenant_id: input.debtorTenantId,
    creditor_tenant_id: input.creditorTenantId,
    clearingNumber: input.record.clearing_number,
    monthYear: input.record.month_year,
    sessionCount: Number(input.record.session_count) || 0,
    clearingRate: Number(input.record.clearing_rate) || 0,
    description: `Bù trừ liên chi nhánh ${input.record.clearing_number} (${input.record.month_year})`,
  };
}

async function rollbackClearingAfterOutboxFailure(
  supabase: SupabaseServerClient,
  record: Pick<ClearingRecordRow, 'id' | 'status' | 'cleared_at' | 'payment_method' | 'notes'>,
) {
  const rollbackPayload: ClearingRecordUpdate = {
    status: record.status,
    cleared_at: record.cleared_at,
    payment_method: record.payment_method,
    notes: record.notes,
  };

  const { error } = await supabase
    .from('inter_branch_clearing_records')
    .update(rollbackPayload)
    .eq('id', record.id)
    .eq('status', 'cleared');

  return error;
}

async function cleanupEnqueuedClearingOutbox(
  outboxClient: SupabaseServerClient,
  enqueuedEvents: EnqueuedClearingEvent[],
) {
  const failures: string[] = [];

  for (const event of enqueuedEvents) {
    const { error } = await outboxClient
      .from('accounting_outbox')
      .delete()
      .eq('tenant_id', event.tenantId)
      .eq('event_type', 'INTER_BRANCH_CLEARING')
      .eq('reference_id', event.referenceId);

    if (error) {
      failures.push(`${event.tenantId}: ${error.message}`);
    }
  }

  return failures;
}

/**
 * Lấy danh sách bản ghi đối soát liên chi nhánh.
 * HQ Admin xem được toàn bộ.
 * Branch Admin chỉ xem được các bản ghi liên quan (là debtor hoặc creditor).
 */
export async function getInterBranchClearingRecords(tenantId?: string): Promise<InterBranchClearingRecord[]> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const user = await getCurrentUser();
    if (!user) return [];

    const authResult = await checkHqAuth();
    
    let query = supabase
      .from('inter_branch_clearing_records')
      .select(`
        *,
        debtor:debtor_tenant_id (id, name),
        creditor:creditor_tenant_id (id, name)
      `);

    if (authResult.authorized) {
      if (tenantId) {
        query = query.or(`debtor_tenant_id.eq.${tenantId},creditor_tenant_id.eq.${tenantId}`);
      }
    } else {
      if (!user.tenant_id) throw new Error('Không xác định được chi nhánh hoạt động');
      query = query.or(`debtor_tenant_id.eq.${user.tenant_id},creditor_tenant_id.eq.${user.tenant_id}`);
    }

    const { data, error } = await query.order('month_year', { ascending: false });
    
    if (error) {
      console.error('[getInterBranchClearingRecords] error:', error);
      throw error;
    }

    return (data || []) as unknown as InterBranchClearingRecord[];
  } catch (e) {
    console.error('[getInterBranchClearingRecords] Exception:', e);
    throw e;
  }
}

/**
 * Lấy dữ liệu bù trừ theo dạng result để client không nhận lỗi Server Action bị ẩn message.
 */
export async function getInterBranchClearingRecordsResult(tenantId?: string): Promise<InterBranchClearingRecordsResult> {
  try {
    const data = await getInterBranchClearingRecords(tenantId);
    return { success: true, data };
  } catch (e) {
    console.error('[getInterBranchClearingRecordsResult] Exception:', e);
    return {
      success: false,
      data: [],
      error: getErrorMessage(e, 'Không thể tải dữ liệu bù trừ chi nhánh'),
    };
  }
}

/**
 * Thực hiện gạch nợ thanh toán đối soát bù trừ liên chi nhánh.
 */
export async function clearInterBranchRecord(recordId: string, paymentMethod: string) {
  try {
    if (!recordId?.trim()) {
      return { success: false, error: 'Thiếu mã bản ghi đối soát cần gạch nợ.' };
    }

    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };

    const { data: record, error: fetchErr } = await supabase
      .from('inter_branch_clearing_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (fetchErr || !record) {
      return { success: false, error: 'Không tìm thấy bản ghi đối soát cần gạch nợ.' };
    }

    if (record.status !== 'pending') {
      return { success: false, error: getInvalidClearingStatusMessage(record.status) };
    }

    const debtorTenantId = record.debtor_tenant_id;
    const creditorTenantId = record.creditor_tenant_id;
    if (!debtorTenantId || !creditorTenantId) {
      return { success: false, error: 'Bản ghi bù trừ thiếu chi nhánh trả hoặc chi nhánh nhận.' };
    }

    if (debtorTenantId === creditorTenantId) {
      return { success: false, error: 'Bản ghi bù trừ phải thuộc hai chi nhánh khác nhau.' };
    }

    // Kiểm tra quyền hạn: HQ Admin hoặc Branch Admin của debtor hoặc creditor
    const authResult = await checkHqAuth();
    if (!authResult.authorized && debtorTenantId !== user.tenant_id && creditorTenantId !== user.tenant_id) {
      return { success: false, error: 'Quyền truy cập bị từ chối.' };
    }

    const clearingAmount = getClearingAmount(record);
    if (clearingAmount <= 0) {
      return { success: false, error: 'Số tiền bù trừ không hợp lệ, không thể tạo bút toán kế toán.' };
    }

    const clearedAt = new Date().toISOString();
    const paymentLabel = paymentMethod?.trim() || 'VietQR';
    const updatePayload: ClearingRecordUpdate = {
      status: 'cleared',
      cleared_at: clearedAt,
      payment_method: paymentLabel,
      notes: `Đã thanh toán bởi ${user.full_name || user.email} lúc ${new Date(clearedAt).toLocaleString('vi-VN')}`,
    };

    const { data: clearedRecord, error: updateErr } = await supabase
      .from('inter_branch_clearing_records')
      .update(updatePayload)
      .eq('id', recordId)
      .eq('status', 'pending')
      .select('id, status')
      .single();

    if (updateErr) {
      console.error('[clearInterBranchRecord] error:', updateErr);
      return { success: false, error: 'Lỗi gạch nợ đối soát: ' + getErrorMessage(updateErr) };
    }

    if (!clearedRecord) {
      return { success: false, error: 'Bản ghi đối soát vừa được xử lý bởi thao tác khác. Vui lòng quét lại dữ liệu.' };
    }

    const { enqueueAccountingEvent, getOutboxClient } = await import('@/lib/accounting-outbox');
    const outboxClient = await getOutboxClient(supabase);
    const enqueuedEvents: EnqueuedClearingEvent[] = [];
    const enqueueClearingEvent = async (tenantId: string, role: InterBranchClearingRole) => {
      const enqueued = await enqueueAccountingEvent(
        outboxClient,
        {
          tenantId,
          eventType: 'INTER_BRANCH_CLEARING',
          referenceType: 'INTER_BRANCH_CLEARING_RECORD',
          referenceId: record.id,
          payload: buildClearingAccountingPayload({
            record,
            debtorTenantId,
            creditorTenantId,
            paymentMethod: paymentLabel,
            role,
          }),
        },
        '[clearInterBranchRecord]'
      );

      if (enqueued) {
        enqueuedEvents.push({ tenantId, referenceId: record.id });
      }

      return enqueued;
    };

    const debtorEnqueued = await enqueueClearingEvent(debtorTenantId, 'debtor');
    const creditorEnqueued = debtorEnqueued
      ? await enqueueClearingEvent(creditorTenantId, 'creditor')
      : false;

    if (!debtorEnqueued || !creditorEnqueued) {
      const cleanupFailures = await cleanupEnqueuedClearingOutbox(outboxClient, enqueuedEvents);
      const rollbackError = await rollbackClearingAfterOutboxFailure(supabase, record);
      const failureDetails = [
        !debtorEnqueued ? 'không tạo được sự kiện kế toán cho chi nhánh trả' : null,
        debtorEnqueued && !creditorEnqueued ? 'không tạo được sự kiện kế toán cho chi nhánh nhận' : null,
        rollbackError ? `rollback trạng thái thất bại: ${rollbackError.message}` : null,
        cleanupFailures.length > 0 ? `dọn outbox thất bại: ${cleanupFailures.join('; ')}` : null,
      ].filter(Boolean);

      console.error('[clearInterBranchRecord] accounting outbox failure:', failureDetails.join(' | '));
      return {
        success: false,
        error: `Không thể tạo đủ bút toán kế toán bù trừ. ${failureDetails.join(' | ')}`,
      };
    }

    // Revalidate các view liên quan
    try {
      revalidatePath('/dashboard/finance');
      revalidatePath('/dashboard/finance/reconciliation');
      revalidatePath('/hq');
      await safeRevalidatePath('/hq');
      await safeRevalidatePath('/dashboard/finance/reconciliation');
    } catch (revalidateError) {
      console.error('[clearInterBranchRecord] revalidate error:', revalidateError);
    }

    return { success: true };
  } catch (e: unknown) {
    console.error('[clearInterBranchRecord] exception:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Cập nhật đơn giá đối soát bù trừ nội bộ của chi nhánh (chỉ HQ Admin).
 */
export async function updateTenantClearingRate(tenantId: string, rate: number) {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: 'Chỉ Admin Tổng bộ mới có quyền chỉnh sửa cấu hình đơn giá đối soát.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('tenants')
      .update({
        internal_clearing_rate: rate
      })
      .eq('id', tenantId);

    if (error) {
      console.error('[updateTenantClearingRate] error:', error);
      return { success: false, error: 'Lỗi cập nhật đơn giá đối soát: ' + error.message };
    }

    try {
      revalidatePath('/hq');
      await safeRevalidatePath('/hq');
    } catch {}

    return { success: true };
  } catch (e: unknown) {
    console.error('[updateTenantClearingRate] exception:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Giả lập thanh toán Sandbox đối soát liên chi nhánh.
 */
export async function simulateInterBranchClearing(recordId: string) {
  return clearInterBranchRecord(recordId, 'VietQR Sandbox');
}
