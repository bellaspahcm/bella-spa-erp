/**
 * Real Estate Kernel — Reservation Engine Service
 *
 * Implements IReservationContract, managing hold locks, temporal state updates,
 * and reservation timelines under tenant isolation.
 *
 * @module platform/real-estate/engines/reservation.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IReservationContract, ReservationParams, ReservationResultDTO } from '../contracts/reservation.contract';
import { PropertyUnitRepository } from '../repositories/property-unit.repository';
import type { Database } from '@/types/database.types';

export class ReservationService implements IReservationContract {
  constructor(
    private readonly repository: PropertyUnitRepository,
    private readonly supabase: SupabaseClient<Database>
  ) {}

  /**
   * Reserves a unit, setting status to 'held' and inserting a reservation record.
   */
  async reserveProduct(params: ReservationParams): Promise<ReservationResultDTO> {
    if (!params.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!params.productId) throw new Error('PRODUCT_BOUNDARY_VIOLATION: productId is required');

    // 1. Fetch unit from database repository
    const unit = await this.repository.findById(this.supabase, params.tenantId, params.productId);
    if (!unit) {
      return { success: false, error: 'Product unit not found' };
    }

    // 2. Perform state transition checks inside Domain entity (Aggregate Root)
    try {
      unit.reserve(params.customerId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Reservation failed';
      return { success: false, error: errorMessage };
    }

    // 3. Save property unit back to DB via repository
    await this.repository.save(this.supabase, unit);

    // 4. Create reservation log in 're_reservations' table
    const expiresAt = new Date(Date.now() + params.durationMinutes * 60000).toISOString();
    const { data: resData, error: resError } = await this.supabase
      .from('re_reservations')
      .insert({
        tenant_id: params.tenantId,
        product_id: params.productId,
        user_id: params.userId,
        customer_id: params.customerId,
        duration_minutes: params.durationMinutes,
        status: 'pending_deposit',
        expires_at: expiresAt,
        deposit_amount: 0 // Default to zero before actual deposit payment
      })
      .select('id')
      .single();

    if (resError) {
      // Rollback status in database if insert fails
      unit.release();
      await this.repository.save(this.supabase, unit);
      throw new Error(`DATABASE_ERROR: Failed to register reservation: ${resError.message}`);
    }

    return {
      success: true,
      reservationId: resData.id,
      expiresAt
    };
  }

  /**
   * Releases a reservation hold, returning property status back to 'available'.
   */
  async releaseProduct(tenantId: string, productId: string, reservationId: string): Promise<void> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    const unit = await this.repository.findById(this.supabase, tenantId, productId);
    if (!unit) throw new Error('Product unit not found');

    // Domain transition HELD -> AVAILABLE
    unit.release();
    await this.repository.save(this.supabase, unit);

    // Update reservation status in database
    const { error: resError } = await this.supabase
      .from('re_reservations')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId)
      .eq('tenant_id', tenantId);

    if (resError) {
      throw new Error(`DATABASE_ERROR: Failed to release reservation record: ${resError.message}`);
    }
  }
}
