/**
 * Beauty Spa Module Adapter
 * 
 * Extends SpaModuleAdapter with additional resource conflict detection:
 * - Beds (giường)
 * - Rooms (phòng)
 * - Equipment (thiết bị)
 * 
 * **Conflict Types:**
 * 1. KTV conflict (inherited from SpaModuleAdapter)
 * 2. Bed conflict (same bed, same time)
 * 3. Room conflict (room full, same time)
 * 4. Equipment conflict (equipment unavailable, same time)
 * 
 * **Architecture:**
 * - Reuses SpaModuleAdapter for KTV validation
 * - Adds resource-specific validation methods
 * - Checks resource availability in database
 * 
 * @module BeautySpaModuleAdapter
 */

import { SpaModuleAdapter } from '@/modules/spa/adapters/SpaModuleAdapter';
import { createClient } from '@/lib/supabase-server';
import type { CoreBookingOrder } from '@/core/types/booking-order';
import type { TenantContext } from '@/core/types/tenant';
import type { ModuleAdapter } from '@/core/types';

interface ResourceConflict {
  type: 'bed' | 'room' | 'equipment';
  resourceId: string;
  resourceName: string;
  conflictingBookingId: string;
  timeRange: string;
}

/**
 * Beauty Spa Module Adapter
 * 
 * Extends Spa adapter with resource management.
 */
export class BeautySpaModuleAdapter extends SpaModuleAdapter implements ModuleAdapter {
  override readonly moduleId = 'beauty_spa' as const;
  override readonly moduleName = 'Beauty Spa Module';

  /**
   * Validate booking rules for Beauty Spa.
   * 
   * Extends parent validation with resource checks.
   * 
   * @param order - Booking order
   * @param context - Tenant context
   * @returns True if valid, false otherwise
   */
  override async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    console.log(`[BeautySpaAdapter] Validating booking rules for order ${order.id}`);

    // Step 1: Run parent validation (KTV + capacity)
    const parentValid = await super.validateBookingRules(order, context);
    if (!parentValid) {
      console.error('[BeautySpaAdapter] Parent validation failed (KTV conflict)');
      return false;
    }

    // Step 2: Check resource conflicts
    try {
      const resourceConflicts = await this.checkResourceConflicts(order, context);
      
      if (resourceConflicts.length > 0) {
        console.error(
          `[BeautySpaAdapter] Resource conflicts detected (${resourceConflicts.length}):`
        );
        resourceConflicts.forEach(conflict => {
          console.error(
            `  - ${conflict.type}: ${conflict.resourceName} (ID: ${conflict.resourceId}) ` +
            `conflicts with booking ${conflict.conflictingBookingId} at ${conflict.timeRange}`
          );
        });
        return false;
      }

      console.log(`[BeautySpaAdapter] All resource checks passed for order ${order.id}`);
      return true;
      
    } catch (error) {
      console.error('[BeautySpaAdapter] Error during resource validation:', error);
      // Fail open: Allow booking if resource check fails (prevent blocking due to system errors)
      console.warn('[BeautySpaAdapter] Proceeding with booking despite resource check error');
      return true;
    }
  }

  /**
   * Check resource conflicts for Beauty Spa booking.
   * 
   * Queries database for:
   * - Bed conflicts (same bed, overlapping time)
   * - Room conflicts (room capacity exceeded)
   * - Equipment conflicts (equipment unavailable)
   * 
   * @param order - Booking order
   * @param context - Tenant context
   * @returns Array of resource conflicts
   */
  private async checkResourceConflicts(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<ResourceConflict[]> {
    const conflicts: ResourceConflict[] = [];
    const supabase = createClient();

    // Extract resource assignments from order metadata
    const assignedBedId = order.metadata?.assigned_bed_id as string | undefined;
    const assignedRoomId = order.metadata?.assigned_room_id as string | undefined;
    const requiredEquipmentIds = order.metadata?.required_equipment_ids as string[] | undefined;

    // Get booking time range
    const scheduledDate = order.scheduledStartTime; // YYYY-MM-DD
    const startTime = (order.metadata?.preferred_time as string) || '08:00';
    const durationMinutes = 60; // Default, should come from service metadata
    const endTime = this.calculateEndTime(startTime, durationMinutes);

    // Check 1: Bed conflict
    if (assignedBedId) {
      const bedConflict = await this.checkBedConflict(
        supabase,
        assignedBedId,
        scheduledDate,
        startTime,
        endTime,
        context.tenantId
      );
      if (bedConflict) conflicts.push(bedConflict);
    }

    // Check 2: Room conflict
    if (assignedRoomId) {
      const roomConflict = await this.checkRoomConflict(
        supabase,
        assignedRoomId,
        scheduledDate,
        startTime,
        endTime,
        context.tenantId
      );
      if (roomConflict) conflicts.push(roomConflict);
    }

    // Check 3: Equipment conflicts
    if (requiredEquipmentIds && requiredEquipmentIds.length > 0) {
      const equipmentConflicts = await this.checkEquipmentConflicts(
        supabase,
        requiredEquipmentIds,
        scheduledDate,
        startTime,
        endTime,
        context.tenantId
      );
      conflicts.push(...equipmentConflicts);
    }

    return conflicts;
  }

  /**
   * Check if bed is available at the given time.
   * 
   * @param supabase - Supabase client
   * @param bedId - Bed ID
   * @param date - Booking date (YYYY-MM-DD)
   * @param startTime - Start time (HH:mm)
   * @param endTime - End time (HH:mm)
   * @param tenantId - Tenant ID
   * @returns Conflict object if bed is occupied, null otherwise
   */
  private async checkBedConflict(
    supabase: ReturnType<typeof createClient>,
    bedId: string,
    date: string,
    startTime: string,
    endTime: string,
    tenantId: string
  ): Promise<ResourceConflict | null> {
    // Query existing bookings for this bed on the same date
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id, preferred_time, packages(duration_minutes), beds(bed_number, bed_name)')
      .eq('assigned_bed_id', bedId)
      .eq('tenant_id', tenantId)
      .eq('start_date', date)
      .in('status', ['booked', 'deposit_pending', 'active', 'in_progress']);

    if (!existingBookings || existingBookings.length === 0) {
      return null; // No conflict
    }

    // Check time overlap
    for (const booking of existingBookings) {
      const existingStart = booking.preferred_time || '08:00';
      const existingDuration = (booking.packages as any)?.duration_minutes || 60;
      const existingEnd = this.calculateEndTime(existingStart, existingDuration);

      if (this.timeRangesOverlap(startTime, endTime, existingStart, existingEnd)) {
        const bedInfo = booking.beds as any;
        return {
          type: 'bed',
          resourceId: bedId,
          resourceName: bedInfo?.bed_name || bedInfo?.bed_number || bedId,
          conflictingBookingId: booking.id,
          timeRange: `${existingStart} - ${existingEnd}`,
        };
      }
    }

    return null; // No overlap
  }

  /**
   * Check if room has available capacity at the given time.
   * 
   * @param supabase - Supabase client
   * @param roomId - Room ID
   * @param date - Booking date (YYYY-MM-DD)
   * @param startTime - Start time (HH:mm)
   * @param endTime - End time (HH:mm)
   * @param tenantId - Tenant ID
   * @returns Conflict object if room is full, null otherwise
   */
  private async checkRoomConflict(
    supabase: ReturnType<typeof createClient>,
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
    tenantId: string
  ): Promise<ResourceConflict | null> {
    // Get room capacity
    const { data: room } = await supabase
      .from('rooms')
      .select('id, room_number, room_name, capacity')
      .eq('id', roomId)
      .single();

    if (!room) {
      console.warn(`[BeautySpaAdapter] Room ${roomId} not found`);
      return null; // Room doesn't exist, skip check
    }

    // Query existing bookings for this room on the same date
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id, preferred_time, packages(duration_minutes)')
      .eq('assigned_room_id', roomId)
      .eq('tenant_id', tenantId)
      .eq('start_date', date)
      .in('status', ['booked', 'deposit_pending', 'active', 'in_progress']);

    if (!existingBookings || existingBookings.length === 0) {
      return null; // No bookings, room available
    }

    // Count overlapping bookings
    let overlappingCount = 0;
    for (const booking of existingBookings) {
      const existingStart = booking.preferred_time || '08:00';
      const existingDuration = (booking.packages as any)?.duration_minutes || 60;
      const existingEnd = this.calculateEndTime(existingStart, existingDuration);

      if (this.timeRangesOverlap(startTime, endTime, existingStart, existingEnd)) {
        overlappingCount++;
      }
    }

    // Check if room capacity exceeded
    if (overlappingCount >= room.capacity) {
      return {
        type: 'room',
        resourceId: roomId,
        resourceName: room.room_name || room.room_number,
        conflictingBookingId: existingBookings[0].id,
        timeRange: `${startTime} - ${endTime} (${overlappingCount}/${room.capacity} used)`,
      };
    }

    return null; // Room has capacity
  }

  /**
   * Check if equipment is available at the given time.
   * 
   * @param supabase - Supabase client
   * @param equipmentIds - Array of equipment IDs
   * @param date - Booking date (YYYY-MM-DD)
   * @param startTime - Start time (HH:mm)
   * @param endTime - End time (HH:mm)
   * @param tenantId - Tenant ID
   * @returns Array of equipment conflicts
   */
  private async checkEquipmentConflicts(
    supabase: ReturnType<typeof createClient>,
    equipmentIds: string[],
    date: string,
    startTime: string,
    endTime: string,
    tenantId: string
  ): Promise<ResourceConflict[]> {
    const conflicts: ResourceConflict[] = [];

    for (const equipmentId of equipmentIds) {
      // Get equipment info
      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, equipment_code, equipment_name, quantity')
        .eq('id', equipmentId)
        .single();

      if (!equipment) {
        console.warn(`[BeautySpaAdapter] Equipment ${equipmentId} not found`);
        continue; // Equipment doesn't exist, skip
      }

      // Query existing bookings using this equipment on the same date
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, preferred_time, packages(duration_minutes)')
        .contains('required_equipment_ids', [equipmentId])
        .eq('tenant_id', tenantId)
        .eq('start_date', date)
        .in('status', ['booked', 'deposit_pending', 'active', 'in_progress']);

      if (!existingBookings || existingBookings.length === 0) {
        continue; // No bookings, equipment available
      }

      // Count overlapping bookings
      let overlappingCount = 0;
      for (const booking of existingBookings) {
        const existingStart = booking.preferred_time || '08:00';
        const existingDuration = (booking.packages as any)?.duration_minutes || 60;
        const existingEnd = this.calculateEndTime(existingStart, existingDuration);

        if (this.timeRangesOverlap(startTime, endTime, existingStart, existingEnd)) {
          overlappingCount++;
        }
      }

      // Check if equipment quantity exceeded
      if (overlappingCount >= equipment.quantity) {
        conflicts.push({
          type: 'equipment',
          resourceId: equipmentId,
          resourceName: equipment.equipment_name || equipment.equipment_code,
          conflictingBookingId: existingBookings[0].id,
          timeRange: `${startTime} - ${endTime} (${overlappingCount}/${equipment.quantity} used)`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if two time ranges overlap.
   * 
   * @param start1 - Start time 1 (HH:mm)
   * @param end1 - End time 1 (HH:mm)
   * @param start2 - Start time 2 (HH:mm)
   * @param end2 - End time 2 (HH:mm)
   * @returns True if ranges overlap, false otherwise
   */
  private timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    // Convert HH:mm to minutes since midnight
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    // Check if ranges overlap
    // Range 1: [s1, e1)
    // Range 2: [s2, e2)
    // Overlap if: s1 < e2 AND s2 < e1
    return s1 < e2 && s2 < e1;
  }
}
