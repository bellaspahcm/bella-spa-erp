/**
 * Supabase Commission System Query Helpers
 * 
 * Type-safe query helpers for commission system tables until database types are regenerated.
 * These functions provide proper TypeScript typing without using `any`.
 * 
 * TODO: Remove this file after regenerating database types from Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  BookingServiceItem,
  TenantWithCommissionConfig,
  CommissionConfig,
} from '@/types/commission-types';

/**
 * Query booking service items for a specific booking
 */
export async function queryBookingServiceItems(
  supabase: SupabaseClient,
  bookingId: string,
  tenantId: string
): Promise<{ data: BookingServiceItem[] | null; error: Error | null }> {
  try {
    // Type assertion for new table not yet in generated types
    const result = await (supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              order: (column: string, options?: { ascending?: boolean }) => Promise<{
                data: BookingServiceItem[] | null;
                error: Error | null;
              }>;
            };
          };
        };
      };
    })
      .from('booking_service_items')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    return result;
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Insert a new booking service item
 */
export async function insertBookingServiceItem(
  supabase: SupabaseClient,
  item: Omit<BookingServiceItem, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: BookingServiceItem | null; error: Error | null }> {
  try {
    const result = await (supabase as unknown as {
      from: (table: string) => {
        insert: (data: unknown) => {
          select: () => {
            single: () => Promise<{
              data: BookingServiceItem | null;
              error: Error | null;
            }>;
          };
        };
      };
    })
      .from('booking_service_items')
      .insert(item)
      .select()
      .single();

    return result;
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Update a booking service item
 */
export async function updateBookingServiceItem(
  supabase: SupabaseClient,
  id: string,
  tenantId: string,
  updates: Partial<BookingServiceItem>
): Promise<{ data: BookingServiceItem | null; error: Error | null }> {
  try {
    const result = await (supabase as unknown as {
      from: (table: string) => {
        update: (data: unknown) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              select: () => {
                single: () => Promise<{
                  data: BookingServiceItem | null;
                  error: Error | null;
                }>;
              };
            };
          };
        };
      };
    })
      .from('booking_service_items')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    return result;
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get a single booking service item by ID
 */
export async function getBookingServiceItem(
  supabase: SupabaseClient,
  id: string,
  tenantId: string
): Promise<{ data: BookingServiceItem | null; error: Error | null }> {
  try {
    const result = await (supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              single: () => Promise<{
                data: BookingServiceItem | null;
                error: Error | null;
              }>;
            };
          };
        };
      };
    })
      .from('booking_service_items')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    return result;
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Query booking service items with KTV name join for display
 * Used in booking detail modal
 */
export async function queryBookingServiceItemsWithKTV(
  supabase: SupabaseClient,
  bookingId: string,
  tenantId: string
): Promise<{ 
  data: Array<BookingServiceItem & { ktv_name?: string | null }> | null; 
  error: Error | null;
}> {
  try {
    // Query with LEFT JOIN to users table for KTV name
    const result = await (supabase as any)
      .from('booking_service_items')
      .select(`
        *,
        ktv:ktv_id (
          full_name
        )
      `)
      .eq('booking_id', bookingId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (result.error) {
      return { data: null, error: result.error };
    }

    // Transform data to flatten KTV name
    const transformedData = result.data?.map((item: any) => ({
      ...item,
      ktv_name: item.ktv?.full_name || null,
      ktv: undefined, // Remove nested object
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Query tenant commission config
 */
export async function queryTenantCommissionConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ data: CommissionConfig | null; error: Error | null }> {
  try {
    const result = await supabase
      .from('tenants')
      .select('commission_config')
      .eq('id', tenantId)
      .single();

    if (result.error) {
      return { data: null, error: result.error as unknown as Error };
    }

    // Type assertion for new column not yet in generated types
    const config = (result.data as unknown as { commission_config: CommissionConfig | null })
      ?.commission_config;

    return { data: config || null, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
