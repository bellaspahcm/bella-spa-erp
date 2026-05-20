'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getLocalDateString, getMonthStart } from '@/lib/utils';

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
  const supabase = (await createClient()) as any;
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
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

  const tenantId = currentUser.tenant_id;

  const { error: updateError } = await supabase
    .from('salary_records')
    .update({ status: 'disputed', dispute_reason: reason })
    .eq('id', salaryRecordId)
    .eq('ktv_id', currentUser.id)
    .in('status', ['published', 'pending_approval']);

  if (updateError) return { success: false, error: updateError.message };

  await supabase.from('salary_disputes').insert({
    salary_record_id: salaryRecordId,
    ktv_id: currentUser.id,
    dispute_reason: reason,
    status: 'open',
    tenant_id: tenantId,
  });

  revalidatePath('/ktv/earnings');
  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** KTV: Get their own salary record for the confirmation screen */
export async function getKtvSalaryForConfirmation(month?: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const now = new Date();
  const monthStr = month || getMonthStart(now);
  const startOfMonth = monthStr;
  const endOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

  // Get salary record
  const { data: record } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', currentUser.id)
    .eq('month_year', monthStr)
    .maybeSingle();

  // Get session details for KTV to cross-check
  const { data: sessions } = await supabase
    .from('session_logs')
    .select(`id, completed_date, session_number, bookings(package_name, ktv_commission, customers(name_mother))`)
    .eq('completed_by_ktv_id', currentUser.id)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonth)
    .lt('completed_date', endOfMonth)
    .order('completed_date', { ascending: false });

  return { record, sessions: sessions || [] };
}
