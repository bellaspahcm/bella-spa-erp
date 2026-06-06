'use server';

import { AI_SALARY_RECON_THRESHOLDS } from '@/config/ai-constants';
import { createClient } from '@/lib/supabase-server';
import { createAccountingDataClient } from './accounting/client';
import { getCurrentUser } from './user-actions';

export interface SalaryReconRow {
  ktv_id: string;
  ktv_name: string;
  legacy_total: number;
  ai_total: number;
  diff_amount: number;
  diff_percent: number | null;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'NO_LEGACY';
  legacy_status: string;
  has_legacy_record: boolean;
}

export interface SalaryReconSummary {
  rows: SalaryReconRow[];
  totalKtv: number;
  matchCount: number;
  minorCount: number;
  majorCount: number;
  noLegacyCount: number;
  /** Tong chenh lech tuyet doi (VND) */
  totalDiffAbs: number;
  thresholds: typeof AI_SALARY_RECON_THRESHOLDS;
}

type SalaryReconReportRow = {
  ktv_id: string;
  ktv_name: string;
  legacy_total: number;
  ai_total: number;
  diff_total: number;
  diff_percent: number | null;
  status: string;
  legacy_status: string;
};

type SalaryReconciliationReportRpcClient = {
  rpc: (
    fn: 'get_salary_reconciliation_report',
    args: { p_tenant_id: string; p_month_year: string },
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const allowedSalaryReconRoles = ['admin', 'super_admin', 'accountant', 'hr'];

function isSalaryReconStatus(value: string): value is SalaryReconRow['status'] {
  return value === 'MATCH' || value === 'MINOR_DIFF' || value === 'MAJOR_DIFF' || value === 'NO_LEGACY';
}

function summarizeSalaryRows(rows: SalaryReconRow[]): SalaryReconSummary {
  return {
    rows,
    totalKtv: rows.length,
    matchCount: rows.filter((row) => row.status === 'MATCH').length,
    minorCount: rows.filter((row) => row.status === 'MINOR_DIFF').length,
    majorCount: rows.filter((row) => row.status === 'MAJOR_DIFF').length,
    noLegacyCount: rows.filter((row) => row.status === 'NO_LEGACY').length,
    totalDiffAbs: rows
      .filter((row) => row.has_legacy_record && row.status !== 'NO_LEGACY')
      .reduce((sum, row) => sum + Math.abs(row.diff_amount ?? 0), 0),
    thresholds: AI_SALARY_RECON_THRESHOLDS,
  };
}

function mapReportRowsToSummary(rows: SalaryReconReportRow[]): SalaryReconSummary {
  const mappedRows = rows.map((row): SalaryReconRow => {
    const hasLegacyRecord = row.status !== 'PENDING_LEGACY' && row.legacy_status !== 'missing';
    const normalizedStatus = row.status === 'PENDING_LEGACY' ? 'NO_LEGACY' : row.status;

    return {
      ktv_id: row.ktv_id,
      ktv_name: row.ktv_name,
      legacy_total: row.legacy_total,
      ai_total: row.ai_total,
      diff_amount: row.ai_total - row.legacy_total,
      diff_percent: hasLegacyRecord ? row.diff_percent : null,
      status: isSalaryReconStatus(normalizedStatus) ? normalizedStatus : 'MAJOR_DIFF',
      legacy_status: row.legacy_status,
      has_legacy_record: hasLegacyRecord,
    };
  });

  return summarizeSalaryRows(mappedRows);
}

export async function getSalaryReconciliation(
  monthYear: string,
): Promise<{ data: SalaryReconSummary | null; error: string | null }> {
  const currentUser = await getCurrentUser();
  if (
    !currentUser?.tenant_id ||
    !allowedSalaryReconRoles.includes(currentUser.role || '')
  ) {
    return { data: null, error: 'Yeu cau dang nhap.' };
  }

  const supabase = await createClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (!authError && authUser) {
    const { data: rows, error: rpcError } = await supabase.rpc(
      'get_salary_reconciliation',
      { p_month_year: monthYear },
    );

    if (rpcError) {
      console.error('[SalaryRecon] RPC error:', { message: rpcError.message, code: rpcError.code });
      return { data: null, error: rpcError.message };
    }

    return {
      data: summarizeSalaryRows((rows ?? []) as unknown as SalaryReconRow[]),
      error: null,
    };
  }

  const dataClient = await createAccountingDataClient();
  const { data: reportRows, error: reportError } = await (dataClient as unknown as SalaryReconciliationReportRpcClient)
    .rpc('get_salary_reconciliation_report', {
      p_tenant_id: currentUser.tenant_id,
      p_month_year: monthYear,
    });

  if (reportError) {
    console.error('[SalaryRecon] Service-role RPC error:', {
      message: reportError.message,
      code: reportError.code,
    });
    return { data: null, error: reportError.message };
  }

  return {
    data: mapReportRowsToSummary((reportRows ?? []) as unknown as SalaryReconReportRow[]),
    error: null,
  };
}
