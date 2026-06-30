'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

interface CreateAdjustmentParams {
  tenantId: string;
  ktvId: string;
  month: string; // YYYY-MM format
  adjustmentType: 'bonus' | 'deduction';
  category: string;
  amount: number;
  reason: string;
  notes: string | null;
}

interface CreateAdjustmentResult {
  success: boolean;
  data?: { id: string };
  error?: string;
}

export async function createAdjustment(
  params: CreateAdjustmentParams
): Promise<CreateAdjustmentResult> {
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

    // Validate inputs
    if (!params.ktvId || !params.month || !params.category || !params.reason) {
      return { success: false, error: 'Thiếu thông tin bắt buộc' };
    }

    if (params.amount <= 0) {
      return { success: false, error: 'Số tiền phải lớn hơn 0' };
    }

    if (params.reason.length < 10) {
      return { success: false, error: 'Lý do phải có ít nhất 10 ký tự' };
    }

    // Convert YYYY-MM to YYYY-MM-01 for database
    const monthYear = `${params.month}-01`;

    // Insert adjustment
    const { data, error: insertError } = await (supabase as any)
      .from('salary_adjustments')
      .insert({
        tenant_id: params.tenantId,
        ktv_id: params.ktvId,
        month_year: monthYear,
        adjustment_type: params.adjustmentType,
        category: params.category,
        amount: params.amount,
        reason: params.reason,
        notes: params.notes,
        status: 'draft',
        created_by_id: user.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[createAdjustment] Insert error:', insertError);
      return {
        success: false,
        error: 'Không thể tạo điều chỉnh: ' + insertError.message,
      };
    }

    // Revalidate paths
    revalidatePath('/dashboard/salary/adjustments');
    revalidatePath('/dashboard/salary');

    return {
      success: true,
      data: { id: data.id },
    };
  } catch (error) {
    console.error('[createAdjustment] Unexpected error:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống',
    };
  }
}
