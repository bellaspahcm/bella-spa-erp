/**
 * React hooks for Bella Auto transaction management
 */

import { useState, useEffect, useCallback } from 'react';

export interface Transaction {
  id: string;
  transactionType: string;
  status: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  createdBy?: string;
  rollbackReason?: string;
  rolledBackAt?: string;
  rolledBackBy?: string;
  stepCount: number;
}

export interface TransactionDetail extends Transaction {
  metadata: unknown;
  steps: TransactionStep[];
}

export interface TransactionStep {
  id: string;
  stepOrder: number;
  actionType: string;
  targetTable: string;
  targetRecordId: string;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  status: string;
  executedAt: string;
  errorMessage?: string;
}

export interface TransactionFilters {
  entityType?: string;
  entityId?: string;
  status?: string;
  type?: string;
  limit?: number;
}

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.entityType) params.set('entity_type', filters.entityType);
      if (filters?.entityId) params.set('entity_id', filters.entityId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.limit) params.set('limit', filters.limit.toString());

      const response = await fetch(`/api/bella-auto/transactions?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]); // ✅ Fixed: Use entire filters object instead of individual properties

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, isLoading, error, refetch: fetchTransactions };
}

export function useTransactionDetail(transactionId: string | null) {
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!transactionId) {
      setTransaction(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bella-auto/transactions/${transactionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transaction detail');
      }

      const data = await response.json();
      setTransaction(data.transaction);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTransaction(null);
    } finally {
      setIsLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return { transaction, isLoading, error, refetch: fetchDetail };
}

export function useRollbackTransaction() {
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rollback = useCallback(async (
    transactionId: string,
    reason: string,
    userId: string,
    userEmail: string
  ) => {
    setIsRollingBack(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/bella-auto/transactions/${transactionId}/rollback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, userId, userEmail }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Rollback failed');
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsRollingBack(false);
    }
  }, []);

  return { rollback, isRollingBack, error };
}
