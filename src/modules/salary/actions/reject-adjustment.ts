'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

interface RejectAdjustmentParams {
  adjustmentId: string;
  rejectionReason: string;
}

interface RejectAdjustmentResult {
  success: boolean;
  error?: string;
}

export async function rejectAdjustment(
  params: RejectAdjustmentParams
): Promise<RejectAdjustmentResult> {
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

    // Check user has admin/HR role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return { success: false, error: 'Không thể xác thực người dùng' };
    }

    const role = userData.role?.toLowerCase();
    if (!['admin', 'super_admin', 'admin_staff', 'hr'].includes(role || '')) {
      return { success: false, error: 'Bạn không có quyền từ chối điều chỉnh' };
    }

    // Validate rejection reason
    if (!params.rejectionReason || params.rejectionReason.trim().length < 10) {
      return { success: false, error: 'Lý do từ chối phải có ít nhất 10 ký tự' };
    }

    // Get adjustment details
    const { data: adjustment, error: fetchError } = await (supabase as any)
      .from('salary_adjustments')
      .select('id, status, notes')
      .eq('id', params.adjustmentId)
      .single();

    if (fetchError || !adjustment) {
      return { success: false, error: 'Không tìm thấy điều chỉnh' };
    }

    if (adjustment.status !== 'draft') {
      return { success: false, error: 'Chỉ có thể từ chối điều chỉnh ở trạng thái Draft' };
    }

    // Update adjustment status to rejected
    // Append rejection reason to notes
    const updatedNotes = adjustment.notes
      ? `${adjustment.notes}\n\n[Từ chối] ${params.rejectionReason}`
      : `[Từ chối] ${params.rejectionReason}`;

    const { error: updateError } = await (supabase as any)
      .from('salary_adjustments')
      .update({
        status: 'rejected',
        notes: updatedNotes,
        approved_by_id: user.id, // Track who rejected it
        approved_at: new Date().toISOString(),
      })
      .eq('id', params.adjustmentId);

    if (updateError) {
      console.error('[rejectAdjustment] Update error:', updateError);
      return {
        success: false,
        error: 'Không thể cập nhật trạng thái: ' + updateError.message,
      };
    }

    // Revalidate paths
    revalidatePath('/dashboard/salary/adjustments');
    revalidatePath('/dashboard/salary');

    return { success: true };
  } catch (error) {
    console.error('[rejectAdjustment] Unexpected error:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống',
    };
  }
}

interface BulkRejectAdjustmentsParams {
  adjustmentIds: string[];
  rejectionReason: string;
}

interface BulkRejectResult {
  success: boolean;
  rejected: number;
  failed: number;
  errors: string[];
}

export async function bulkRejectAdjustments(
  params: BulkRejectAdjustmentsParams
): Promise<BulkRejectResult> {
  const results = {
    success: true,
    rejected: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const adjustmentId of params.adjustmentIds) {
    const result = await rejectAdjustment({
      adjustmentId,
      rejectionReason: params.rejectionReason,
    });
    
    if (result.success) {
      results.rejected++;
    } else {
      results.failed++;
      results.errors.push(`ID ${adjustmentId}: ${result.error || 'Unknown error'}`);
    }
  }

  if (results.failed > 0) {
    results.success = false;
  }

  return results;
}
