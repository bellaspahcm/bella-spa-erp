/**
 * Finance OS F2.3 — Cash Reporting API Contracts
 *
 * Defines the public interfaces, data structures, and query parameters
 * for reporting and analyzing cash positions, movements, and runway.
 *
 * Compliance:
 * - TypeSafety-NoAny: Strictly typed with zero 'any' usages.
 *
 * @module platform/finance/contracts/cash-engine.contract
 */

import type { Money, FinanceEngineResponse } from '../shared-kernel/types';

export interface BankAccount {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  currency: string;
  linked_finance_account_id?: string;
  is_active: boolean;
}

export interface CashPosition {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  balance_minor: string;
  currency: string;
  functional_balance_minor: string;
  functional_currency: string;
  valuation_rate: string;
  valuation_as_of: Date;
  version: number;
}

export type CashMovementSourceType = 'F1_POSTING' | 'REVERSAL';

export interface CashMovement {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  idempotency_key: string;
  direction: 'INFLOW' | 'OUTFLOW';
  amount_minor: string;
  currency: string;
  functional_amount_minor: string;
  functional_currency: string;
  valuation_rate: string;
  f1_transaction_id: string;
  cash_leg_reference: string;
  source_type: CashMovementSourceType;
  source_id: string;
  description?: string;
  recorded_at: Date;
}

export interface CashQuarantineEvent {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  payload: unknown; // Compliant with TypeSafety-NoAny
  failure_reason: string;
  failure_code: string;
  status: 'PENDING' | 'RESOLVED';
  resolved_by?: string | null;
  resolved_at?: Date | null;
  created_at: Date;
}

export interface QueryMovementsRequest {
  tenant_id: string;
  bank_account_id?: string;
  direction?: 'INFLOW' | 'OUTFLOW';
  start_date?: Date;
  end_date?: Date;
  limit?: number; // Must be in [1, 200]
  offset?: number; // Must be >= 0
}

export interface CashRunway {
  runway_days: number | null;
  consolidated_cash: Money;
  status: 'CALCULATED' | 'NO_BURN_RATE' | 'ZERO_BURN' | 'UNAVAILABLE';
}

export interface ICashReportingEngine {
  readonly engineName: string;
  readonly engineVersion: string;

  // Bank Info (Read-only)
  getBankAccount(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<BankAccount>>;
  listBankAccounts(tenantId: string): Promise<FinanceEngineResponse<BankAccount[]>>;

  // Cash Position & Movements Queries
  getCashPosition(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<CashPosition>>;
  listCashPositions(tenantId: string): Promise<FinanceEngineResponse<CashPosition[]>>;
  getCashMovements(req: QueryMovementsRequest): Promise<FinanceEngineResponse<CashMovement[]>>;

  // Runway Analytics
  getConsolidatedRunway(tenantId: string): Promise<FinanceEngineResponse<CashRunway>>;

  // Quarantine Diagnostics
  getQuarantineEvents(tenantId: string, status?: 'PENDING' | 'RESOLVED'): Promise<FinanceEngineResponse<CashQuarantineEvent[]>>;
}

export interface ICashReconstructionEngine {
  /**
   * Reconstructs derived cash position records from immutable movement history.
   * Can be scoped to a single bank account or run for all accounts of a tenant.
   */
  reconstructCashPositions(
    tenantId: string,
    bankAccountId?: string
  ): Promise<FinanceEngineResponse<{ reconstructed_accounts_count: number }>>;
}
