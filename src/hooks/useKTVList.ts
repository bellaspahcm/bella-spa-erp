'use client';

/**
 * KTV List Hook
 * 
 * Fetches list of KTV staff for dropdowns in commission-related forms.
 * Part of Commission System (Task 17)
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

export interface KTVOption {
  id: string;
  full_name: string;
  email: string;
}

export function useKTVList(tenantId?: string) {
  const [ktvList, setKtvList] = useState<KTVOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKTVList = useCallback(async (tenant: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { data, error: queryError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('tenant_id', tenant)
        .eq('role', 'ktv')
        .eq('status', 'active') // Only active KTVs
        .order('full_name', { ascending: true });

      if (queryError) {
        console.error('[useKTVList] Query error:', queryError);
        setError(queryError.message);
        setKtvList([]);
        return;
      }

      // Filter out users with null/empty email (deleted accounts)
      const validKtvs = (data || []).filter(ktv => 
        ktv.email && 
        ktv.email.trim() !== '' &&
        !ktv.email.includes('deleted_') &&     // Pattern: deleted_xxx@system
        !ktv.email.includes('.deleted.')       // Pattern: xxx.deleted.yyy@domain
      );

      setKtvList(validKtvs);
    } catch (err: unknown) {
      console.error('[useKTVList] Unexpected error:', err);
      setError('Không thể tải danh sách KTV');
      setKtvList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (tenantId) {
      fetchKTVList(tenantId);
    }
  }, [tenantId, fetchKTVList]);

  useEffect(() => {
    if (tenantId) {
      fetchKTVList(tenantId);
    }
  }, [tenantId, fetchKTVList]);

  return {
    ktvList,
    isLoading,
    error,
    refetch,
  };
}
