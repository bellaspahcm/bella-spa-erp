'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getLocalDateString, getMonthStart } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type SalaryRecordRow = Database['public']['Tables']['salary_records']['Row'];
type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];
type SalaryDisputeInsert = Database['public']['Tables']['salary_disputes']['Insert'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
export type KtvSalaryConfirmationSession = Pick<
  SessionLogRow,
  'id' | 'completed_date' | 'session_number'
> & {
  bookings: {
    package_name: string | null;
    ktv_commission: number | null;
    customers: {
      name_mother: string | null;
    } | null;
  } | null;
};

export type KtvSalaryConfirmation = {
  record: SalaryRecordRow | null;
  sessions: KtvSalaryConfirmationSession[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calculate pro-rata base salary for resigned KTVs */
export async function calcProRataBaseSalary(baseSalary: number, resignationDate: Date, monthYear: Date): Promise<number> {
  const monthStart = new Date(monthYear.getFullYear(), monthYear.getMonth(), 1);
  const daysInMonth = new Date(monthYear.getFullYear(), monthYear.getMonth() + 1, 0).getDate();
  const daysWorked = Math.max(0, Math.floor((resignationDate.getTime() - monthStart.getTime()) / 86400000) + 1);
  return Math.round(baseSalary * (daysWorked / daysInMonth));
}

/** KTV: Confirm their own salary record */
export async function ktvConfirmSalary(salaryRecordId: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

  const { error } = await supabase
    .from('salary_records')
    .update({ status: 'confirmed', ktv_confirmed_at: new Date().toISOString() })
    .eq('id', salaryRecordId)
    .eq('ktv_id', currentUser.id)
    .in('status', ['published', 'pending_approval', 'disputed']);

  if (error) return { success: false, error: error.message };

  await recordAuditLog({ action: 'UPDATE', table_name: 'salary_records', record_id: salaryRecordId, new_data: { status: 'confirmed' } });
  revalidatePath('/ktv/earnings');
  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** KTV: Dispute their salary with a reason */
export async function ktvDisputeSalary(salaryRecordId: string, reason: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

  const tenantId = currentUser.tenant_id;

  const { data: previousRecord, error: previousRecordError } = await supabase
    .from('salary_records')
    .select('status, dispute_reason')
    .eq('id', salaryRecordId)
    .eq('ktv_id', currentUser.id)
    .maybeSingle();

  if (previousRecordError) return { success: false, error: previousRecordError.message };
  if (!previousRecord) return { success: false, error: 'Khong tim thay bang luong can phan hoi' };
  if (!['published', 'pending_approval'].includes(previousRecord.status ?? '')) {
    return { success: false, error: 'Bang luong khong con o trang thai cho phep phan hoi' };
  }

  const { error: updateError } = await supabase
    .from('salary_records')
    .update({ status: 'disputed', dispute_reason: reason })
    .eq('id', salaryRecordId)
    .eq('ktv_id', currentUser.id)
    .in('status', ['published', 'pending_approval']);

  if (updateError) return { success: false, error: updateError.message };

  const disputePayload: SalaryDisputeInsert = {
    salary_record_id: salaryRecordId,
    ktv_id: currentUser.id,
    dispute_reason: reason,
    status: 'open',
    tenant_id: tenantId,
  };

  const { error: disputeInsertError } = await supabase.from('salary_disputes').insert(disputePayload);

  if (disputeInsertError) {
    const rollbackPayload: SalaryRecordUpdate = {
      status: previousRecord.status,
      dispute_reason: previousRecord.dispute_reason,
    };
    const { error: rollbackError } = await supabase
      .from('salary_records')
      .update(rollbackPayload)
      .eq('id', salaryRecordId)
      .eq('ktv_id', currentUser.id);

    if (rollbackError) {
      return {
        success: false,
        error: `Khong the tao phieu phan hoi luong: ${disputeInsertError.message}; rollback that bai: ${rollbackError.message}`,
      };
    }

    return { success: false, error: disputeInsertError.message };
  }

  revalidatePath('/ktv/earnings');
  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** KTV: Get their own salary record for the confirmation screen */
export async function getKtvSalaryForConfirmation(month?: string): Promise<KtvSalaryConfirmation | null> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const now = new Date();
  const monthStr = month || getMonthStart(now);
  const startOfMonth = monthStr;
  const [year, monthNumber] = monthStr.split('-').map(Number);
  const endOfMonth = getLocalDateString(new Date(year, monthNumber, 1));

  // Get salary record
  const { data: record, error: recordError } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', currentUser.id)
    .eq('month_year', monthStr)
    .maybeSingle();

  if (recordError) {
    throw new Error(`Failed to fetch KTV salary confirmation record: ${recordError.message}`);
  }

  // Get session details for KTV to cross-check
  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select(`id, completed_date, session_number, bookings(package_name, ktv_commission, customers(name_mother))`)
    .eq('completed_by_ktv_id', currentUser.id)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonth)
    .lt('completed_date', endOfMonth)
    .order('completed_date', { ascending: false });

  if (sessionsError) {
    throw new Error(`Failed to fetch KTV salary confirmation sessions: ${sessionsError.message}`);
  }

  return {
    record,
    sessions: (sessions || []) as unknown as KtvSalaryConfirmationSession[],
  };
}
