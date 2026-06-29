'use client';

/**
 * Service Items Hook
 * 
 * Manages service items data fetching for booking detail modal.
 * Part of Commission System (Task 13)
 */

import { useCallback, useState } from 'react';
import { queryBookingServiceItemsWithKTV } from '@/lib/supabase-commission-queries';
import { createClient } from '@/lib/supabase-client';
import type { ServiceItemData } from '@/components/bookings/ServiceItemsTable';

export function useServiceItems() {
  const [serviceItems, setServiceItems] = useState<ServiceItemData[]>([]);
  const [isLoadingServiceItems, setIsLoadingServiceItems] = useState(false);
  const [serviceItemsError, setServiceItemsError] = useState<string | null>(null);

  const fetchServiceItems = useCallback(async (bookingId: string, tenantId: string) => {
    setIsLoadingServiceItems(true);
    setServiceItemsError(null);

    try {
      const supabase = createClient();
      const { data, error } = await queryBookingServiceItemsWithKTV(
        supabase,
        bookingId,
        tenantId
      );

      if (error) {
        console.error('[useServiceItems] Error fetching service items:', error);
        setServiceItemsError(error.message);
        setServiceItems([]);
        return;
      }

      // Transform data to match ServiceItemData interface
      const transformedData: ServiceItemData[] = (data || []).map((item) => ({
        id: item.id,
        service_name: item.service_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        override_commission_type: item.override_commission_type,
        override_commission_value: item.override_commission_value,
        calculated_commission: item.calculated_commission,
        status: item.status,
        completed_date: item.completed_date,
        ktv_name: item.ktv_name,
      }));

      setServiceItems(transformedData);
    } catch (error) {
      console.error('[useServiceItems] Unexpected error:', error);
      setServiceItemsError('Không thể tải dịch vụ bổ sung');
      setServiceItems([]);
    } finally {
      setIsLoadingServiceItems(false);
    }
  }, []);

  const clearServiceItems = useCallback(() => {
    setServiceItems([]);
    setServiceItemsError(null);
  }, []);

  return {
    serviceItems,
    isLoadingServiceItems,
    serviceItemsError,
    fetchServiceItems,
    clearServiceItems,
  };
}
