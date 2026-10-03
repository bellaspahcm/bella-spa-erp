/**
 * Event Wiring: Pharmacy Engine → Clinical Timeline
 * Wire MedicationAdministered event to clinical timeline
 */

import { eventBus } from '../event-bus.service';
import { MedicationAdministeredPayload } from '../types';
import { createClient } from '@/lib/supabase-client';
import type { Json } from '@/types/database.types';

interface InsertResult<Row> {
  data: Row | null;
  error: { message: string } | null;
}

interface InsertSelection<Row> {
  single(): PromiseLike<InsertResult<Row>>;
}

interface InsertQuery<Row> {
  select(): InsertSelection<Row>;
}

interface InsertTable<Row> {
  insert(values: unknown): InsertQuery<Row>;
}

interface TimelineInsertClient {
  from(table: 'clinical_timeline'): InsertTable<{ id: string }>;
}

function timelineInsertClient(client: unknown): TimelineInsertClient {
  return client as TimelineInsertClient;
}

function toJson(value: unknown): Json {
  const serialized: unknown = JSON.parse(JSON.stringify(value));
  return serialized as Json;
}

/**
 * When medication is administered, record in clinical timeline
 */
export function wireMedicationToTimeline(): () => void {
  return eventBus.subscribe<MedicationAdministeredPayload>(
    'MedicationAdministered',
    async (event) => {
      console.log('[Wiring] MedicationAdministered → Timeline: Recording event', {
        medicationName: event.payload.drugName,
        patientId: event.payload.patientId,
        dose: event.payload.dosage,
      });

      try {
        const supabase = createClient();

        // Insert into clinical timeline
        const { data, error } = await timelineInsertClient(supabase)
          .from('clinical_timeline')
          .insert({
            tenant_id: event.tenantId,
            patient_id: event.payload.patientId,
            encounter_id: event.payload.encounterId,
            event_type: 'medication_administered',
            event_category: 'pharmacy',
            event_title: `Medication Administered: ${event.payload.drugName}`,
            event_description: `${event.payload.dosage} ${event.payload.route} - Administered by ${event.payload.practitionerId}`,
            event_timestamp: event.payload.administeredAt,
            severity: 'info',
            metadata: toJson({
              marId: event.payload.marId,
              medicationId: event.payload.medicationId,
              medicationName: event.payload.drugName,
              dose: event.payload.dosage,
              route: event.payload.route,
              administeredBy: event.payload.practitionerId,
              notes: event.payload.notes,
              eventId: event.eventId,
            }),
            created_by: event.userId,
          })
          .select()
          .single();

        if (error) {
          console.error('[Wiring] Failed to insert timeline entry:', error);
          return;
        }
        if (!data) {
          console.error('[Wiring] Timeline insert returned no data');
          return;
        }

        console.log('[Wiring] Timeline entry created successfully:', data.id);
      } catch (error) {
        console.error('[Wiring] Error in MedicationAdministered → Timeline wiring:', error);
      }
    }
  );
}
