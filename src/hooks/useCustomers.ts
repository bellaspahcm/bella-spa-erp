'use client';

/**
 * Customers List Hook
 * 
 * Fetches list of customers for dropdowns in sales-related forms.
 * Part of Commission System (Task 17)
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

export interface CustomerOption {
  id: string;
  name_mother: string;
  name_baby?: string | null;
  phone: string;
}

export function useCustomers(tenantId?: string) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async (tenant: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { data, error: queryError } = await supabase
        .from('customers')
        .select('id, name_mother, name_baby, phone')
        .eq('tenant_id', tenant)
        .order('name_mother', { ascending: true })
        .limit(500); // Reasonable limit for dropdown

      if (queryError) {
        console.error('[useCustomers] Query error:', queryError);
        setError(queryError.message);
        setCustomers([]);
        return;
      }

      setCustomers(data || []);
    } catch (err: unknown) {
      console.error('[useCustomers] Unexpected error:', err);
      setError('Không thể tải danh sách khách hàng');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (tenantId) {
      fetchCustomers(tenantId);
    }
  }, [tenantId, fetchCustomers]);

  useEffect(() => {
    if (tenantId) {
      fetchCustomers(tenantId);
    }
  }, [tenantId, fetchCustomers]);

  return {
    customers,
    isLoading,
    error,
    refetch,
  };
}
