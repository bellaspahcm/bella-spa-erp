// Shared accounting domain types. Plain module (no 'use server') so it can be
// imported by both server-action sub-modules and client components.

export interface CreateAccountInput {
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parent_id?: string | null;
}

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

export interface ReconciliationRow {
  category: string;
  category_label: string;
  legacy_amount: number;
  ledger_amount: number;
  diff_amount: number;
  diff_percent: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF';
}

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
