/**
 * React hook for rollback audit dashboard
 */

import { useState, useEffect, useCallback } from 'react';

export interface AuditLog {
  id: string;
  transactionId: string;
  transactionType: string;
  entityType: string;
  entityId: string;
  status: string;
  reason: string;
  executedBy?: string;
  executedAt: string;
  stepsRolledBack: number;
  errorMessage?: string;
}

export interface AuditStats {
  totalRollbacks: number;
  successRate: number;
  failedCount: number;
  byTransactionType: Record<string, number>;
  recentActivity: Array<{
    id: string;
    transactionId: string;
    transactionType: string;
    status: string;
    reason: string;
    executedBy?: string;
    executedAt: string;
    stepsRolledBack: number;
    errorMessage?: string;
  }>;
}

export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export function useRollbackAudit(filters?: AuditFilters) {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('start_date', filters.startDate);
      if (filters?.endDate) params.set('end_date', filters.endDate);
      if (filters?.limit) params.set('limit', filters.limit.toString());

      const response = await fetch(`/api/bella-auto/rollback-audit?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setStats(data.stats);
      setLogs(data.logs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]); // ✅ Fixed: Use entire filters object instead of individual properties

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  return { stats, logs, isLoading, error, refetch: fetchAudit };
}
