/**
 * Finance OS Kernel — F1 Ledger Engine Contract
 *
 * Defines the public contract interface, DTOs, and signatures for posting transactions,
 * reversals, voiding, balance retrieval, and period closing workflows.
 *
 * @module platform/finance/contracts/ledger-engine
 */

import { 
  FinancialTransaction, 
  AccountingPeriod, 
  Money, 
  CurrencyCode, 
  FinancialDimensions, 
  TransactionType,
  FinanceEngineResponse 
} from '../shared-kernel/types';

export interface PostTransactionRequest {
  tenant_id: string;
  idempotency_key: string;
  source_type: string;
  source_id: string;
  transaction_type: TransactionType;
  posted_at: Date;
  transaction_currency: CurrencyCode;
  functional_currency: CurrencyCode;
  description: string;
  reference_type: string;
  reference_id: string;
  lines: Array<{
    account_code: string; // lookup via code per tenant
    debit_amount_minor: string;
    credit_amount_minor: string;
    dimensions?: FinancialDimensions;
    memo: string;
  }>;
}

export interface ReversalRequest {
  tenant_id: string;
  transaction_id: string;
  reason: string;
  idempotency_key: string; // mandated for safe retries
}

export interface OpenPeriodRequest {
  tenant_id: string;
  name: string; // e.g. "2026-08"
  period_start: Date;
  period_end: Date;
}

export interface BalanceResult {
  account_id: string;
  account_code: string;
  tenant_id: string;
  currency: CurrencyCode;
  total_debit: Money;
  total_credit: Money;
  balance: Money; // normal balance factored in
}

export interface TrialBalanceLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: Money;
  credit: Money;
}

export interface TrialBalance {
  tenant_id: string;
  as_of: Date;
  lines: TrialBalanceLine[];
  total_debit: Money;
  total_credit: Money;
  is_balanced: boolean;
}

export interface ILedgerEngine {
  readonly engineName: string;
  readonly engineVersion: string;

  postTransaction(req: PostTransactionRequest): Promise<FinanceEngineResponse<FinancialTransaction>>;
  voidTransaction(tenantId: string, transactionId: string, reason: string): Promise<FinanceEngineResponse<void>>;
  reverseTransaction(req: ReversalRequest): Promise<FinanceEngineResponse<FinancialTransaction>>;
  getBalance(tenantId: string, accountId: string, asOf?: Date): Promise<FinanceEngineResponse<BalanceResult>>;
  getTrialBalance(tenantId: string, asOf: Date): Promise<FinanceEngineResponse<TrialBalance>>;
  openPeriod(req: OpenPeriodRequest): Promise<FinanceEngineResponse<AccountingPeriod>>;
  closePeriod(tenantId: string, periodId: string, userId: string): Promise<FinanceEngineResponse<void>>;
  lockPeriod(tenantId: string, periodId: string, userId: string): Promise<FinanceEngineResponse<void>>;
}
