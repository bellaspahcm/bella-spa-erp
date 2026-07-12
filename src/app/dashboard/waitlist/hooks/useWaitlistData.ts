import { useState, useEffect, useCallback } from 'react';
import type { WaitlistEntry, WaitlistStatus } from '@/types/waitlist';

interface UseWaitlistDataParams {
  tenantId: string;
  packageId?: string;
  preferredDate?: string;
  status?: WaitlistStatus;
  search?: string;
  page?: number;
  limit?: number;
}

interface UseWaitlistDataReturn {
  entries: WaitlistEntry[];
  total: number;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  fetchWaitlist: () => Promise<void>;
}

export function useWaitlistData(params: UseWaitlistDataParams): UseWaitlistDataReturn {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWaitlist = useCallback(async () => {
    if (!params.tenantId) {
      setError('Không tìm thấy thông tin chi nhánh');
      setIsLoading(false);
      return;
    }

    const loadingFlag = entries.length === 0 ? setIsLoading : setIsSyncing;
    loadingFlag(true);
    setError(null);

    try {
      // Build query params
      const queryParams = new URLSearchParams({
        tenant_id: params.tenantId,
      });

      if (params.packageId) queryParams.set('package_id', params.packageId);
      if (params.preferredDate) queryParams.set('preferred_date', params.preferredDate);
      if (params.status) queryParams.set('status', params.status);
      if (params.search) queryParams.set('search', params.search);
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.limit) queryParams.set('limit', params.limit.toString());

      // Fetch from API
      const response = await fetch(`/api/waitlist?${queryParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể tải danh sách chờ');
      }

      const data = await response.json();

      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching waitlist:', err);
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setEntries([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [
    params.tenantId,
    params.packageId,
    params.preferredDate,
    params.status,
    params.search,
    params.page,
    params.limit,
    entries.length,
  ]);

  // Initial fetch
  useEffect(() => {
    void fetchWaitlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.tenantId,
    params.packageId,
    params.preferredDate,
    params.status,
    params.search,
    params.page,
    params.limit,
  ]);

  return {
    entries,
    total,
    isLoading,
    isSyncing,
    error,
    fetchWaitlist,
  };
}
