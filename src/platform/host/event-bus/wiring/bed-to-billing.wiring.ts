/**
 * Event Wiring: Bed Engine → Billing Engine
 * Wire BedAllocated event to create room charges
 */

import { eventBus } from '../event-bus.service';
import { BedAllocatedPayload } from '../types';
import { createClient } from '@/lib/supabase-client';

/**
 * When a bed is allocated, create a room charge in billing
 */
export function wireBedToBilling(): () => void {
  return eventBus.subscribe<BedAllocatedPayload>(
    'BedAllocated',
    async (event) => {
      console.log('[Wiring] BedAllocated → Billing: Creating room charge', {
        bedCode: event.payload.bedCode,
        patientId: event.payload.patientId,
        dailyRate: event.payload.dailyRate,
      });

      try {
        const supabase = createClient();

        // Create billing charge for room occupancy
        const { data, error } = await supabase
          .from('billing_charges')
          .insert({
            tenant_id: event.tenantId,
            encounter_id: event.payload.encounterId,
            patient_id: event.payload.patientId,
            charge_type: 'room',
            charge_category: 'accommodation',
            description: `Room Charge - ${event.payload.bedCode} (${event.payload.bedType})`,
            unit_price: event.payload.dailyRate,
            quantity: 1, // Daily charge (will be updated on discharge)
            total_amount: event.payload.dailyRate,
            charge_date: event.payload.allocatedAt,
            status: 'pending',
            metadata: {
              bedId: event.payload.bedId,
              bedCode: event.payload.bedCode,
              bedType: event.payload.bedType,
              wardId: event.payload.wardId,
              admissionId: event.payload.admissionId,
              eventId: event.eventId,
            },
          })
          .select()
          .single();

        if (error) {
          console.error('[Wiring] Failed to create billing charge:', error);
          // TODO: Publish BillingChargeFailed event for compensation
          return;
        }

        console.log('[Wiring] Room charge created successfully:', data.id);

        // TODO: Publish BillingChargeCreated event
      } catch (error) {
        console.error('[Wiring] Error in BedAllocated → Billing wiring:', error);
      }
    }
  );
}
