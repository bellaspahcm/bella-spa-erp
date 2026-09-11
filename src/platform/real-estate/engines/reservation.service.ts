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
    // Note: Database schema uses reservation_status enum ('pending_deposit' | 'deposited' | 'converted_to_contract' | 'cancelled')
    // Columns: tenant_id, product_id, customer_id, deposit_amount, status, reserved_at, created_by, updated_by
    const { data: resData, error: resError } = await this.supabase
      .from('re_reservations')
      .insert({
        tenant_id: params.tenantId,
        product_id: params.productId,
        customer_id: params.customerId,
        deposit_amount: 0, // Default to zero before actual deposit payment
        status: 'pending_deposit' as any, // Aligned with reservation_status enum
        created_by: params.userId,
        updated_by: params.userId
      })
      .select('id, reserved_at')
      .single();

    if (resError) {
      // Rollback status in database if insert fails
      unit.release();
      await this.repository.save(this.supabase, unit);
      throw new Error(`DATABASE_ERROR: Failed to register reservation: ${resError.message}`);
    }

    // Calculate expiry based on reserved_at timestamp (using default 24 hours for now)
    const reservedAt = new Date(resData.reserved_at || new Date());
    const expiresAt = new Date(reservedAt.getTime() + (params.durationMinutes || 1440) * 60000).toISOString();

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

    // Update reservation status in database (use reservation_status enum: 'cancelled')
    const { error: resError } = await this.supabase
      .from('re_reservations')
      .update({
        status: 'cancelled' as any,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: tenantId // Using tenantId as fallback since userId not stored in params
      })
      .eq('id', reservationId)
      .eq('tenant_id', tenantId);

    if (resError) {
      throw new Error(`DATABASE_ERROR: Failed to release reservation record: ${resError.message}`);
    }
  }
}
