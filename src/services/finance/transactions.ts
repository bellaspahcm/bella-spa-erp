'use server';

import { getFinancialOverview as getFinancialOverviewAction } from './transaction-overview';
import {
  confirmTransaction as confirmTransactionAction,
  recordTransaction as recordTransactionAction,
} from './transaction-mutations';

export async function getFinancialOverview() {
  return getFinancialOverviewAction();
}

export async function confirmTransaction(id: string, type: 'revenue' | 'expense') {
  return confirmTransactionAction(id, type);
}

export async function recordTransaction(data: Parameters<typeof recordTransactionAction>[0]) {
  return recordTransactionAction(data);
}
