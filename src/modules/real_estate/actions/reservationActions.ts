'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { revalidatePath } from 'next/cache';
import { Database } from '@/types/database.types';
import { ReservationService } from '@/platform/real-estate/engines/reservation.service';
import { PropertyUnitRepository } from '@/platform/real-estate/repositories/property-unit.repository';

type ReservationRow = Database['public']['Tables']['re_reservations']['Row'];

export interface CreateReservationDTO {
  product_id: string;
  customer_id: string;
  deposit_amount: number;
  notes?: string | null;
}

export interface ReservationActionResult {
  success: boolean;
  data?: ReservationRow;
  error?: string;
}

/**
 * Create a new reservation
 * Delegates to canonical ReservationService for Product lifecycle + Reservation creation
 * Maps to verified P5.2-P5.4 backend capability
 */
export async function createReservationAction(dto: CreateReservationDTO): Promise<ReservationActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate required fields
    if (!dto.product_id) {
      return { success: false, error: 'Product is required' };
    }

    if (!dto.customer_id) {
      return { success: false, error: 'Customer is required' };
    }

    if (!dto.deposit_amount || dto.deposit_amount <= 0) {
      return { success: false, error: 'Deposit amount must be greater than 0' };
    }

    // Instantiate canonical service with dependencies
    const repository = new PropertyUnitRepository();
    const reservationService = new ReservationService(repository, supabase);

    // Delegate to canonical ReservationService
    // This ensures Product state transition (available → held → DB booked) + Reservation creation
    const result = await reservationService.reserveProduct({
      tenantId: user.tenant_id,
      productId: dto.product_id,
      userId: user.id,
      customerId: dto.customer_id,
      durationMinutes: 1440 // Default 24 hours
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Reservation failed' };
    }

    // Fetch created reservation to return full data
    const { data: reservationData, error: fetchError } = await supabase
      .from('re_reservations')
      .select()
      .eq('id', result.reservationId!)
      .single();

    if (fetchError) {
      console.error('Failed to fetch created reservation:', fetchError);
      return { success: false, error: 'Reservation created but failed to fetch details' };
    }

    // Update deposit_amount if different from default (service creates with 0)
    if (dto.deposit_amount !== 0) {
      const { data: updatedData, error: updateError } = await supabase
        .from('re_reservations')
        .update({ 
          deposit_amount: dto.deposit_amount,
          notes: dto.notes?.trim() || null,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', result.reservationId!)
        .eq('tenant_id', user.tenant_id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update deposit amount:', updateError);
        // Not a critical failure, reservation still created
      } else if (updatedData) {
        Object.assign(reservationData, updatedData);
      }
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard/real-estate/reservations');
    revalidatePath('/dashboard/real-estate/apartments');

    return { success: true, data: reservationData };
  } catch (err) {
    console.error('Unexpected error creating reservation:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}

/**
 * Fetch all reservations for current tenant
 */
export async function fetchReservationsAction(): Promise<ReservationActionResult & { data?: ReservationRow[] }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('re_reservations')
      .select(`
        *,
        product:real_estate_products(id, product_code, product_type),
        customer:re_customers(id, name, phone)
      `)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch reservations:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Unexpected error fetching reservations:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}

/**
 * Cancel reservation
 * Delegates to canonical ReservationService for Product lifecycle rollback
 */
export async function cancelReservationAction(reservationId: string): Promise<ReservationActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Fetch reservation to get product_id
    const { data: reservation, error: fetchError } = await supabase
      .from('re_reservations')
      .select('product_id, tenant_id')
      .eq('id', reservationId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (fetchError || !reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    // Instantiate canonical service
    const repository = new PropertyUnitRepository();
    const reservationService = new ReservationService(repository, supabase);

    // Delegate to canonical service (handles Product held → available + Reservation cancellation)
    await reservationService.releaseProduct(
      user.tenant_id,
      reservation.product_id,
      reservationId,
      user.id
    );

    // Fetch updated reservation
    const { data, error } = await supabase
      .from('re_reservations')
      .select()
      .eq('id', reservationId)
      .single();

    if (error) {
      console.error('Failed to fetch cancelled reservation:', error);
      return { success: false, error: error.message };
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard/real-estate/reservations');
    revalidatePath('/dashboard/real-estate/apartments');

    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error cancelling reservation:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}
