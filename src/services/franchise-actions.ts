'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { revalidatePath } from 'next/cache';
import { safeRevalidatePath } from '@/lib/revalidate';

export interface FranchiseRoyaltyInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  month_year: string;
  gross_revenue: number;
  royalty_type: 'fixed' | 'percentage';
  royalty_rate: number | null;
  royalty_fixed_amount: number;
  calculated_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  tenants?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Lấy danh sách hóa đơn phí nhượng quyền.
 * HQ Admin có thể xem toàn bộ hoặc lọc theo chi nhánh.
 * Branch Admin chỉ xem được hóa đơn của chi nhánh mình.
 */
export async function getFranchiseRoyaltyInvoices(tenantId?: string): Promise<FranchiseRoyaltyInvoice[]> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const authResult = await checkHqAuth();
    
    let query = supabase
      .from('franchise_royalty_invoices')
      .select(`
        *,
        tenants (
          id,
          name
        )
      `);

    if (authResult.authorized) {
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
    } else {
      if (!user.tenant_id) throw new Error('Không xác định được chi nhánh hoạt động');
      query = query.eq('tenant_id', user.tenant_id);
    }

    const { data, error } = await query.order('month_year', { ascending: false });
    
    if (error) {
      console.error('[getFranchiseRoyaltyInvoices] error:', error);
      throw error;
    }

    return (data || []) as unknown as FranchiseRoyaltyInvoice[];
  } catch (e) {
    console.error('[getFranchiseRoyaltyInvoices] Exception:', e);
    return [];
  }
}

/**
 * Thực hiện gạch nợ thanh toán hóa đơn nhượng quyền.
 */
export async function payFranchiseRoyaltyInvoice(invoiceNumber: string, paymentMethod: string) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };

    const { data: invoice, error: fetchErr } = await supabase
      .from('franchise_royalty_invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .single();

    if (fetchErr || !invoice) {
      return { success: false, error: 'Không tìm thấy hóa đơn cần thanh toán.' };
    }

    // Kiểm tra quyền hạn: HQ Admin hoặc Branch Admin của chính chi nhánh đó
    const authResult = await checkHqAuth();
    if (!authResult.authorized && invoice.tenant_id !== user.tenant_id) {
      return { success: false, error: 'Quyền truy cập bị từ chối.' };
    }

    const { error: updateErr } = await supabase
      .from('franchise_royalty_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod || 'VietQR',
        notes: `Đã thanh toán bởi ${user.name || user.email} lúc ${new Date().toLocaleString('vi-VN')}`
      })
      .eq('invoice_number', invoiceNumber);

    if (updateErr) {
      console.error('[payFranchiseRoyaltyInvoice] error:', updateErr);
      return { success: false, error: 'Lỗi gạch nợ hóa đơn: ' + updateErr.message };
    }

    // Revalidate các view liên quan
    try {
      revalidatePath('/dashboard/finance');
      revalidatePath('/dashboard/settings');
      revalidatePath('/hq');
      await safeRevalidatePath('/hq');
      await safeRevalidatePath('/dashboard/settings');
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[payFranchiseRoyaltyInvoice] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
  }
}

/**
 * Cập nhật cấu hình thu phí nhượng quyền của chi nhánh (chỉ HQ Admin).
 */
export async function updateFranchiseRoyaltyConfig(
  tenantId: string,
  type: 'fixed' | 'percentage',
  rate?: number,
  fixedAmount?: number
) {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      return { success: false, error: 'Chỉ Admin Tổng bộ mới có quyền chỉnh sửa cấu hình nhượng quyền.' };
    }

    const supabase = await createClient();
    const updatePayload: any = {
      royalty_type: type,
      royalty_fixed_amount: fixedAmount !== undefined ? fixedAmount : 0.00
    };

    if (rate !== undefined) {
      updatePayload.royalty_rate = rate;
    }

    const { error } = await supabase
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenantId);

    if (error) {
      console.error('[updateFranchiseRoyaltyConfig] error:', error);
      return { success: false, error: 'Lỗi cập nhật cấu hình: ' + error.message };
    }

    try {
      revalidatePath('/hq');
      await safeRevalidatePath('/hq');
    } catch (_) {}

    return { success: true };
  } catch (e: any) {
    console.error('[updateFranchiseRoyaltyConfig] exception:', e);
    return { success: false, error: e.message || 'Lỗi hệ thống' };
  }
}

/**
 * Giả lập thanh toán hóa đơn qua cổng sandbox VietQR.
 */
export async function simulateFranchiseRoyaltyPayment(invoiceNumber: string) {
  return payFranchiseRoyaltyInvoice(invoiceNumber, 'VietQR Sandbox');
}
