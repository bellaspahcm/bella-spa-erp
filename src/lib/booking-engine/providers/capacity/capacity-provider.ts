/**
 * Capacity Provider
 * 
 * Quản lý capacity real-time:
 * - Check available capacity per time slot
 * - Suggest alternative time slots
 * - Enforce capacity limits
 * - Reserve buffer for VIP/walk-ins
 */

import { BaseBookingProvider } from '../base-provider';
import type {
  ICapacityProvider,
  CapacityProviderResult,
  AlternativeSlot,
  CapacityInfo,
} from '../../types';

export class CapacityProvider extends BaseBookingProvider implements ICapacityProvider {
  
  /**
   * Kiểm tra capacity cho time slot
   */
  async checkCapacity(
    date: string,
    timeSlot: string,
    tenantId: string
  ): Promise<CapacityProviderResult> {
    try {
      this.log('info', 'Checking capacity', { date, timeSlot });

      // Step 1: Get capacity info
      const capacityInfo = await this.getCapacityInfo(date, timeSlot, tenantId);

      // Step 2: Determine recommendation
      let recommendation: 'accept' | 'suggest_alternative' | 'waitlist';
      
      if (capacityInfo.isAvailable) {
        recommendation = 'accept';
      } else if (capacityInfo.availableCapacity > 0) {
        recommendation = 'suggest_alternative'; // Có chỗ nhưng ít
      } else {
        recommendation = 'waitlist'; // Full
      }

      // Step 3: Get alternatives if needed
      const alternatives = recommendation !== 'accept'
        ? await this.suggestAlternatives(date, tenantId)
        : [];

      this.log('info', 'Capacity check complete', { 
        recommendation,
        availableCapacity: capacityInfo.availableCapacity,
      });

      return this.success({
        current: capacityInfo,
        alternatives,
        recommendation,
      }, capacityInfo.availableCapacity > 0 ? 90 : 20);

    } catch (error) {
      this.log('error', 'Capacity check failed', { error });
      return this.error(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Suggest alternative time slots
   */
  async suggestAlternatives(
    preferredDate: string,
    tenantId: string,
    limit: number = 5
  ): Promise<AlternativeSlot[]> {
    try {
      this.log('info', 'Finding alternative slots', { preferredDate, limit });

      // TODO: Implement
      // - Query next 7 days
      // - Score by proximity to preferred date
      // - Include only slots with available capacity
      // - Sort by score

      // Placeholder
      return [];

    } catch (error) {
      this.log('error', 'Failed to find alternatives', { error });
      return [];
    }
  }

  /**
   * Get capacity info for specific date/time
   */
  private async getCapacityInfo(
    date: string,
    timeSlot: string,
    tenantId: string
  ): Promise<CapacityInfo> {
    // TODO: Implement database query
    // 1. Count total KTVs available (not on leave)
    // 2. Count bookings for this slot
    // 3. Calculate available = total - booked - buffer
    
    const totalCapacity = 10; // TODO: Query from config/count KTVs
    const bookedCapacity = 0; // TODO: Query bookings
    const bufferReserved = Math.ceil(totalCapacity * 0.1); // 10% buffer
    const availableCapacity = totalCapacity - bookedCapacity - bufferReserved;
    const utilizationRate = (bookedCapacity / totalCapacity) * 100;

    return {
      date,
      timeSlot,
      totalCapacity,
      bookedCapacity,
      availableCapacity: Math.max(0, availableCapacity),
      utilizationRate: Math.round(utilizationRate),
      isAvailable: availableCapacity > 0,
      bufferReserved,
    };
  }
}
