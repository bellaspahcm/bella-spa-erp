/**
 * Finance OS Kernel — Shared Types
 *
 * Defines the foundational types for ledger transactions, money representation,
 * currency conversions, periods, and accounting dimensions.
 *
 * @module platform/finance/shared-kernel/types
 */

export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'SGD' | string;

/**
 * Money represents a monetary value with a currency.
 * Amount is stored as a string representation of the minor unit (cents/đồng)
 * to avoid floating-point errors.
 */
export interface Money {
  amount_minor: string;
  currency: CurrencyCode;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface FinancialAccount {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  currency: CurrencyCode;
  is_active: boolean;
}

export interface ExchangeRate {
  rate: string; // Decimal string representing conversion multiplier (e.g. "24500.000000")
  source_currency: CurrencyCode;
  target_currency: CurrencyCode;
  effective_at: Date;
}

export interface FinancialDimensions {
  cost_center_id?: string;
  business_unit_id?: string;
  location_id?: string; // branch ID
  project_id?: string;
  department_id?: string;
  custom_dimension_type?: string;
  custom_dimension_id?: string;
}

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface AccountingPeriod {
  id: string;
  tenant_id: string;
  name: string; // e.g. "2026-08"
  period_start: Date;
  period_end: Date;
  status: PeriodStatus;
  closed_by?: string;
  closed_at?: Date;
  locked_by?: string;
  locked_at?: Date;
}

export type TransactionStatus = 'DRAFT' | 'POSTED' | 'REVERSED' | 'VOIDED';
export type TransactionType = 'ACCRUAL' | 'CASH' | 'ADJUSTMENT' | 'REVERSAL' | 'OPENING_BALANCE';

export interface FinancialTransactionLine {
  id: string;
  tenant_id: string;
  transaction_id: string;
  account_id: string;
  debit: Money;
  credit: Money;
  debit_functional: Money;
  credit_functional: Money;
  dimensions?: FinancialDimensions;
  memo: string;
}

export interface FinancialTransaction {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  source_type: string;
  source_id: string;
  status: TransactionStatus;
  transaction_type: TransactionType;
  accounting_period_id: string;
  posted_at: Date | null;
  transaction_currency: CurrencyCode;
  functional_currency: CurrencyCode;
  exchange_rate: ExchangeRate;
  description: string;
  reference_type: string;
  reference_id: string;
  reversal_of?: string | null;
  lines: FinancialTransactionLine[];
}

export interface OutboxEvent {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  payload: string; // JSON string
  status: 'PENDING' | 'DISPATCHED' | 'FAILED';
  retry_count: number;
  error?: string;
  created_at: Date;
}

// ============================================================================
// Finance Core Response Types (decoulped but structured like platform standard)
// ============================================================================

export interface FinanceEngineError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface FinanceEngineResponseMetadata {
  requestId?: string;
  engineVersion?: string;
  executionTimeMs?: number;
}

export interface FinanceEngineResponse<T> {
  success: boolean;
  data?: T;
  error?: FinanceEngineError;
  metadata?: FinanceEngineResponseMetadata;
}

