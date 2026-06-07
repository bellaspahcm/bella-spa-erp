'use server';

import { AI_SALARY_RECON_THRESHOLDS } from '@/config/ai-constants';
import {
  hasSalaryLegacyReconciliationRecord,
  resolveSalaryReconciliationStatus,
  type SalaryReconciliationStatus,
} from '@/lib/business-rules/salary';
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
  status: SalaryReconciliationStatus;
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
  diff_total: number | null;
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

function asNumber(value: number | null | undefined) {
  return Number(value ?? 0);
}

function normalizeSalaryReconRow(row: SalaryReconRow): SalaryReconRow {
  const hasLegacyRecord = hasSalaryLegacyReconciliationRecord({
    status: row.status,
    legacyStatus: row.legacy_status,
    hasLegacyRecord: row.has_legacy_record,
  });
  const diffAmount = hasLegacyRecord
    ? asNumber(row.diff_amount ?? (row.ai_total - row.legacy_total))
    : 0;
  const status = resolveSalaryReconciliationStatus({
    status: row.status,
    legacyStatus: row.legacy_status,
    hasLegacyRecord,
    legacyTotal: row.legacy_total,
    aiTotal: row.ai_total,
    diffAmount,
    diffPercent: row.diff_percent,
    thresholds: AI_SALARY_RECON_THRESHOLDS,
  });

  return {
    ...row,
    diff_amount: diffAmount,
    diff_percent: hasLegacyRecord ? row.diff_percent : null,
    status,
    has_legacy_record: hasLegacyRecord,
  };
}

function summarizeSalaryRows(rows: SalaryReconRow[]): SalaryReconSummary {
  const normalizedRows = rows.map(normalizeSalaryReconRow);

  return {
    rows: normalizedRows,
    totalKtv: normalizedRows.length,
    matchCount: normalizedRows.filter((row) => row.status === 'MATCH').length,
    minorCount: normalizedRows.filter((row) => row.status === 'MINOR_DIFF').length,
    majorCount: normalizedRows.filter((row) => row.status === 'MAJOR_DIFF').length,
    noLegacyCount: normalizedRows.filter((row) => row.status === 'NO_LEGACY').length,
    totalDiffAbs: normalizedRows
      .filter((row) => row.has_legacy_record && row.status !== 'NO_LEGACY')
      .reduce((sum, row) => sum + Math.abs(row.diff_amount ?? 0), 0),
    thresholds: AI_SALARY_RECON_THRESHOLDS,
  };
}

function mapReportRowsToSummary(rows: SalaryReconReportRow[]): SalaryReconSummary {
  const mappedRows = rows.map((row): SalaryReconRow => {
    const hasLegacyRecord = hasSalaryLegacyReconciliationRecord({
      status: row.status,
      legacyStatus: row.legacy_status,
    });

    return {
      ktv_id: row.ktv_id,
      ktv_name: row.ktv_name,
      legacy_total: row.legacy_total,
      ai_total: row.ai_total,
      diff_amount: hasLegacyRecord ? row.ai_total - row.legacy_total : 0,
      diff_percent: hasLegacyRecord ? row.diff_percent : null,
      status: resolveSalaryReconciliationStatus({
        status: row.status,
        legacyStatus: row.legacy_status,
        hasLegacyRecord,
        legacyTotal: row.legacy_total,
        aiTotal: row.ai_total,
        diffAmount: row.ai_total - row.legacy_total,
        diffPercent: row.diff_percent,
        thresholds: AI_SALARY_RECON_THRESHOLDS,
      }),
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
