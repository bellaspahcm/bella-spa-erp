'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';

export async function unlockMonth(month: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    
    const { getCurrentUser } = await import('../user-actions');
    const user = await getCurrentUser();
    
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    if (user.role !== 'admin') {
      return { success: false, error: 'Chỉ Admin mới có thể mở khóa sổ tháng' };
    }
    
    if (!user.tenant_id) return { success: false, error: 'Không tìm thấy tenant_id' };

    // Update manually to unlock
    const startDate = new Date(month);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0] + 'T23:59:59';

    const unlockResults = await Promise.all([
      supabase.from('revenue').update({ is_locked: false })
        .eq('tenant_id', user.tenant_id).gte('received_date', startDateStr).lte('received_date', endDateStr),
      supabase.from('expenses').update({ is_locked: false })
        .eq('tenant_id', user.tenant_id).gte('expense_date', startDateStr).lte('expense_date', endDateStr),
      supabase.from('salary_records').update({ is_locked: false })
        .eq('tenant_id', user.tenant_id).eq('month_year', startDateStr)
    ]);

    const unlockError = unlockResults.find((result) => result?.error)?.error;
    if (unlockError) {
      return { success: false, error: 'Lỗi mở khóa sổ: ' + unlockError.message };
    }

    revalidatePath('/dashboard/finance');
    return { success: true, month };
  } catch (e: unknown) {
    console.error('[unlockMonth]', e);
    Sentry.captureException(e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}
