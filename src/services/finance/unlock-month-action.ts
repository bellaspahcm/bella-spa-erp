'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type RevenueUpdate = Database['public']['Tables']['revenue']['Update'];
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];
type BellaSupabaseClient = SupabaseClient<Database>;
type LockTable = 'revenue' | 'expenses' | 'salary_records';
type LockUpdateResult = { error: { message: string } | null };
type LockUpdateFailure = { table: LockTable; message: string };

type MonthScope = {
  tenantId: string;
  startDateStr: string;
  endDateStr: string;
};

type MonthLockSnapshot = {
  revenueIds: string[];
  expenseIds: string[];
  salaryRecordIds: string[];
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi hệ thống';
}

function formatMonthDate(year: number, monthNumber: number, day: number) {
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthScopeDates(month: string) {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Tháng mở khóa không hợp lệ');
  }

  const lastDay = new Date(year, monthNumber, 0).getDate();

  return {
    startDateStr: formatMonthDate(year, monthNumber, 1),
    endDateStr: `${formatMonthDate(year, monthNumber, lastDay)}T23:59:59`
  };
}

function collectLockedIds(rows: Array<{ id: string; is_locked: boolean | null }>) {
  return rows.filter((row) => row.is_locked).map((row) => row.id);
}

async function fetchMonthLockSnapshot(supabase: BellaSupabaseClient, scope: MonthScope): Promise<MonthLockSnapshot> {
  const [revenueResult, expenseResult, salaryResult] = await Promise.all([
    supabase.from('revenue').select('id, is_locked')
      .eq('tenant_id', scope.tenantId).gte('received_date', scope.startDateStr).lte('received_date', scope.endDateStr),
    supabase.from('expenses').select('id, is_locked')
      .eq('tenant_id', scope.tenantId).gte('expense_date', scope.startDateStr).lte('expense_date', scope.endDateStr),
    supabase.from('salary_records').select('id, is_locked')
      .eq('tenant_id', scope.tenantId).eq('month_year', scope.startDateStr)
  ]);

  if (revenueResult.error) throw new Error(`Failed to fetch revenue lock snapshot: ${revenueResult.error.message}`);
  if (expenseResult.error) throw new Error(`Failed to fetch expense lock snapshot: ${expenseResult.error.message}`);
  if (salaryResult.error) throw new Error(`Failed to fetch salary lock snapshot: ${salaryResult.error.message}`);

  return {
    revenueIds: collectLockedIds(revenueResult.data ?? []),
    expenseIds: collectLockedIds(expenseResult.data ?? []),
    salaryRecordIds: collectLockedIds(salaryResult.data ?? [])
  };
}

async function collectLockUpdateFailures(
  operations: Array<{ table: LockTable; operation: PromiseLike<LockUpdateResult> }>
) {
  const results = await Promise.allSettled(operations.map((item) => Promise.resolve(item.operation)));

  return results.reduce<LockUpdateFailure[]>((failures, result, index) => {
    const table = operations[index].table;
    if (result.status === 'rejected') {
      failures.push({ table, message: getErrorMessage(result.reason) });
      return failures;
    }
    if (result.value.error) {
      failures.push({ table, message: result.value.error.message });
    }
    return failures;
  }, []);
}

async function updateMonthLockState(
  supabase: BellaSupabaseClient,
  scope: MonthScope,
  isLocked: boolean,
  snapshot?: MonthLockSnapshot
) {
  const revenuePayload: RevenueUpdate = { is_locked: isLocked };
  const expensePayload: ExpenseUpdate = { is_locked: isLocked };
  const salaryPayload: SalaryRecordUpdate = { is_locked: isLocked };

  const revenueQuery = supabase.from('revenue').update(revenuePayload)
    .eq('tenant_id', scope.tenantId).gte('received_date', scope.startDateStr).lte('received_date', scope.endDateStr);
  const expenseQuery = supabase.from('expenses').update(expensePayload)
    .eq('tenant_id', scope.tenantId).gte('expense_date', scope.startDateStr).lte('expense_date', scope.endDateStr);
  const salaryQuery = supabase.from('salary_records').update(salaryPayload)
    .eq('tenant_id', scope.tenantId).eq('month_year', scope.startDateStr);

  if (isLocked && snapshot) {
    return collectLockUpdateFailures([
      {
        table: 'revenue',
        operation: snapshot.revenueIds.length > 0 ? revenueQuery.in('id', snapshot.revenueIds) : Promise.resolve({ error: null })
      },
      {
        table: 'expenses',
        operation: snapshot.expenseIds.length > 0 ? expenseQuery.in('id', snapshot.expenseIds) : Promise.resolve({ error: null })
      },
      {
        table: 'salary_records',
        operation: snapshot.salaryRecordIds.length > 0 ? salaryQuery.in('id', snapshot.salaryRecordIds) : Promise.resolve({ error: null })
      }
    ]);
  }

  return collectLockUpdateFailures([
    { table: 'revenue', operation: revenueQuery },
    { table: 'expenses', operation: expenseQuery },
    { table: 'salary_records', operation: salaryQuery }
  ]);
}

async function rollbackMonthUnlock(
  supabase: BellaSupabaseClient,
  scope: MonthScope,
  snapshot: MonthLockSnapshot
) {
  return updateMonthLockState(supabase, scope, true, snapshot);
}

function formatFailures(failures: LockUpdateFailure[]) {
  return failures.map((failure) => `${failure.table}: ${failure.message}`).join('; ');
}

function withRollbackFailure(unlockFailures: LockUpdateFailure[], rollbackFailures: LockUpdateFailure[]) {
  const unlockMessage = formatFailures(unlockFailures);
  return rollbackFailures.length > 0
    ? `Lỗi mở khóa sổ: ${unlockMessage}; rollback failed: ${formatFailures(rollbackFailures)}`
    : `Lỗi mở khóa sổ: ${unlockMessage}`;
}

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

    const { startDateStr, endDateStr } = getMonthScopeDates(month);
    const scope: MonthScope = {
      tenantId: user.tenant_id,
      startDateStr,
      endDateStr
    };

    const snapshot = await fetchMonthLockSnapshot(supabase, scope);
    const unlockFailures = await updateMonthLockState(supabase, scope, false);

    if (unlockFailures.length > 0) {
      const rollbackFailures = await rollbackMonthUnlock(supabase, scope, snapshot);
      return {
        success: false,
        error: withRollbackFailure(unlockFailures, rollbackFailures)
      };
    }

    revalidatePath('/dashboard/finance');
    return { success: true, month };
  } catch (e: unknown) {
    console.error('[unlockMonth]', e);
    Sentry.captureException(e);
    return { success: false, error: getErrorMessage(e) };
  }
}
