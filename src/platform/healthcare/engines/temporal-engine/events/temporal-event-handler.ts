/**
 * Bitemporal Event Handler — Phase H9 Temporal Engine
 *
 * Listens to all domain events across Healthcare OS (H1–H8) and persists them
 * into the immutable bitemporal timeline (`hc_temporal_events`).
 *
 * Constitution:
 *   - Law 11: Zero `any` types
 *   - Bitemporal precision: Preserves event valid_time while generating system transaction_time.
 *
 * @module platform/healthcare/engines/temporal-engine/events/temporal-event-handler
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { eventBus } from '@/platform/host/event-bus';
import type { HealthcareAggregateType } from '../../../contracts/temporal-engine.contract';

interface GenericDomainEvent<T = Record<string, unknown>> {
  eventId?: string;
  eventType: string;
  timestamp?: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  userId?: string;
}

export class TemporalEventHandler {
  private sequenceCounter = 0;

  constructor(private readonly supabase: SupabaseClient) {
    this.registerSubscriptions();
  }

  private registerSubscriptions(): void {
    const eventTypes: Array<{ type: string; aggregateType: HealthcareAggregateType }> = [
      { type: 'hos.patient.registered.v1', aggregateType: 'Patient' },
      { type: 'hos.encounter.created.v1', aggregateType: 'Encounter' },
      { type: 'hos.allergy.recorded.v1', aggregateType: 'Encounter' },
      { type: 'hos.vital_signs.recorded.v1', aggregateType: 'Encounter' },
      { type: 'hos.lab.result_finalized.v1', aggregateType: 'Laboratory' },
      { type: 'hos.order.approved.v1', aggregateType: 'Pharmacy' },
      { type: 'hos.medication.dispensed.v1', aggregateType: 'Pharmacy' },
      { type: 'hos.cds.block.v1', aggregateType: 'ClinicalDecision' }
    ];

    eventTypes.forEach(({ type, aggregateType }) => {
      eventBus.subscribe(type, async (event: unknown) => {
        try {
          await this.handleDomainEvent(
            event as GenericDomainEvent<Record<string, unknown>>,
            aggregateType
          );
        } catch (err) {
          console.error(`[TemporalEventHandler] Error processing ${type}:`, err);
        }
      });
    });
  }

  public async handleDomainEvent(
    event: GenericDomainEvent<Record<string, unknown>>,
    defaultAggregateType: HealthcareAggregateType
  ): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload || {};
    const encounterId = (payload.encounterId as string) || event.aggregateId;
    const patientId = (payload.patientId as string) || event.aggregateId;

    if (!tenantId || !encounterId) return;

    const validTime = event.timestamp || new Date().toISOString();
    const sequenceNumber = Date.now() * 1000 + (this.sequenceCounter++ % 1000);

    const record = {
      id: event.eventId || crypto.randomUUID(),
      tenant_id: tenantId,
      encounter_id: encounterId,
      patient_id: patientId,
      aggregate_type: defaultAggregateType,
      aggregate_id: event.aggregateId,
      event_type: event.eventType,
      valid_time: validTime,
      transaction_time: new Date().toISOString(),
      sequence_number: sequenceNumber,
      delta_payload: payload
    };

    const { error } = await this.supabase
      .from('hc_temporal_events')
      .insert(record);

    if (error && error.code !== '23505') {
      console.error('[TemporalEventHandler] Failed to insert temporal event:', error);
    }
  }
}
