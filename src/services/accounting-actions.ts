'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from './audit-actions';
import { getCurrentUser } from './user-actions';
import { AccountingEngineService } from './accounting-engine';
import type { AccountingReferenceType } from '@/lib/accounting-outbox';
import type { Database } from '@/types/database.types';

// Strict typing for custom account inputs
export interface CreateAccountInput {
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parent_id?: string | null;
}

// Strict typing for manual journal entry inputs
export interface ManualJournalInput {
  entry_date?: string;
  description: string;
  lines: {
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    branch_id?: string | null;
    ktv_id?: string | null;
    cost_center_id?: string | null;
  }[];
}

/**
 * 1. Fetch Chart of Accounts (COA)
 */
export async function getAccounts() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('account_code', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * 2. Create custom COA account
 */
export async function createAccount(input: CreateAccountInput) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can manage the Chart of Accounts.');
  }

  // Validate parent_id belongs to the same tenant if provided
  if (input.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('id', input.parent_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (parentError || !parent) {
      throw new Error('Tài khoản cha không hợp lệ hoặc không thuộc chi nhánh này.');
    }
  }

  const { data, error } = await supabase
    .from('accounting_accounts')
    .insert({
      tenant_id: user.tenant_id,
      account_code: input.account_code,
      account_name: input.account_name,
      account_type: input.account_type,
      parent_id: input.parent_id || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Mã tài khoản "${input.account_code}" đã tồn tại trong hệ thống.`);
    }
    throw error;
  }

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_accounts',
    record_id: data.id,
    new_data: data,
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return { success: true, data };
}

/**
 * 3. Update custom COA account details
 */
export async function updateAccount(id: string, input: Partial<CreateAccountInput> & { is_active?: boolean }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can manage the Chart of Accounts.');
  }

  const { data, error } = await supabase
    .from('accounting_accounts')
    .update({
      account_name: input.account_name,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', user.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_accounts',
    record_id: id,
    new_data: data,
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return { success: true, data };
}

/**
 * 4. Fetch General Ledger Journals (entries + lines)
 */
export async function getJournalEntries(filters?: {
  from_date?: string;
  to_date?: string;
  status?: 'DRAFT' | 'POSTED' | 'CANCELED';
  reference_type?: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  let query = supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounting_accounts (account_code, account_name)
      )
    `)
    .eq('tenant_id', user.tenant_id);

  if (filters?.from_date) {
    query = query.gte('entry_date', filters.from_date);
  }
  if (filters?.to_date) {
    query = query.lte('entry_date', filters.to_date);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.reference_type) {
    query = query.eq('reference_type', filters.reference_type);
  }

  const { data, error } = await query.order('entry_date', { ascending: false }).order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * 5. Fetch a single Journal Entry Details
 */
export async function getJournalEntryDetails(entryId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounting_accounts (account_code, account_name)
      )
    `)
    .eq('id', entryId)
    .eq('tenant_id', user.tenant_id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * 6. Reverse a posted Journal Entry (Journal Reversal)
 */
export async function reverseJournalEntry(entryId: string, reason: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can reverse journal entries.');
  }

  // 1. Fetch original entry and lines
  const { data: original, error: fetchError } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (*)
    `)
    .eq('id', entryId)
    .eq('tenant_id', user.tenant_id)
    .single();

  if (fetchError || !original) {
    throw new Error(fetchError?.message ?? 'Không tìm thấy bút toán cần đảo.');
  }

  if (original.status !== 'POSTED') {
    throw new Error('Chỉ có thể đảo bút toán đã ghi sổ (POSTED).');
  }

  // 2. Prepare reversed entries
  const reversalInput = {
    tenant_id: user.tenant_id, // Safely use current tenant_id
    description: `Ghi đảo bút toán (Reversal of entry: ${original.id}) - Lý do: ${reason}`,
    reference_type: 'REVERSAL' as AccountingReferenceType,
    reference_id: original.id,
    entry_date: original.entry_date, // Keep the same date
    lines: original.journal_lines.map((l: any) => ({
      account_id: l.account_id,
      debit_amount: Number(l.credit_amount), // Swapped!
      credit_amount: Number(l.debit_amount), // Swapped!
      branch_id: l.branch_id || undefined,
      ktv_id: l.ktv_id || undefined,
      cost_center_id: l.cost_center_id || undefined,
    })),
  };

  // 3. Post reversing entry (atomic bypasses RLS safely via service-role AccountingEngineService)
  const reversalEntryId = await AccountingEngineService.postJournalEntry(reversalInput);

  // 4. Mark original entry as CANCELED
  const { error: cancelError } = await supabase
    .from('journal_entries')
    .update({ status: 'CANCELED' })
    .eq('id', entryId)
    .eq('tenant_id', user.tenant_id);

  if (cancelError) {
    // If setting original status fails, log and throw
    throw new Error(`Failed to cancel original entry: ${cancelError.message}`);
  }

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'journal_entries',
    record_id: entryId,
    new_data: { status: 'CANCELED', reversed_by: reversalEntryId, reason },
  });

  await safeRevalidatePath(`/dashboard/accounting/journals`);
  await safeRevalidatePath(`/dashboard/accounting/journals/${entryId}`);

  return { success: true, reversalEntryId };
}

/**
 * 7. Fetch all accounting periods
 */
export async function getAccountingPeriods() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase
    .from('accounting_periods')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * 8a. Preview closing entries — Phase 29.1
 * Gọi RPC preview_closing_entries để hiển thị 3 bút toán sắp tạo trước khi đóng kỳ.
 */
export async function previewClosingEntries(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can preview closing entries.');
  }

  const { data, error } = await supabase.rpc('preview_closing_entries', {
    p_period_id: periodId,
  });

  if (error) throw error;
  return data || [];
}

/**
 * 8b. Close accounting period (Period Closing Workflow) — Phase 29.1
 * Gọi close_accounting_period RPC để:
 *   1. Validate không còn DRAFT
 *   2. Tự động generate 3 bút toán kết chuyển (5xx → 911 → 421)
 *   3. Cascade lock revenue/expenses/salary_records
 *   4. Set period.status = CLOSED
 */
export async function closePeriodAction(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can close accounting periods.');
  }

  // RPC close_accounting_period handles validation, generation, lock cascade atomically
  const { error } = await supabase.rpc('close_accounting_period', { p_period_id: periodId });
  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_periods',
    record_id: periodId,
    new_data: { status: 'CLOSED', closed_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/periods');
  await safeRevalidatePath('/dashboard/accounting/journals');
  return { success: true };
}

/**
 * 8c. Reopen accounting period — Phase 29.1
 * Chỉ HQ super admin được mở lại kỳ đã đóng. Auto unlock cascade revenue/expenses/salary.
 */
export async function reopenPeriodAction(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  const { error } = await supabase.rpc('reopen_accounting_period', { p_period_id: periodId });
  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_periods',
    record_id: periodId,
    new_data: { status: 'OPEN', reopened_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/periods');
  return { success: true };
}

/**
 * 9. Fetch Outbox Queue Monitor events
 */
export async function getOutboxEvents(filters?: {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD';
  event_type?: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can monitor the transactional outbox queue.');
  }

  let query = supabase
    .from('accounting_outbox')
    .select('*')
    .eq('tenant_id', user.tenant_id);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * 10. Replay/Retry outbox event manual action
 */
export async function replayOutboxEvent(outboxId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can trigger outbox retries.');
  }

  // Reset outbox entry to PENDING, retry_count = 0, and clear last error to make cron worker claim it immediately
  const { data, error } = await supabase
    .from('accounting_outbox')
    .update({
      status: 'PENDING',
      retry_count: 0,
      last_error: null,
      next_retry_at: new Date().toISOString(),
    })
    .eq('id', outboxId)
    .eq('tenant_id', user.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_outbox',
    record_id: outboxId,
    new_data: { status: 'PENDING', reset_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/outbox');
  return { success: true, data };
}

/**
 * 11. Create a manual adjusting double-entry journal (Manual Entry)
 */
export async function postManualJournalEntry(input: ManualJournalInput) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can post manual adjusting entries.');
  }

  // Prepare input formatting
  const journalInput = {
    tenant_id: user.tenant_id,
    description: input.description,
    reference_type: 'MANUAL' as AccountingReferenceType,
    reference_id: user.id, // Reference creator admin's uuid
    entry_date: input.entry_date || new Date().toISOString().slice(0, 10),
    lines: input.lines.map(l => ({
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
      branch_id: l.branch_id || undefined,
      ktv_id: l.ktv_id || undefined,
      cost_center_id: l.cost_center_id || undefined,
    })),
  };

  // Standard balanced triggers are evaluated inside this call
  const entryId = await AccountingEngineService.postJournalEntry(journalInput);

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'journal_entries',
    record_id: entryId,
    new_data: { description: input.description, manual: true },
  });

  await safeRevalidatePath('/dashboard/accounting/journals');
  return { success: true, entryId };
}

/**
 * 12. RPC Report: Trial Balance
 */
export async function getTrialBalanceReport(asOfDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_trial_balance', {
    p_tenant_id: user.tenant_id,
    p_as_of_date: asOfDate,
  });

  if (error) throw error;
  return data || [];
}

/**
 * 13. RPC Report: Income Statement (P&L)
 */
export async function getIncomeStatementReport(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_income_statement', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * 14. RPC Report: Balance Sheet
 */
export async function getBalanceSheetReport(asOfDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_balance_sheet', {
    p_tenant_id: user.tenant_id,
    p_as_of_date: asOfDate,
  });

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * 15. RPC Report: General Account Ledger
 */
export async function getAccountLedgerReport(accountId: string, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_account_ledger', {
    p_tenant_id: user.tenant_id,
    p_account_id: accountId,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;
  return data || [];
}

/**
 * 16. RPC Report: Cash Flow Statement (Phase 29.2) — phương pháp gián tiếp chuẩn TT133
 */
export async function getCashFlowStatementReport(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_cash_flow_statement', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * 17. RPC Report: Reconciliation (Phase 29.5) — Đối soát chéo Legacy vs Ledger
 * So sánh sum revenue/expenses cũ với sum journal_entries mới, hiển thị diff + status.
 */
export interface ReconciliationRow {
  category: string;
  category_label: string;
  legacy_amount: number;
  ledger_amount: number;
  diff_amount: number;
  diff_percent: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF';
}

export async function getReconciliationReport(fromDate: string, toDate: string): Promise<ReconciliationRow[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin của chi nhánh mới được xem báo cáo đối soát chéo.');
  }

  // Use admin client (service role) — bypass session/GRANT issues.
  // Authorization đã được kiểm tra ở JavaScript layer above.
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminClient = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminClient.rpc('get_reconciliation_report', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) {
    console.error('[getReconciliationReport] RPC error:', JSON.stringify({
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    }, null, 2));
    throw error;
  }
  return (data as ReconciliationRow[]) || [];
}
