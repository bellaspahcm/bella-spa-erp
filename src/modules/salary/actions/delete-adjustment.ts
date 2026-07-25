'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

interface DeleteAdjustmentParams {
  adjustmentId: string;
}

interface DeleteAdjustmentResult {
  success: boolean;
  error?: string;
}

export async function deleteAdjustment(
  params: DeleteAdjustmentParams
): Promise<DeleteAdjustmentResult> {
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
    const { data: adjustment, error: fetchError } = await supabase
      .from('salary_adjustments')
      .select('id, status, created_by_id')
      .eq('id', params.adjustmentId)
      .single();

    if (fetchError || !adjustment) {
      return { success: false, error: 'Không tìm thấy điều chỉnh' };
    }

    // Check permissions: Only creator or admin/HR can delete
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
      return { success: false, error: 'Bạn không có quyền xóa điều chỉnh này' };
    }

    // Only allow deleting draft adjustments
    if (adjustment.status !== 'draft') {
      return {
        success: false,
        error: 'Chỉ có thể xóa điều chỉnh ở trạng thái Draft',
      };
    }

    // Delete adjustment
    const { error: deleteError } = await supabase
      .from('salary_adjustments')
      .delete()
      .eq('id', params.adjustmentId);

    if (deleteError) {
      console.error('[deleteAdjustment] Delete error:', deleteError);
      return {
        success: false,
        error: 'Không thể xóa điều chỉnh: ' + deleteError.message,
      };
    }

    // Revalidate paths
    revalidatePath('/dashboard/salary/adjustments');
    revalidatePath('/dashboard/salary');

    return { success: true };
  } catch (error) {
    console.error('[deleteAdjustment] Unexpected error:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống',
    };
  }
}
