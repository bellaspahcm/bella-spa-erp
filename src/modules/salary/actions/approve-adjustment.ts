'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';
import type { Database } from '@/types/database.types';

type SalaryAdjustmentUpdate = Database['public']['Tables']['salary_adjustments']['Update'];

interface ApproveAdjustmentParams {
  adjustmentId: string;
}

interface ApproveAdjustmentResult {
  success: boolean;
  error?: string;
}

export async function approveAdjustment(
  params: ApproveAdjustmentParams
): Promise<ApproveAdjustmentResult> {
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
      return { success: false, error: 'Bạn không có quyền duyệt điều chỉnh' };
    }

    // Get adjustment details
    const { data: adjustment, error: fetchError } = await supabase
      .from('salary_adjustments')
      .select('id, ktv_id, month_year, tenant_id, status')
      .eq('id', params.adjustmentId)
      .single();

    if (fetchError || !adjustment) {
      return { success: false, error: 'Không tìm thấy điều chỉnh' };
    }

    if (adjustment.status !== 'draft') {
      return { success: false, error: 'Chỉ có thể duyệt điều chỉnh ở trạng thái Draft' };
    }

    // Update adjustment status to approved
    const approvePayload: SalaryAdjustmentUpdate = {
      status: 'approved',
      approved_by_id: user.id,
      approved_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from('salary_adjustments')
      .update(approvePayload)
      .eq('id', params.adjustmentId);

    if (updateError) {
      console.error('[approveAdjustment] Update error:', updateError);
      return {
        success: false,
        error: 'Không thể cập nhật trạng thái: ' + updateError.message,
      };
    }

    // Trigger salary recalculation for this KTV + month
    // Extract month in YYYY-MM format
    const monthStr = adjustment.month_year.substring(0, 7); // "2026-06-01" -> "2026-06"

    try {
      await recalculateAndSaveSalaryRecordEngine(
        supabase,
        adjustment.ktv_id,
        adjustment.tenant_id,
        monthStr
      );
    } catch (recalcError) {
      console.error('[approveAdjustment] Recalculation error:', recalcError);
      // Don't fail the approval if recalculation fails - just log it
      // The adjustment is still approved, recalc can be triggered manually
    }

    // Revalidate paths
    revalidatePath('/dashboard/salary/adjustments');
    revalidatePath('/dashboard/salary');

    return { success: true };
  } catch (error) {
    console.error('[approveAdjustment] Unexpected error:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống',
    };
  }
}

interface BulkApproveAdjustmentsParams {
  adjustmentIds: string[];
}

interface BulkApproveResult {
  success: boolean;
  approved: number;
  failed: number;
  errors: string[];
}

export async function bulkApproveAdjustments(
  params: BulkApproveAdjustmentsParams
): Promise<BulkApproveResult> {
  const results = {
    success: true,
    approved: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const adjustmentId of params.adjustmentIds) {
    const result = await approveAdjustment({ adjustmentId });
    if (result.success) {
      results.approved++;
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
