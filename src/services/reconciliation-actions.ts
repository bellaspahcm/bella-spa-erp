'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

/**
 * Lấy danh sách các sai sót tài chính (Công nợ, Lệch doanh thu, Tiền treo)
 */
export async function getFinancialAnomalies() {
  try {
    const user = await getCurrentUser();
    console.log('[getFinancialAnomalies] User:', user);
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized or missing tenant ID', data: null };
    }

    const supabase = await createClient();
    
    // Gọi RPC để quét các sai sót
    const { data, error } = await supabase.rpc('get_financial_anomalies', {
      p_tenant_id: user.tenant_id
    });

    if (error) {
      console.error('Lỗi khi lấy dữ liệu đối soát:', error);
      return { success: false, error: error.message, data: null };
    }

    return { 
      success: true, 
      data: data as {
        debt_alerts: any[];
        orphaned_revenue: any[];
        mismatch_alerts: any[];
      }
    };
  } catch (err: any) {
    console.error('Lỗi hệ thống khi lấy dữ liệu đối soát:', err);
    return { success: false, error: err.message, data: null };
  }
}

/**
 * Phân bổ khoản thu bị treo (orphaned revenue) vào một booking cụ thể
 */
export async function allocateOrphanedRevenue(revenueId: string, bookingId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.tenant_id || !['admin', 'accountant'].includes(user.role)) {
      return { success: false, error: 'Không có quyền thực hiện thao tác này' };
    }

    const supabase = await createClient();
    
    const { error } = await supabase
      .from('revenue')
      .update({ booking_id: bookingId, status: 'confirmed' })
      .eq('id', revenueId)
      .eq('tenant_id', user.tenant_id)
      .is('booking_id', null);

    if (error) {
      return { success: false, error: error.message };
    }

    // Trigger cập nhật booking progress (DB trigger) sẽ tự động chạy
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
