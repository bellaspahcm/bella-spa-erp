/**
 * Finance OS Kernel — Shared Constants
 *
 * Defines core currencies, account types, and other semantic constants.
 *
 * @module platform/finance/shared-kernel/constants
 */

import { CurrencyCode, AccountType, NormalBalance, TransactionStatus, TransactionType, PeriodStatus } from './types';

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['VND', 'USD', 'EUR', 'SGD'];

export const ACCOUNT_TYPES: { [key in AccountType]: AccountType } = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
};

export const NORMAL_BALANCES: { [key in NormalBalance]: NormalBalance } = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

export const TRANSACTION_STATUSES: { [key in TransactionStatus]: TransactionStatus } = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  VOIDED: 'VOIDED',
};

export const TRANSACTION_TYPES: { [key in TransactionType]: TransactionType } = {
  ACCRUAL: 'ACCRUAL',
  CASH: 'CASH',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
  OPENING_BALANCE: 'OPENING_BALANCE',
};

export const PERIOD_STATUSES: { [key in PeriodStatus]: PeriodStatus } = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
};
