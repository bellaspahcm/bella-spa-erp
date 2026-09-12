/**
 * Finance OS Platform SDK
 *
 * Exports all shared-kernel types, public contracts, and engine services
 * for Bella Finance OS.
 *
 * @module platform/finance
 */

export * from './shared-kernel/types';
export * from './shared-kernel/constants';
export * from './shared-kernel/validators';
export * from './contracts';
export * from './engines/ledger-engine';
export * from './engines/cash-engine';

// F3 Accounts Receivable (E0.1B-R Remediation)
export {
  IF3AccountsReceivable,
  createF3AREngine
} from './engines/f3-ar-engine';

export type {
  CreateInvoiceInput,
  AddInvoiceLineInput,
  FinalizeInvoiceInput,
  VoidInvoiceInput,
  GetInvoiceInput,
  InvoiceResult,
  InvoiceView,
  InvoiceHeader,
  InvoiceLine,
  ReceivablePosition,
  InvoiceStatus
} from './contracts/f3-ar.contract';

export {
  F3InvoiceNotFoundError,
  F3InvoiceNotDraftError,
  F3InvoiceNotFinalizedError,
  F3InvoiceNumberDuplicateError,
  F3InvoiceEmptyError,
  F3ZeroValueInvoiceError,
  F3InvalidRevenueAccountError,
  F3InvoiceHasAllocationsError,
  F3InvalidInputError,
  F3PostingFailedError
} from './contracts/f3-ar.contract';
