'use server';

import { createClient } from '@/lib/supabase-server';
import { AI_SALARY_RECON_THRESHOLDS } from '@/config/ai-constants';

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
  /** Tổng chênh lệch tuyệt đối (VND) */
  totalDiffAbs: number;
  thresholds: typeof AI_SALARY_RECON_THRESHOLDS;
}

export async function getSalaryReconciliation(
  monthYear: string // 'YYYY-MM-DD'
): Promise<{ data: SalaryReconSummary | null; error: string | null }> {
  const supabase = await createClient();

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser) {
    return { data: null, error: 'Yêu cầu đăng nhập.' };
  }

  const { data: rows, error: rpcError } = await supabase.rpc(
    'get_salary_reconciliation',
    { p_month_year: monthYear }
  );

  if (rpcError) {
    console.error('[SalaryRecon] RPC error:', { message: rpcError.message, code: rpcError.code });
    return { data: null, error: rpcError.message };
  }

  const typedRows = (rows ?? []) as unknown as SalaryReconRow[];

  const summary: SalaryReconSummary = {
    rows: typedRows,
    totalKtv: typedRows.length,
    matchCount:    typedRows.filter(r => r.status === 'MATCH').length,
    minorCount:    typedRows.filter(r => r.status === 'MINOR_DIFF').length,
    majorCount:    typedRows.filter(r => r.status === 'MAJOR_DIFF').length,
    noLegacyCount: typedRows.filter(r => r.status === 'NO_LEGACY').length,
    totalDiffAbs:  typedRows.reduce((sum, r) => sum + Math.abs(r.diff_amount ?? 0), 0),
    thresholds: AI_SALARY_RECON_THRESHOLDS,
  };

  return { data: summary, error: null };
}
