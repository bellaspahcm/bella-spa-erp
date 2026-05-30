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

export type AccountingStandardProfile = 'TT133' | 'TT200';

export type BusinessEventType =
  | 'CUSTOMER_DEPOSIT'
  | 'CUSTOMER_REMAINING_PAYMENT'
  | 'CUSTOMER_FULL_PAYMENT'
  | 'SESSION_REVENUE_RECOGNIZED'
  | 'REFUND_TO_CUSTOMER'
  | 'EXPENSE_RENT'
  | 'EXPENSE_UTILITIES'
  | 'EXPENSE_MARKETING'
  | 'EXPENSE_MATERIALS'
  | 'EXPENSE_SALARY'
  | 'EXPENSE_OTHER'
  | 'INVENTORY_PURCHASE'
  | 'INVENTORY_CONSUMED'
  | 'SALARY_ACCRUAL'
  | 'SALARY_PAYMENT'
  | 'KTV_COMMISSION_ACCRUAL'
  | 'INTER_BRANCH_CLEARING'
  | 'FRANCHISE_ROYALTY';

export type AccountingReviewStatus =
  | 'AUTO_POSTED'
  | 'NEEDS_REVIEW'
  | 'APPROVED_FOR_POSTING'
  | 'REJECTED'
  | 'POSTING_FAILED';

export type AccountingReviewResolutionStatus = 'APPROVED_FOR_POSTING' | 'REJECTED';

export type AccountingSourceTable =
  | 'revenue'
  | 'expenses'
  | 'salary_records'
  | 'session_logs'
  | 'inventory_logs'
  | 'franchise_royalty_invoices'
  | 'inter_branch_clearing';

export interface AccountingTemplateLine {
  side: 'DEBIT' | 'CREDIT';
  account_code: string;
  amount_source: string;
  optional?: boolean;
}

export interface AccountingEventTemplate {
  id: string;
  tenant_id: string | null;
  standard_profile: AccountingStandardProfile;
  business_event_type: BusinessEventType;
  template_name: string;
  description: string | null;
  source_module: string;
  template_lines: AccountingTemplateLine[];
  required_fields: string[];
  auto_post_allowed: boolean;
  requires_review: boolean;
  is_system: boolean;
  is_active: boolean;
}

export interface AccountingReviewItem {
  id: string;
  tenant_id: string;
  business_event_type: BusinessEventType | null;
  source_table: AccountingSourceTable | string;
  source_id: string;
  status: AccountingReviewStatus;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason_code: string;
  message: string;
  missing_fields: string[];
  suggested_template_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountingReadinessRow {
  source_table: string;
  total_records: number;
  classified_records: number;
  missing_business_event: number;
  needs_review: number;
  posting_failed: number;
}

export interface AccountingReadinessSummary {
  rows: AccountingReadinessRow[];
  total_records: number;
  classified_records: number;
  missing_business_event: number;
  needs_review: number;
  posting_failed: number;
  readiness_score: number;
  can_enable_professional: boolean;
}

export interface AccountingBackfillResult {
  source_table: string;
  scanned_records: number;
  classified_records: number;
  review_created: number;
}
