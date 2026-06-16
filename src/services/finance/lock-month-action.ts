'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertMonthClosePreflight } from '@/core/services/accounting/health';
import type { Database } from '@/types/database.types';
import {
  buildBranchAbbreviation,
  calculateInterBranchClearingAmount,
  calculateRoyaltyAmount,
  resolveRoyaltyType,
} from '@/lib/business-rules/franchise';

type RevenueUpdate = Database['public']['Tables']['revenue']['Update'];
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];
type RoyaltyInvoiceInsert = Database['public']['Tables']['franchise_royalty_invoices']['Insert'];
type RoyaltyInvoiceUpdate = Database['public']['Tables']['franchise_royalty_invoices']['Update'];
type ClearingRecordInsert = Database['public']['Tables']['inter_branch_clearing_records']['Insert'];
type ClearingRecordUpdate = Database['public']['Tables']['inter_branch_clearing_records']['Update'];
type BellaSupabaseClient = SupabaseClient<Database>;

type MonthScope = {
  startDateStr: string;
  endDateStr: string;
  nextMonthStartStr: string;
};

type LockSnapshot = {
  revenueRows: LockStateRow[];
  expenseRows: LockStateRow[];
  salaryRecordRows: LockStateRow[];
};

type RestoreFailure = {
  table: 'revenue' | 'expenses' | 'salary_records';
  message: string;
};

type LockStateRow = {
  id: string;
  is_locked: boolean | null;
  status: string | null;
};

type SessionLogWithBookingTenant = {
  id: string;
  tenant_id: string | null;
  bookings: { tenant_id: string | null } | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi hệ thống';
}

function formatMonthDate(year: number, monthNumber: number, day: number) {
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthScope(month: string): MonthScope {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Tháng khóa sổ không hợp lệ');
  }

  const lastDay = new Date(year, monthNumber, 0).getDate();
  const nextMonthDate = monthNumber === 12
    ? { year: year + 1, monthNumber: 1 }
    : { year, monthNumber: monthNumber + 1 };

  return {
    startDateStr: formatMonthDate(year, monthNumber, 1),
    endDateStr: formatMonthDate(year, monthNumber, lastDay),
    nextMonthStartStr: formatMonthDate(nextMonthDate.year, nextMonthDate.monthNumber, 1)
  };
}

function rowsOrEmpty(rows: LockStateRow[] | null) {
  return rows ?? [];
}

function groupRowsByPreviousState(rows: LockStateRow[]) {
  const groups = new Map<string, { isLocked: boolean | null; status: string | null; ids: string[] }>();

  for (const row of rows) {
    const key = `${String(row.is_locked)}|${row.status ?? 'NULL'}`;
    const current = groups.get(key);
    if (current) {
      current.ids.push(row.id);
      continue;
    }
    groups.set(key, {
      isLocked: row.is_locked,
      status: row.status,
      ids: [row.id]
    });
  }

  return Array.from(groups.values());
}

async function fetchPreLockSnapshot(
  supabase: BellaSupabaseClient,
  tenantId: string,
  scope: MonthScope
): Promise<LockSnapshot> {
  const [revenueResult, expenseResult, salaryResult] = await Promise.all([
    supabase.from('revenue').select('id, is_locked, status')
      .eq('tenant_id', tenantId).gte('received_date', scope.startDateStr).lt('received_date', scope.nextMonthStartStr),
    supabase.from('expenses').select('id, is_locked, status')
      .eq('tenant_id', tenantId).gte('expense_date', scope.startDateStr).lt('expense_date', scope.nextMonthStartStr),
    supabase.from('salary_records').select('id, is_locked, status')
      .eq('tenant_id', tenantId).eq('month_year', scope.startDateStr)
  ]);

  if (revenueResult.error) throw new Error(`[lockMonth] Failed to snapshot revenue lock state: ${revenueResult.error.message}`);
  if (expenseResult.error) throw new Error(`[lockMonth] Failed to snapshot expense lock state: ${expenseResult.error.message}`);
  if (salaryResult.error) throw new Error(`[lockMonth] Failed to snapshot salary lock state: ${salaryResult.error.message}`);

  return {
    revenueRows: rowsOrEmpty(revenueResult.data),
    expenseRows: rowsOrEmpty(expenseResult.data),
    salaryRecordRows: rowsOrEmpty(salaryResult.data)
  };
}

async function collectRestoreFailures(
  operations: Array<{ table: RestoreFailure['table']; operation: PromiseLike<{ error: { message: string } | null }> }>
) {
  const results = await Promise.allSettled(operations.map((item) => Promise.resolve(item.operation)));

  return results.reduce<RestoreFailure[]>((failures, result, index) => {
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

async function restorePreLockState(
  supabase: BellaSupabaseClient,
  tenantId: string,
  scope: MonthScope,
  snapshot: LockSnapshot
) {
  const operations: Array<{ table: RestoreFailure['table']; operation: PromiseLike<{ error: { message: string } | null }> }> = [];

  for (const group of groupRowsByPreviousState(snapshot.revenueRows)) {
    const revenuePayload: RevenueUpdate = { is_locked: group.isLocked, status: group.status };
    operations.push({
      table: 'revenue',
      operation: supabase.from('revenue').update(revenuePayload)
        .eq('tenant_id', tenantId).gte('received_date', scope.startDateStr).lt('received_date', scope.nextMonthStartStr)
        .in('id', group.ids)
    });
  }

  for (const group of groupRowsByPreviousState(snapshot.expenseRows)) {
    const expensePayload: ExpenseUpdate = { is_locked: group.isLocked, status: group.status };
    operations.push({
      table: 'expenses',
      operation: supabase.from('expenses').update(expensePayload)
        .eq('tenant_id', tenantId).gte('expense_date', scope.startDateStr).lt('expense_date', scope.nextMonthStartStr)
        .in('id', group.ids)
    });
  }

  for (const group of groupRowsByPreviousState(snapshot.salaryRecordRows)) {
    const salaryPayload: SalaryRecordUpdate = { is_locked: group.isLocked, status: group.status };
    operations.push({
      table: 'salary_records',
      operation: supabase.from('salary_records').update(salaryPayload)
        .eq('tenant_id', tenantId).eq('month_year', scope.startDateStr)
        .in('id', group.ids)
    });
  }

  return collectRestoreFailures(operations);
}

function withRestoreFailures(sideEffectError: unknown, restoreFailures: RestoreFailure[]) {
  const baseMessage = `Lỗi hệ thống khi khóa sổ: ${getErrorMessage(sideEffectError)}`;
  if (restoreFailures.length === 0) return baseMessage;

  const restoreMessage = restoreFailures.map((failure) => `${failure.table}: ${failure.message}`).join('; ');
  return `${baseMessage}; restore failed: ${restoreMessage}`;
}

async function syncFranchiseRoyalty(
  supabase: BellaSupabaseClient,
  tenantId: string,
  month: string,
  scope: MonthScope
) {
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('name, royalty_type, royalty_rate, royalty_fixed_amount')
    .eq('id', tenantId)
    .single();

  if (tenantErr || !tenant) {
    throw new Error(`[lockMonth] Failed to retrieve tenant config for royalty calculations: ${tenantErr?.message || 'Tenant not found'}`);
  }

  const { data: revenues, error: revError } = await supabase
    .from('revenue')
    .select('amount')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .gte('received_date', scope.startDateStr)
    .lte('received_date', scope.endDateStr);

  if (revError) {
    throw new Error(`[lockMonth] Failed to fetch revenues for royalty calculation: ${revError.message}`);
  }

  const grossRevenue = (revenues || []).reduce((sum: number, r) => sum + (Number(r.amount) || 0), 0);
  const royaltyType = resolveRoyaltyType(tenant.royalty_type);
  const calculatedAmount = calculateRoyaltyAmount({
    grossRevenue,
    royaltyType,
    royaltyRate: tenant.royalty_rate,
    royaltyFixedAmount: tenant.royalty_fixed_amount,
  });

  const abbreviation = buildBranchAbbreviation(tenant.name, 'BRANCH');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const yearMonth = month.substring(0, 7).replace('-', '');
  const invoiceNumber = `ROY-${yearMonth}-${abbreviation}-${randomSuffix}`;

  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from('franchise_royalty_invoices')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('month_year', scope.startDateStr)
    .maybeSingle();

  if (existingInvoiceError) {
    throw new Error(`[lockMonth] Failed to check existing royalty invoice: ${existingInvoiceError.message}`);
  }

  if (existingInvoice) {
    if (existingInvoice.status !== 'paid') {
      const invoiceUpdatePayload: RoyaltyInvoiceUpdate = {
        gross_revenue: grossRevenue,
        royalty_type: royaltyType,
        royalty_rate: tenant.royalty_rate,
        royalty_fixed_amount: tenant.royalty_fixed_amount,
        calculated_amount: calculatedAmount,
        status: 'pending'
      };
      const { error: invoiceUpdateError } = await supabase
        .from('franchise_royalty_invoices')
        .update(invoiceUpdatePayload)
        .eq('id', existingInvoice.id);
      if (invoiceUpdateError) {
        throw new Error(`[lockMonth] Failed to update royalty invoice: ${invoiceUpdateError.message}`);
      }
    }
    return;
  }

  const invoiceInsertPayload: RoyaltyInvoiceInsert = {
    tenant_id: tenantId,
    invoice_number: invoiceNumber,
    month_year: scope.startDateStr,
    gross_revenue: grossRevenue,
    royalty_type: royaltyType,
    royalty_rate: tenant.royalty_rate,
    royalty_fixed_amount: tenant.royalty_fixed_amount,
    calculated_amount: calculatedAmount,
    status: 'pending'
  };

  const { error: invoiceInsertError } = await supabase
    .from('franchise_royalty_invoices')
    .insert(invoiceInsertPayload);
  if (invoiceInsertError) {
    throw new Error(`[lockMonth] Failed to create royalty invoice: ${invoiceInsertError.message}`);
  }
}

async function syncInterBranchClearing(
  supabase: BellaSupabaseClient,
  tenantId: string,
  month: string,
  scope: MonthScope
) {
  const { data: sessionLogs, error: sessionErr } = await supabase
    .from('session_logs')
    .select(`
      id,
      tenant_id,
      bookings (
        tenant_id
      )
    `)
    .eq('status', 'completed')
    .gte('completed_date', scope.startDateStr)
    .lte('completed_date', scope.endDateStr);

  if (sessionErr) {
    throw new Error(`[lockMonth] Failed to fetch session logs for clearing: ${sessionErr.message}`);
  }

  const interBranchSessions = ((sessionLogs || []) as SessionLogWithBookingTenant[]).filter((s) => {
    const sessionTenantId = s.tenant_id;
    const bookingTenantId = s.bookings?.tenant_id;
    return sessionTenantId && bookingTenantId && sessionTenantId !== bookingTenantId &&
      (sessionTenantId === tenantId || bookingTenantId === tenantId);
  });

  const pairs: Record<string, { debtor_tenant_id: string; creditor_tenant_id: string; session_count: number }> = {};
  for (const session of interBranchSessions) {
    const debtor = session.bookings?.tenant_id;
    const creditor = session.tenant_id;
    if (!debtor || !creditor) continue;
    const key = `${debtor}_${creditor}`;
    if (!pairs[key]) {
      pairs[key] = {
        debtor_tenant_id: debtor,
        creditor_tenant_id: creditor,
        session_count: 0
      };
    }
    pairs[key].session_count += 1;
  }

  const allInvolvedTenantIds = Array.from(new Set(
    Object.values(pairs).flatMap(p => [p.debtor_tenant_id, p.creditor_tenant_id])
  ));

  if (allInvolvedTenantIds.length === 0) return;

  const { data: tenants, error: tenantsErr } = await supabase
    .from('tenants')
    .select('id, name, internal_clearing_rate')
    .in('id', allInvolvedTenantIds);

  if (tenantsErr) {
    throw new Error(`[lockMonth] Failed to fetch tenants for clearing: ${tenantsErr.message}`);
  }

  const tenantMap: Record<string, { name: string; internal_clearing_rate: number }> = {};
  (tenants || []).forEach((t) => {
    tenantMap[t.id] = {
      name: t.name || 'Branch',
      internal_clearing_rate: Number(t.internal_clearing_rate) || 150000.00
    };
  });

  for (const key of Object.keys(pairs)) {
    const pair = pairs[key];
    const debtorName = tenantMap[pair.debtor_tenant_id]?.name || 'DEBTOR';
    const creditorName = tenantMap[pair.creditor_tenant_id]?.name || 'CREDITOR';
    const clearingRate = tenantMap[pair.creditor_tenant_id]?.internal_clearing_rate || 150000.00;
    const calculatedAmount = calculateInterBranchClearingAmount({
      sessionCount: pair.session_count,
      clearingRate,
    });

    const debtorAbbr = buildBranchAbbreviation(debtorName, 'DEBTOR');
    const creditorAbbr = buildBranchAbbreviation(creditorName, 'CREDITOR');
    const yearMonth = month.substring(0, 7).replace('-', '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const clearingNumber = `CLR-${yearMonth}-${debtorAbbr}-${creditorAbbr}-${randomSuffix}`;

    const { data: existingRecord, error: existingRecordError } = await supabase
      .from('inter_branch_clearing_records')
      .select('id, status')
      .eq('month_year', scope.startDateStr)
      .eq('debtor_tenant_id', pair.debtor_tenant_id)
      .eq('creditor_tenant_id', pair.creditor_tenant_id)
      .maybeSingle();

    if (existingRecordError) {
      throw new Error(`[lockMonth] Failed to check existing inter-branch clearing record: ${existingRecordError.message}`);
    }

    if (existingRecord) {
      if (existingRecord.status !== 'cleared') {
        const clearingUpdatePayload: ClearingRecordUpdate = {
          session_count: pair.session_count,
          clearing_rate: clearingRate,
          calculated_amount: calculatedAmount,
          status: 'pending'
        };
        const { error: clearingUpdateError } = await supabase
          .from('inter_branch_clearing_records')
          .update(clearingUpdatePayload)
          .eq('id', existingRecord.id);
        if (clearingUpdateError) {
          throw new Error(`[lockMonth] Failed to update inter-branch clearing record: ${clearingUpdateError.message}`);
        }
      }
      continue;
    }

    const clearingInsertPayload: ClearingRecordInsert = {
      clearing_number: clearingNumber,
      month_year: scope.startDateStr,
      debtor_tenant_id: pair.debtor_tenant_id,
      creditor_tenant_id: pair.creditor_tenant_id,
      session_count: pair.session_count,
      clearing_rate: clearingRate,
      calculated_amount: calculatedAmount,
      status: 'pending'
    };
    const { error: clearingInsertError } = await supabase
      .from('inter_branch_clearing_records')
      .insert(clearingInsertPayload);
    if (clearingInsertError) {
      throw new Error(`[lockMonth] Failed to create inter-branch clearing record: ${clearingInsertError.message}`);
    }
  }
}

export async function lockMonth(month: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    const { getCurrentUser } = await import('../user-actions');
    const user = await getCurrentUser();
    
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    if (user.role !== 'admin') {
      return { success: false, error: 'Chỉ Admin mới có thể khóa sổ tháng' };
    }
    
    if (!user.tenant_id) return { success: false, error: 'Không tìm thấy tenant_id' };

    const scope = getMonthScope(month);
    try {
      await assertMonthClosePreflight(month, { supabase, tenantId: user.tenant_id });
    } catch (preflightError) {
      return { success: false, error: getErrorMessage(preflightError) };
    }

    const snapshot = await fetchPreLockSnapshot(supabase, user.tenant_id, scope);

    const { error } = await supabase.rpc('lock_monthly_records', {
      p_tenant_id: user.tenant_id,
      p_month: month
    });

    if (error) {
      console.error('[lockMonth] RPC error:', error);
      return { success: false, error: 'Lỗi khóa sổ: ' + error.message };
    }

    try {
      await syncFranchiseRoyalty(supabase, user.tenant_id, month, scope);
      await syncInterBranchClearing(supabase, user.tenant_id, month, scope);
    } catch (sideEffectError) {
      console.error('[lockMonth] Side-effect error after lock RPC:', sideEffectError);
      const restoreFailures = await restorePreLockState(supabase, user.tenant_id, scope, snapshot);
      revalidatePath('/dashboard/finance');
      revalidatePath('/dashboard/accounting/health');
      return { success: false, error: withRestoreFailures(sideEffectError, restoreFailures) };
    }

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/accounting/health');
    return { success: true, month };
  } catch (e: unknown) {
    console.error('[lockMonth]', e);
    Sentry.captureException(e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}
