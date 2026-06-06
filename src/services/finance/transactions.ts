'use server';

import { getFinancialOverview as getFinancialOverviewAction } from './transaction-overview';
import {
  confirmTransaction as confirmTransactionAction,
  recordTransaction as recordTransactionAction,
} from './transaction-mutations';

export type ConfirmTransactionResult =
  | { success: true }
  | { success: false; error: string };

export type RecordTransactionInput = Parameters<typeof recordTransactionAction>[0];
export type RecordTransactionResult =
  | { success: true }
  | { success: false; error: string };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : fallback;
  }
  return fallback;
}

export async function getFinancialOverview() {
  return getFinancialOverviewAction();
}

export async function confirmTransaction(
  id: string,
  type: 'revenue' | 'expense'
): Promise<ConfirmTransactionResult> {
  try {
    await confirmTransactionAction(id, type);
    return { success: true };
  } catch (error) {
    console.error('[confirmTransactionActionResult]', error);
    return {
      success: false,
      error: getErrorMessage(error, 'Không thể xác nhận giao dịch'),
    };
  }
}

export async function recordTransaction(data: RecordTransactionInput): Promise<RecordTransactionResult> {
  try {
    await recordTransactionAction(data);
    return { success: true };
  } catch (error) {
    console.error('[recordTransactionActionResult]', error);
    return {
      success: false,
      error: getErrorMessage(error, 'Không thể ghi nhận giao dịch'),
    };
  }
}
