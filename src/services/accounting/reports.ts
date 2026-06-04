'use server';

import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '../user-actions';
import { createAccountingDataClient } from './client';
import type { ReconciliationRow, SalaryReconciliationRow } from './types';

type SalaryReconciliationRpcArgs = {
  p_tenant_id: string;
  p_month_year: string;
};

type ReportRpcError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type SalaryReconciliationRpc = (
  fn: 'get_salary_reconciliation_report',
  args: SalaryReconciliationRpcArgs
) => Promise<{ data: unknown; error: ReportRpcError | null }>;

type SalaryReconciliationRpcClient = {
  rpc: SalaryReconciliationRpc;
};

function callSalaryReconciliationReportRpc(client: unknown, args: SalaryReconciliationRpcArgs) {
  return (client as SalaryReconciliationRpcClient).rpc('get_salary_reconciliation_report', args);
}

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

export async function getReconciliationReport(fromDate: string, toDate: string): Promise<ReconciliationRow[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin hoặc kế toán của chi nhánh mới được xem báo cáo đối soát chéo.');
  }

  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  // Fallback sang user client nếu hoàn toàn không có serviceKey (ví dụ: trên Vercel chưa cấu hình)
  if (!serviceKey) {
    console.warn('[getReconciliationReport] SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY is missing. Using user client fallback.');
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

export async function getSalaryReconciliationReport(monthYear: string): Promise<SalaryReconciliationRow[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được xem báo cáo đối soát lương.');
  }

  // The RPC sets tenant context internally when called via service-role.
  // Jest keeps using the mocked user client via createAccountingDataClient().
  const supabase = await createAccountingDataClient();
  const { data, error } = await callSalaryReconciliationReportRpc(supabase, {
    p_tenant_id: user.tenant_id,
    p_month_year: monthYear,
  });

  if (error) {
    console.error('[getSalaryReconciliationReport] RPC error:', JSON.stringify({
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    }, null, 2));
    throw error; // Zero Silent Database Failures
  }
  return (data as unknown as SalaryReconciliationRow[]) || [];
}
