/**
 * Finance OS Kernel — Shared Validators & Math Utilities
 *
 * Implements strict double-entry balance validation, currency math using string-minor
 * unit representation to avoid floating-point math issues.
 *
 * @module platform/finance/shared-kernel/validators
 */

import { FinancialTransactionLine } from './types';

/**
 * Checks if a string represents a valid integer (including positive, negative, and zero).
 */
export function isValidIntegerString(val: string): boolean {
  return /^-?\d+$/.test(val);
}

/**
 * Sums an array of minor unit string amounts safely using BigInt.
 */
export function sumMinorAmounts(amounts: string[]): string {
  let sum = BigInt(0);
  for (const amt of amounts) {
    if (!isValidIntegerString(amt)) {
      throw new Error(`INVALID_MINOR_UNIT_STRING: "${amt}" is not a valid integer string`);
    }
    sum += BigInt(amt);
  }
  return sum.toString();
}

/**
 * Compares two minor unit string amounts safely.
 * Returns -1 if a < b, 1 if a > b, and 0 if a === b.
 */
export function compareMinorAmounts(a: string, b: string): number {
  if (!isValidIntegerString(a) || !isValidIntegerString(b)) {
    throw new Error(`INVALID_MINOR_UNIT_STRING: Comparison requires valid integer strings`);
  }
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

/**
 * Validates that all lines of a financial transaction balance under double-entry rules.
 *
 * Invariant: Σ line.debit_functional.amount_minor === Σ line.credit_functional.amount_minor
 */
export function validateDoubleEntryBalance(lines: FinancialTransactionLine[]): boolean {
  if (lines.length === 0) return false;

  const debitFunctionalAmounts = lines.map(l => l.debit_functional.amount_minor);
  const creditFunctionalAmounts = lines.map(l => l.credit_functional.amount_minor);

  // Assert all lines are valid integers
  for (const line of lines) {
    if (BigInt(line.debit.amount_minor) < 0 || BigInt(line.credit.amount_minor) < 0) {
      return false; // Invariant F-I-6: debit_amount >= 0, credit_amount >= 0
    }
    if (BigInt(line.debit.amount_minor) > 0 && BigInt(line.credit.amount_minor) > 0) {
      return false; // Invariant F-I-6: NOT (debit > 0 AND credit > 0)
    }
  }

  const totalDebit = sumMinorAmounts(debitFunctionalAmounts);
  const totalCredit = sumMinorAmounts(creditFunctionalAmounts);

  return compareMinorAmounts(totalDebit, totalCredit) === 0;
}
