/**
 * Event Wiring: Pharmacy Engine → Clinical Timeline
 * Wire MedicationAdministered event to clinical timeline
 */

import { eventBus } from '../event-bus.service';
import { MedicationAdministeredPayload } from '../types';
import { createClient } from '@/lib/supabase/client';

/**
 * When medication is administered, record in clinical timeline
 */
export function wireMedicationToTimeline(): () => void {
  return eventBus.subscribe<MedicationAdministeredPayload>(
    'MedicationAdministered',
    async (event) => {
      console.log('[Wiring] MedicationAdministered → Timeline: Recording event', {
        medicationName: event.payload.medicationName,
        patientId: event.payload.patientId,
        dose: event.payload.dose,
      });

      try {
        const supabase = createClient();

        // Insert into clinical timeline
        const { data, error } = await supabase
          .from('clinical_timeline')
          .insert({
            tenant_id: event.tenantId,
            patient_id: event.payload.patientId,
            encounter_id: event.payload.encounterId,
            event_type: 'medication_administered',
            event_category: 'pharmacy',
            event_title: `Medication Administered: ${event.payload.medicationName}`,
            event_description: `${event.payload.dose} ${event.payload.route} - Administered by ${event.payload.administeredBy}`,
            event_timestamp: event.payload.administeredAt,
            severity: 'info',
            metadata: {
              orderId: event.payload.orderId,
              medicationName: event.payload.medicationName,
              dose: event.payload.dose,
              route: event.payload.route,
              administeredBy: event.payload.administeredBy,
              notes: event.payload.notes,
              eventId: event.eventId,
            },
            created_by: event.userId,
          })
          .select()
          .single();

        if (error) {
          console.error('[Wiring] Failed to insert timeline entry:', error);
          return;
        }

        console.log('[Wiring] Timeline entry created successfully:', data.id);
      } catch (error) {
        console.error('[Wiring] Error in MedicationAdministered → Timeline wiring:', error);
      }
    }
  );
}
