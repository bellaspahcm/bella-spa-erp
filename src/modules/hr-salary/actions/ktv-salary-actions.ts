/**
 * KTV Salary Actions
 * 
 * Actions that KTVs can perform on their own salary records:
 * - Confirm salary
 * - Dispute salary
 * - View salary details
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { revalidatePath } from 'next/cache';

/**
 * Confirm salary for the current KTV user
 * 
 * KTV confirms they agree with the published salary amount.
 * Changes status from 'published' to 'confirmed'.
 * 
 * @returns Success status and message
 */
export async function confirmSalary(monthYear?: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.tenant_id) {
      return { success: false, error: 'Unauthorized: User not authenticated' };
    }

    if (user.role !== 'ktv') {
      return { success: false, error: 'Unauthorized: Only KTVs can confirm their own salary' };
    }

    // Use current month if not specified
    const targetMonth = monthYear || new Date().toISOString().slice(0, 7) + '-01';

    const supabase = await createClient();

    // Get salary record
    const { data: salaryRecord, error: fetchError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', user.id)
      .eq('month_year', targetMonth)
      .eq('tenant_id', user.tenant_id)
      .eq('status', 'published')
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: `Database error: ${fetchError.message}` };
    }

    if (!salaryRecord) {
      return { 
        success: false, 
        error: 'Không tìm thấy bảng lương đã công bố. Vui lòng liên hệ quản lý.' 
      };
    }

    // Update status to confirmed
    const { error: updateError } = await supabase
      .from('salary_records')
      .update({
        status: 'confirmed',
        ktv_confirmed_at: new Date().toISOString(),
        confirmed_by_admin: false,
      })
      .eq('id', salaryRecord.id);

    if (updateError) {
      return { success: false, error: `Failed to confirm salary: ${updateError.message}` };
    }

    // Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: salaryRecord.id,
      old_data: { status: 'published' },
      new_data: { 
        status: 'confirmed', 
        ktv_confirmed_at: new Date().toISOString(),
        confirmed_by_ktv_id: user.id,
      },
    });

    revalidatePath('/ktv/earnings');
    revalidatePath('/dashboard/salary');

    return { success: true, message: 'Đã xác nhận bảng lương thành công' };
  } catch (error) {
    console.error('Error confirming salary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error confirming salary' 
    };
  }
}

/**
 * Dispute salary for the current KTV user
 * 
 * KTV disputes the published salary amount with a reason.
 * Changes status from 'published' to 'disputed'.
 * Admin must review and resolve the dispute.
 * 
 * @param monthYear - Salary period in YYYY-MM-01 format
 * @param reason - Reason for disputing the salary
 * @returns Success status and message
 */
export async function disputeSalary(monthYear: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.tenant_id) {
      return { success: false, error: 'Unauthorized: User not authenticated' };
    }

    if (user.role !== 'ktv') {
      return { success: false, error: 'Unauthorized: Only KTVs can dispute their own salary' };
    }

    if (!reason || reason.trim().length < 10) {
      return { 
        success: false, 
        error: 'Vui lòng nhập lý do tranh chấp ít nhất 10 ký tự' 
      };
    }

    const supabase = await createClient();

    // Get salary record
    const { data: salaryRecord, error: fetchError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', user.id)
      .eq('month_year', monthYear)
      .eq('tenant_id', user.tenant_id)
      .eq('status', 'published')
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: `Database error: ${fetchError.message}` };
    }

    if (!salaryRecord) {
      return { 
        success: false, 
        error: 'Không tìm thấy bảng lương đã công bố hoặc bảng lương đã được xử lý.' 
      };
    }

    // Update status to disputed
    const { error: updateError } = await supabase
      .from('salary_records')
      .update({
        status: 'disputed',
        dispute_reason: reason.trim(),
      })
      .eq('id', salaryRecord.id);

    if (updateError) {
      return { success: false, error: `Failed to dispute salary: ${updateError.message}` };
    }

    // Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: salaryRecord.id,
      old_data: { status: 'published' },
      new_data: { 
        status: 'disputed', 
        dispute_reason: reason.trim(),
        disputed_by_ktv_id: user.id,
      },
    });

    revalidatePath('/ktv/earnings');
    revalidatePath('/dashboard/salary');

    return { 
      success: true, 
      message: 'Đã gửi tranh chấp thành công. Quản lý sẽ xem xét và phản hồi sớm.' 
    };
  } catch (error) {
    console.error('Error disputing salary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error disputing salary' 
    };
  }
}

/**
 * Resolve salary dispute (Admin only)
 * 
 * Admin reviews and resolves a disputed salary.
 * Can either confirm the salary or adjust it.
 * 
 * @param ktvId - KTV user ID
 * @param monthYear - Salary period
 * @param resolution - Resolution notes
 * @param newTotalSalary - Optional: New total salary if adjusted
 * @returns Success status and message
 */
export async function resolveSalaryDispute(
  ktvId: string,
  monthYear: string,
  resolution: string,
  newTotalSalary?: number
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.tenant_id) {
      return { success: false, error: 'Unauthorized: User not authenticated' };
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return { success: false, error: 'Unauthorized: Only admins can resolve disputes' };
    }

    if (!resolution || resolution.trim().length < 10) {
      return { 
        success: false, 
        error: 'Vui lòng nhập kết quả xử lý ít nhất 10 ký tự' 
      };
    }

    const supabase = await createClient();

    // Get salary record
    const { data: salaryRecord, error: fetchError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .eq('tenant_id', user.tenant_id)
      .eq('status', 'disputed')
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: `Database error: ${fetchError.message}` };
    }

    if (!salaryRecord) {
      return { 
        success: false, 
        error: 'Không tìm thấy tranh chấp lương cần xử lý.' 
      };
    }

    // Prepare update payload
    const updatePayload: any = {
      status: 'confirmed',
      dispute_resolved_at: new Date().toISOString(),
      dispute_resolution: resolution.trim(),
      dispute_resolved_by: user.id,
    };

    // If admin adjusts salary, update total_salary
    if (newTotalSalary !== undefined && newTotalSalary !== salaryRecord.total_salary) {
      updatePayload.total_salary = newTotalSalary;
      updatePayload.notes = (salaryRecord.notes || '') + ` | Admin điều chỉnh sau tranh chấp: ${newTotalSalary.toLocaleString('vi-VN')}đ`;
    }

    // Update salary record
    const { error: updateError } = await supabase
      .from('salary_records')
      .update(updatePayload)
      .eq('id', salaryRecord.id);

    if (updateError) {
      return { success: false, error: `Failed to resolve dispute: ${updateError.message}` };
    }

    // Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: salaryRecord.id,
      old_data: { 
        status: 'disputed',
        total_salary: salaryRecord.total_salary,
      },
      new_data: { 
        status: 'confirmed',
        dispute_resolved_at: new Date().toISOString(),
        dispute_resolution: resolution.trim(),
        total_salary: newTotalSalary || salaryRecord.total_salary,
      },
    });

    revalidatePath('/ktv/earnings');
    revalidatePath('/dashboard/salary');

    return { 
      success: true, 
      message: 'Đã xử lý tranh chấp thành công' 
    };
  } catch (error) {
    console.error('Error resolving salary dispute:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error resolving dispute' 
    };
  }
}

/**
 * Get salary details for current KTV
 * 
 * Returns detailed salary breakdown for the specified month.
 * 
 * @param monthYear - Salary period in YYYY-MM-01 format
 * @returns Salary details or error
 */
export async function getKtvSalaryDetails(monthYear?: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.tenant_id) {
      return { success: false, error: 'Unauthorized: User not authenticated' };
    }

    if (user.role !== 'ktv') {
      return { success: false, error: 'Unauthorized: Only KTVs can view their own salary' };
    }

    // Use current month if not specified
    const targetMonth = monthYear || new Date().toISOString().slice(0, 7) + '-01';

    const supabase = await createClient();

    // Get salary record with KTV details
    const { data: salaryRecord, error: fetchError } = await supabase
      .from('salary_records')
      .select(`
        *,
        users!inner(id, full_name, base_salary)
      `)
      .eq('ktv_id', user.id)
      .eq('month_year', targetMonth)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: `Database error: ${fetchError.message}` };
    }

    if (!salaryRecord) {
      return { 
        success: false, 
        error: 'Chưa có bảng lương cho tháng này.' 
      };
    }

    return { 
      success: true, 
      data: salaryRecord 
    };
  } catch (error) {
    console.error('Error getting KTV salary details:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error getting salary details' 
    };
  }
}
