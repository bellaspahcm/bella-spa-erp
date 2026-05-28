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
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin hoặc kế toán của chi nhánh mới được xem báo cáo đối soát chéo.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallback sang user client nếu hoàn toàn không có serviceKey (ví dụ: trên Vercel chưa cấu hình)
  if (!serviceKey) {
    console.warn('[getReconciliationReport] SUPABASE_SERVICE_ROLE_KEY is missing. Using user client fallback.');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_reconciliation_report', {
      p_tenant_id: user.tenant_id,
      p_from_date: fromDate,
      p_to_date: toDate,
    });

    if (error) {
      console.error('[getReconciliationReport] Fallback RPC error:', JSON.stringify({
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      }, null, 2));
      throw error; // Zero Silent Database Failures
    }
    return (data as ReconciliationRow[]) || [];
  }

  // Sử dụng adminClient chính thức (service role)
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
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
    throw error; // Zero Silent Database Failures
  }
  return (data as ReconciliationRow[]) || [];
}

/**
 * 18. RPC Report: Salary Reconciliation (M2) — So sánh per-KTV salary_records cũ vs calculate_ktv_salary_sheet AI
 * Pattern matches Phase 29.5 reconciliation. Detect drift trước khi switch legacy → AI hoàn toàn.
 */
export interface SalaryReconciliationRow {
  ktv_id: string;
  ktv_name: string;
  legacy_base_salary: number;
  legacy_session_bonus: number;
  legacy_kpi_bonus: number;
  legacy_deductions: number;
  legacy_total: number;
  legacy_status: string;
  ai_base_salary: number;
  ai_session_bonus: number;
  ai_kpi_bonus: number;
  ai_deductions: number;
  ai_total: number;
  diff_total: number;
  diff_percent: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'PENDING_LEGACY';
}

export async function getSalaryReconciliationReport(monthYear: string): Promise<SalaryReconciliationRow[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được xem báo cáo đối soát lương.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallback sang user client nếu hoàn toàn không có serviceKey (ví dụ: trên Vercel chưa cấu hình)
  if (!serviceKey) {
    console.warn('[getSalaryReconciliationReport] SUPABASE_SERVICE_ROLE_KEY is missing. Using user client fallback.');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_salary_reconciliation_report', {
      p_tenant_id: user.tenant_id,
      p_month_year: monthYear,
    });

    if (error) {
      console.error('[getSalaryReconciliationReport] Fallback RPC error:', JSON.stringify({
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      }, null, 2));
      throw error; // Zero Silent Database Failures
    }
    return (data as SalaryReconciliationRow[]) || [];
  }

  // Sử dụng adminClient chính thức (service role)
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const adminClient = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Set tenant context (calculate_ktv_salary_sheet requires it for service_role)
  await adminClient.rpc('set_session_tenant', { p_tenant_id: user.tenant_id });

  const { data, error } = await adminClient.rpc('get_salary_reconciliation_report', {
    p_tenant_id: user.tenant_id,
    p_month_year: monthYear,
  });

  if (error) {
    console.error('[getSalaryReconciliationReport] RPC error:', JSON.stringify({
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    }, null, 2));
    throw error; // Zero Silent Database Failures
  }
  return (data as SalaryReconciliationRow[]) || [];
}

/**
 * 19. Get accounting mode for the current tenant
 */
export async function getAccountingMode(): Promise<'SIMPLE' | 'PROFESSIONAL'> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized: missing tenant session.');

  const { data, error } = await supabase
    .from('tenants')
    .select('accounting_mode')
    .eq('id', user.tenant_id)
    .single();

  if (error || !data) {
    return 'SIMPLE'; // Fallback mặc định
  }
  return (data.accounting_mode as 'SIMPLE' | 'PROFESSIONAL') || 'SIMPLE';
}

/**
 * 20. Update accounting mode for the current tenant
 */
export async function updateAccountingMode(mode: 'SIMPLE' | 'PROFESSIONAL') {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin mới được thay đổi chế độ kế toán.');
  }

  const { error } = await supabase
    .from('tenants')
    .update({ accounting_mode: mode })
    .eq('id', user.tenant_id);

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: user.tenant_id,
    new_data: { accounting_mode: mode },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  return { success: true };
}

/**
 * 21. Sync legacy transactions (revenue, expenses, salary) to accounting ledger
 * Thực hiện quét toàn bộ lịch sử thu/chi/lương chưa hạch toán của chi nhánh hiện tại
 * và ghi nhận bút toán kép chuẩn TT133 một cách Idempotent (tránh trùng lặp).
 */
export async function syncLegacyToLedger() {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin mới được thực hiện đồng bộ dữ liệu kế toán sổ cái.');
  }

  const tenantId = user.tenant_id;

  // Load service role client to post entries bypassing RLS restrictions
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('Lỗi: Thiếu SUPABASE_SERVICE_ROLE_KEY trên server để thực hiện đồng bộ.');
  }
  const adminClient = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Lấy danh sách các reference_id đã được hạch toán trước đó trong journal_entries để tránh trùng
  const { data: existingEntries, error: existingError } = await adminClient
    .from('journal_entries')
    .select('reference_id')
    .eq('tenant_id', tenantId)
    .not('reference_id', 'is', null);

  if (existingError) throw existingError;
  const existingSet = new Set(existingEntries.map(e => e.reference_id));

  let syncedRevenueCount = 0;
  let syncedExpenseCount = 0;
  let syncedSalaryCount = 0;

  // ── A. ĐỒNG BỘ DOANH THU (REVENUE) ──
  const { data: revenues, error: revError } = await adminClient
    .from('revenue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed');

  if (revError) throw revError;

  // Cache COA accounts
  const { data: cashAcc, error: cashAccErr } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '111')
    .eq('is_active', true)
    .single();

  const { data: bankAcc, error: bankAccErr } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '112')
    .eq('is_active', true)
    .single();

  const { data: revAcc, error: revAccErr } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '5111')
    .eq('is_active', true)
    .single();

  if (cashAccErr || bankAccErr || revAccErr) {
    throw new Error('Thiếu cấu hình tài khoản kế toán 111, 112 hoặc 5111 cho chi nhánh này trong COA.');
  }

  for (const rev of (revenues || [])) {
    if (existingSet.has(rev.id)) continue; // Bỏ qua nếu đã hạch toán

    const amount = Number(rev.amount);
    if (amount <= 0) continue;

    const payAccountId = rev.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

    // Hạch toán: Nợ 111/112 Có 5111
    await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `[Đồng bộ lịch sử] ${rev.description || 'Doanh thu dịch vụ'}`,
      reference_type: 'PACKAGE_SALE',
      reference_id: rev.id,
      entry_date: rev.received_date ? rev.received_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      lines: [
        { account_id: payAccountId, debit_amount: amount, credit_amount: 0, branch_id: rev.branch_id || undefined },
        { account_id: revAcc.id, debit_amount: 0, credit_amount: amount, branch_id: rev.branch_id || undefined },
      ],
    });
    syncedRevenueCount++;
  }

  // ── B. ĐỒNG BỘ CHI PHÍ (EXPENSES) ──
  const { data: expenses, error: expError } = await adminClient
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved');

  if (expError) throw expError;

  for (const exp of (expenses || [])) {
    if (existingSet.has(exp.id)) continue;

    const amount = Number(exp.amount);
    if (amount <= 0) continue;

    // Định vị tài khoản chi phí tương tự handleExpenseRecorded
    let expenseAccountCode = '6427'; // Chi phí khác bằng tiền
    const normCategory = exp.category?.toLowerCase();
    if (normCategory === 'rent') {
      expenseAccountCode = '6423';
    } else if (normCategory === 'utilities') {
      expenseAccountCode = '6424';
    } else if (normCategory === 'marketing') {
      expenseAccountCode = '6425';
    } else if (normCategory === 'materials') {
      expenseAccountCode = '632';
    } else if (normCategory === 'salary') {
      expenseAccountCode = '6421';
    }

    const { data: expAcc } = await adminClient
      .from('accounting_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('account_code', expenseAccountCode)
      .eq('is_active', true)
      .single();

    if (!expAcc) continue;

    const payAccountId = exp.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

    // Hạch toán: Nợ Chi phí Có 111/112
    await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `[Đồng bộ lịch sử] ${exp.description || 'Chi phí vận hành'}`,
      reference_type: 'EXPENSE',
      reference_id: exp.id,
      entry_date: exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      lines: [
        { account_id: expAcc.id, debit_amount: amount, credit_amount: 0, branch_id: exp.branch_id || undefined },
        { account_id: payAccountId, debit_amount: 0, credit_amount: amount, branch_id: exp.branch_id || undefined },
      ],
    });
    syncedExpenseCount++;
  }

  // ── C. ĐỒNG BỘ CHI PHÍ LƯƠNG (SALARY RECORDS) ──
  const { data: salaries, error: salError } = await adminClient
    .from('salary_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid');

  if (salError) throw salError;

  const { data: payableAcc } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '334')
    .eq('is_active', true)
    .single();

  const { data: salCostAcc } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '6421')
    .eq('is_active', true)
    .single();

  if (payableAcc && salCostAcc) {
    for (const sal of (salaries || [])) {
      if (existingSet.has(sal.id)) continue;

      // Tính tổng lương thực tế trả
      const totalAmount = Number(sal.base_salary || 0) + Number(sal.kpi_bonus || 0) + Number(sal.service_percentage_bonus || 0) - Number(sal.violations_deduction || 0);
      if (totalAmount <= 0) continue;

      const payAccountId = sal.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

      // Lương gồm 2 bước trong sổ kép:
      // Bước 1: Ghi nhận chi phí lương: Nợ 6421 Có 334
      await AccountingEngineService.postJournalEntry({
        tenant_id: tenantId,
        description: `[Đồng bộ lịch sử] Hạch toán chi phí lương KTV - Kỳ ${sal.month_year}`,
        reference_type: 'SALARY_PAYMENT',
        reference_id: sal.id,
        entry_date: sal.month_year ? sal.month_year.slice(0, 10) : new Date().toISOString().slice(0, 10),
        lines: [
          { account_id: salCostAcc.id, debit_amount: totalAmount, credit_amount: 0, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
          { account_id: payableAcc.id, debit_amount: 0, credit_amount: totalAmount, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
        ],
      });

      // Bước 2: Trả lương thực tế: Nợ 334 Có 111/112 (vì đã paid)
      // Tạo ID phụ để tránh trùng lặp reference_id cho bước 2
      await AccountingEngineService.postJournalEntry({
        tenant_id: tenantId,
        description: `[Đồng bộ lịch sử] Chi trả lương KTV - Kỳ ${sal.month_year}`,
        reference_type: 'SALARY_PAYMENT',
        reference_id: `${sal.id}-PAY`,
        entry_date: sal.month_year ? sal.month_year.slice(0, 10) : new Date().toISOString().slice(0, 10),
        lines: [
          { account_id: payableAcc.id, debit_amount: totalAmount, credit_amount: 0, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
          { account_id: payAccountId, debit_amount: 0, credit_amount: totalAmount, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
        ],
      });

      syncedSalaryCount++;
    }
  }

  // Tự động kích hoạt chuyển sang chế độ PROFESSIONAL
  await adminClient
    .from('tenants')
    .update({ accounting_mode: 'PROFESSIONAL' })
    .eq('id', tenantId);

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: tenantId,
    new_data: {
      accounting_mode: 'PROFESSIONAL',
      synced_revenue: syncedRevenueCount,
      synced_expense: syncedExpenseCount,
      synced_salary: syncedSalaryCount,
    },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  return {
    success: true,
    syncedRevenueCount,
    syncedExpenseCount,
    syncedSalaryCount,
  };
}
