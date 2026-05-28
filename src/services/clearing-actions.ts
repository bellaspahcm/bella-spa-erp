'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { revalidatePath } from 'next/cache';
import { safeRevalidatePath } from '@/lib/revalidate';

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

/**
 * Lấy danh sách bản ghi đối soát liên chi nhánh.
 * HQ Admin xem được toàn bộ.
 * Branch Admin chỉ xem được các bản ghi liên quan (là debtor hoặc creditor).
 */
export async function getInterBranchClearingRecords(tenantId?: string): Promise<InterBranchClearingRecord[]> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) throw new Error('Chưa đăng nhập');

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
    return [];
  }
}

/**
 * Thực hiện gạch nợ thanh toán đối soát bù trừ liên chi nhánh.
 */
export async function clearInterBranchRecord(recordId: string, paymentMethod: string) {
  try {
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

    // Kiểm tra quyền hạn: HQ Admin hoặc Branch Admin của debtor hoặc creditor
    const authResult = await checkHqAuth();
    if (!authResult.authorized && record.debtor_tenant_id !== user.tenant_id && record.creditor_tenant_id !== user.tenant_id) {
      return { success: false, error: 'Quyền truy cập bị từ chối.' };
    }

    const { error: updateErr } = await supabase
      .from('inter_branch_clearing_records')
      .update({
        status: 'cleared',
        cleared_at: new Date().toISOString(),
        payment_method: paymentMethod || 'VietQR',
        notes: `Đã thanh toán bởi ${user.full_name || user.email} lúc ${new Date().toLocaleString('vi-VN')}`
      })
      .eq('id', recordId);

    if (updateErr) {
      console.error('[clearInterBranchRecord] error:', updateErr);
      return { success: false, error: 'Lỗi gạch nợ đối soát: ' + updateErr.message };
    }

    // Revalidate các view liên quan
    try {
      revalidatePath('/dashboard/finance');
      revalidatePath('/dashboard/finance/reconciliation');
      revalidatePath('/hq');
      await safeRevalidatePath('/hq');
      await safeRevalidatePath('/dashboard/finance/reconciliation');
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[clearInterBranchRecord] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
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
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[updateTenantClearingRate] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
  }
}

/**
 * Giả lập thanh toán Sandbox đối soát liên chi nhánh.
 */
export async function simulateInterBranchClearing(recordId: string) {
  return clearInterBranchRecord(recordId, 'VietQR Sandbox');
}
