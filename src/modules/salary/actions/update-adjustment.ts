'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

interface UpdateAdjustmentParams {
  adjustmentId: string;
  category?: string;
  amount?: number;
  reason?: string;
  notes?: string | null;
}

interface UpdateAdjustmentResult {
  success: boolean;
  error?: string;
}

export async function updateAdjustment(
  params: UpdateAdjustmentParams
): Promise<UpdateAdjustmentResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get adjustment details
    const { data: adjustment, error: fetchError } = await (supabase as any)
      .from('salary_adjustments')
      .select('id, status, created_by_id')
      .eq('id', params.adjustmentId)
      .single();

    if (fetchError || !adjustment) {
      return { success: false, error: 'Không tìm thấy điều chỉnh' };
    }

    // Check permissions: Only creator or admin/HR can edit
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return { success: false, error: 'Không thể xác thực người dùng' };
    }

    const role = userData.role?.toLowerCase();
    const isAdmin = ['admin', 'super_admin', 'admin_staff', 'hr'].includes(role || '');
    const isCreator = adjustment.created_by_id === user.id;

    if (!isAdmin && !isCreator) {
      return { success: false, error: 'Bạn không có quyền sửa điều chỉnh này' };
    }

    // Only allow editing draft adjustments
    if (adjustment.status !== 'draft') {
      return {
        success: false,
        error: 'Chỉ có thể sửa điều chỉnh ở trạng thái Draft',
      };
    }

    // Build update object
    const updates: any = {};

    if (params.category !== undefined) {
      if (!params.category.trim()) {
        return { success: false, error: 'Danh mục không được để trống' };
      }
      updates.category = params.category;
    }

    if (params.amount !== undefined) {
      if (params.amount <= 0) {
        return { success: false, error: 'Số tiền phải lớn hơn 0' };
      }
      updates.amount = params.amount;
    }

    if (params.reason !== undefined) {
      if (params.reason.trim().length < 10) {
        return { success: false, error: 'Lý do phải có ít nhất 10 ký tự' };
      }
      updates.reason = params.reason;
    }

    if (params.notes !== undefined) {
      updates.notes = params.notes;
    }

    // If no updates, return early
    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    // Update adjustment
    const { error: updateError } = await (supabase as any)
      .from('salary_adjustments')
      .update(updates)
      .eq('id', params.adjustmentId);

    if (updateError) {
      console.error('[updateAdjustment] Update error:', updateError);
      return {
        success: false,
        error: 'Không thể cập nhật điều chỉnh: ' + updateError.message,
      };
    }

    // Revalidate paths
    revalidatePath('/dashboard/salary/adjustments');
    revalidatePath('/dashboard/salary');

    return { success: true };
  } catch (error) {
    console.error('[updateAdjustment] Unexpected error:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống',
    };
  }
}
