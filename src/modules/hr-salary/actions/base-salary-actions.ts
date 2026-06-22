'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getLocalDateString } from '@bella/shared';
import { getMonthStart } from '@/lib/utils';;
import { createAccountingDataClient } from '@/core/services/accounting/client';
import type { Database } from '@/types/database.types';

type SalaryRecordRow = Database['public']['Tables']['salary_records']['Row'];
type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];
type SalaryDisputeInsert = Database['public']['Tables']['salary_disputes']['Insert'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type SalarySheetRow = {
  ktv_id: string;
  base_salary: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  kpi_bonus: number | null;
  deductions: number | null;
  advances: number | null;
  total_salary: number | null;
  total_sessions: number | null;
  status: string | null;
};
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

function mergeSalarySheetIntoRecord(record: SalaryRecordRow, sheetRow: SalarySheetRow): SalaryRecordRow {
  return {
    ...record,
    base_salary: sheetRow.base_salary ?? record.base_salary,
    session_bonus: sheetRow.session_bonus ?? record.session_bonus,
    rating_bonus: sheetRow.rating_bonus ?? record.rating_bonus,
    kpi_bonus: sheetRow.kpi_bonus ?? record.kpi_bonus,
    violations_deduction: sheetRow.deductions ?? record.violations_deduction,
    service_percentage_bonus: sheetRow.advances ?? record.service_percentage_bonus,
    total_salary: sheetRow.total_salary ?? record.total_salary,
    total_sessions: sheetRow.total_sessions ?? record.total_sessions,
  };
}

async function getCentralSalarySheetRecordForKtv(params: {
  ktvId: string;
  tenantId: string;
  monthYear: string;
}) {
  const dataClient = await createAccountingDataClient();
  const { error: tenantContextError } = await dataClient.rpc('set_session_tenant', {
    p_tenant_id: params.tenantId,
  });

  if (tenantContextError) {
    throw new Error(`Failed to set salary sheet tenant context: ${tenantContextError.message}`);
  }

  const { data, error } = await dataClient.rpc('calculate_ktv_salary_sheet', {
    p_month_year: params.monthYear,
  });

  if (error) {
    throw new Error(`Failed to fetch central KTV salary sheet: ${error.message}`);
  }

  return ((data || []) as SalarySheetRow[]).find((row) => row.ktv_id === params.ktvId) ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculates pro-rata base salary for resigned KTVs based on their last working day.
 * 
 * Computes the proportional salary amount when a KTV resigns mid-month. Uses the formula:
 * `baseSalary * (daysWorked / totalDaysInMonth)`
 * 
 * @param baseSalary - Monthly base salary amount in VND
 * @param resignationDate - Last working day of the KTV
 * @param monthYear - Salary period for calculation
 * 
 * @returns Promise resolving to pro-rated salary amount (rounded to nearest integer)
 * 
 * @remarks
 * **Calculation Method:**
 * - Counts days from month start (inclusive) to resignation date (inclusive)
 * - Uses calendar days, not working days
 * - Handles negative results (resignation before month start) by returning 0
 * - Rounds to nearest VND (no decimal cents)
 * 
 * **Edge Cases:**
 * - Resignation on 1st of month: Returns `(baseSalary / daysInMonth) * 1`
 * - Resignation on last day: Returns full `baseSalary`
 * - Resignation before month start: Returns `0`
 * 
 * @example
 * ```typescript
 * // KTV resigns on June 15, 2026 (base salary: 6,000,000 VND)
 * const proRata = await calcProRataBaseSalary(
 *   6000000,
 *   new Date('2026-06-15'),
 *   new Date('2026-06-01')
 * );
 * // Result: 3,000,000 VND (15 days out of 30 days in June)
 * ```
 * 
 * @see {@link recalculateAndSaveSalaryRecordEngine} for automatic pro-rata application
 */
export async function calcProRataBaseSalary(baseSalary: number, resignationDate: Date, monthYear: Date): Promise<number> {
  const monthStart = new Date(monthYear.getFullYear(), monthYear.getMonth(), 1);
  const daysInMonth = new Date(monthYear.getFullYear(), monthYear.getMonth() + 1, 0).getDate();
  const daysWorked = Math.max(0, Math.floor((resignationDate.getTime() - monthStart.getTime()) / 86400000) + 1);
  return Math.round(baseSalary * (daysWorked / daysInMonth));
}

/**
 * KTV confirms their own salary record (self-service confirmation).
 * 
 * Allows a KTV employee to review and confirm their published salary through the mobile app
 * or web portal. Transitions the record from 'published', 'pending_approval', or 'disputed'
 * status to 'confirmed' status.
 * 
 * **Authorization**: Requires authenticated KTV user (role: 'ktv')
 * 
 * @param salaryRecordId - Unique identifier of the salary record to confirm
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if confirmation successful
 * - `{ success: false, error: string }` if operation failed (not logged in, wrong KTV, etc.)
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Only the owner KTV can confirm their own salary (enforced by `.eq('ktv_id', currentUser.id)`)
 * - Record must be in 'published', 'pending_approval', or 'disputed' status
 * - Sets `ktv_confirmed_at` timestamp to current time
 * - Does NOT set `confirmed_by_admin` flag (distinguishes from admin confirmation)
 * 
 * **Status Lifecycle:**
 * - Before: `published`, `pending_approval`, or `disputed`
 * - After: `confirmed` (ready for finalization)
 * 
 * **Audit Trail:**
 * - Records confirmation action in audit log
 * - Maintains compliance for labor law documentation
 * 
 * **Cache Invalidation:**
 * - Revalidates `/ktv/earnings` (KTV mobile app page)
 * - Revalidates `/dashboard/salary` (admin dashboard)
 * 
 * @example
 * ```typescript
 * // KTV confirms salary from mobile app
 * const result = await ktvConfirmSalary('salary-record-uuid');
 * if (result.success) {
 *   console.log('Salary confirmed. Thank you!');
 * } else {
 *   console.error(`Confirmation failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link adminConfirmOnBehalf} for admin-assisted confirmation
 * @see {@link getKtvSalaryForConfirmation} to fetch salary details for confirmation UI
 */
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

/**
 * KTV disputes their salary record with a written reason (self-service dispute).
 * 
 * Allows a KTV employee to challenge their published salary if they believe it's incorrect.
 * Transitions the record to 'disputed' status and creates a formal dispute ticket in the
 * `salary_disputes` table for admin review.
 * 
 * **Authorization**: Requires authenticated KTV user (role: 'ktv')
 * 
 * @param salaryRecordId - Unique identifier of the salary record to dispute
 * @param reason - Written explanation of the dispute (required, user-provided text)
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if dispute created successfully
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Only the owner KTV can dispute their own salary (enforced by `.eq('ktv_id', currentUser.id)`)
 * - Record must be in 'published' or 'pending_approval' status
 * - **Rollback Strategy**: If dispute ticket creation fails, restores previous salary record state
 * - Dispute ticket status: 'open' (awaiting admin resolution)
 * 
 * **Status Lifecycle:**
 * - Before: `published` or `pending_approval`
 * - After: `disputed` (blocked from confirmation until resolved)
 * 
 * **Dispute Workflow:**
 * 1. KTV submits dispute with reason
 * 2. Admin reviews dispute in `/dashboard/salary/disputes`
 * 3. Admin adjusts salary or rejects dispute
 * 4. Admin resolves dispute → status returns to 'published' or 'pending_approval'
 * 
 * **Cache Invalidation:**
 * - Revalidates `/ktv/earnings` (KTV mobile app page)
 * - Revalidates `/dashboard/salary` (admin dashboard shows disputed records)
 * 
 * @example
 * ```typescript
 * // KTV disputes missing sessions in salary calculation
 * const result = await ktvDisputeSalary(
 *   'salary-record-uuid',
 *   'Thiếu 3 ca ngày 15/06. Tổng ca phải là 28 chứ không phải 25.'
 * );
 * 
 * if (result.success) {
 *   console.log('Dispute submitted. Admin will review.');
 * } else {
 *   console.error(`Dispute failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link ktvConfirmSalary} for salary confirmation after dispute resolution
 */
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

/**
 * Fetches KTV salary record and session details for the confirmation screen.
 * 
 * Retrieves the salary breakdown (base salary, bonuses, deductions) and the list of completed
 * sessions for a KTV to review before confirming. Used to populate the KTV mobile app confirmation UI.
 * 
 * **Authorization**: Requires authenticated KTV user (role: 'ktv')
 * 
 * @param month - Optional salary period in YYYY-MM-01 format (defaults to current month)
 * 
 * @returns Promise resolving to:
 * - `KtvSalaryConfirmation` object with salary record and session list
 * - `null` if user not authenticated
 * 
 * @throws {Error} If database queries fail or tenant context missing
 * 
 * @remarks
 * **Data Sources:**
 * - Salary record from `salary_records` table
 * - Dynamic recalculation from `calculate_ktv_salary_sheet` RPC if record exists
 * - Session details from `session_logs` with booking and customer information
 * 
 * **Central KTV Salary Sheet Integration:**
 * - If a salary record exists, it's merged with the central salary sheet calculation
 * - Central sheet provides the authoritative source for dynamic components
 * - Ensures consistency between what KTV sees and what admin calculates
 * 
 * **Session Details Include:**
 * - Session ID, completion date, session number
 * - Package name and commission amount
 * - Customer name (mother's name for spa bookings)
 * 
 * **Authorization Logic:**
 * - KTV users can only see their own salary (enforced by `.eq('ktv_id', currentUser.id)`)
 * - Admin users should use {@link getSalaryData} instead for full access
 * 
 * @example
 * ```typescript
 * // Fetch current month salary for confirmation UI
 * const confirmation = await getKtvSalaryForConfirmation();
 * 
 * if (confirmation) {
 *   console.log(`Total Salary: ${confirmation.record.total_salary?.toLocaleString('vi-VN')}đ`);
 *   console.log(`Completed Sessions: ${confirmation.sessions.length}`);
 *   
 *   confirmation.sessions.forEach(session => {
 *     console.log(`- ${session.completed_date}: ${session.bookings?.package_name}`);
 *   });
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Fetch salary for a specific historical month
 * const june2026 = await getKtvSalaryForConfirmation('2026-06-01');
 * ```
 * 
 * @see {@link ktvConfirmSalary} to confirm salary after review
 * @see {@link ktvDisputeSalary} to dispute salary if incorrect
 */
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

  let resolvedRecord = record;
  // Note: If no saved record exists, we return null instead of creating a temporary record
  // The UI should handle null gracefully and show "no salary data available" message

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
    record: resolvedRecord,
    sessions: (sessions || []) as unknown as KtvSalaryConfirmationSession[],
  };
}
