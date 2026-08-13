import type { SupabaseClient } from '@supabase/supabase-js';
import { eventBus } from '@/platform/host/event-bus';

interface DomainEvent<T> {
  eventId?: string;
  eventType: string;
  timestamp?: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  userId?: string;
}

interface AllergyRecordedPayload {
  encounterId: string;
  patientId: string;
  allergenType: string;
  allergenCode: string;
  allergenName: string;
  reactionType: string;
  severity: string;
}

interface OrderApprovedPayload {
  encounterId: string;
  patientId: string;
  orderType: string;
  drugCode?: string;
  orderDetails?: {
    drugCode?: string;
  };
}

interface AllergyItem {
  id: string;
  allergen_type: string;
  allergen_code: string;
  allergen_name: string;
  reaction_type: string;
  severity: string;
}

interface MedicationItem {
  code: string;
}

interface OrderItem {
  id: string;
  type: string;
  drug_code: string;
}

export class CdsEventHandler {
  constructor(private readonly supabase: SupabaseClient) {
    this.registerSubscriptions();
  }

  private registerSubscriptions(): void {
    // 1. Subscribe to Allergy Recorded events
    eventBus.subscribe('hos.allergy.recorded.v1', async (event: unknown) => {
      try {
        await this.handleAllergyRecorded(event as DomainEvent<AllergyRecordedPayload>);
      } catch (err) {
        console.error('[CdsEventHandler] Error handling AllergyRecorded:', err);
      }
    });

    // 2. Subscribe to Order Approved events
    eventBus.subscribe('hos.order.approved.v1', async (event: unknown) => {
      try {
        await this.handleOrderApproved(event as DomainEvent<OrderApprovedPayload>);
      } catch (err) {
        console.error('[CdsEventHandler] Error handling OrderApproved:', err);
      }
    });
  }

  private async handleAllergyRecorded(event: DomainEvent<AllergyRecordedPayload>): Promise<void> {
    const { tenantId, aggregateId: allergyId } = event;
    const { encounterId, patientId, allergenType, allergenCode, allergenName, reactionType, severity } = event.payload;

    const eventSequence = new Date(event.timestamp || new Date()).getTime();

    // Query existing snapshot to get current allergies list
    const { data: snapshot } = await this.supabase
      .from('hc_clinical_context_snapshots')
      .select('allergies')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .maybeSingle();

    const allergies = snapshot?.allergies ? (snapshot.allergies as AllergyItem[]) : [];
    
    // Add new allergy if not already in list
    if (!allergies.some((a) => a.allergen_code === allergenCode)) {
      allergies.push({
        id: allergyId,
        allergen_type: allergenType,
        allergen_code: allergenCode,
        allergen_name: allergenName,
        reaction_type: reactionType,
        severity: severity
      });
    }

    // Call the advisory-locked Postgres projection function
    const { error } = await this.supabase.rpc('project_clinical_context_event', {
      p_tenant_id: tenantId,
      p_event_id: event.eventId || crypto.randomUUID(),
      p_event_type: event.eventType,
      p_event_timestamp: event.timestamp || new Date().toISOString(),
      p_event_sequence: eventSequence,
      p_encounter_id: encounterId,
      p_patient_id: patientId,
      p_snapshot_update: { allergies }
    });

    if (error) {
      throw new Error(`Failed to project AllergyRecorded event: ${error.message}`);
    }
  }

  private async handleOrderApproved(event: DomainEvent<OrderApprovedPayload>): Promise<void> {
    const { tenantId, aggregateId: orderId } = event;
    const { encounterId, patientId, orderType } = event.payload;

    if (orderType !== 'MEDICATION') return;

    // In a real application we would fetch order details or read from event payload
    // Let's check if the event payload has drugCode
    const drugCode = event.payload.drugCode || event.payload.orderDetails?.drugCode;
    if (!drugCode) return;

    const eventSequence = new Date(event.timestamp || new Date()).getTime();

    // Query existing snapshot
    const { data: snapshot } = await this.supabase
      .from('hc_clinical_context_snapshots')
      .select('active_medications, active_orders')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .maybeSingle();

    const activeMedications = snapshot?.active_medications ? (snapshot.active_medications as MedicationItem[]) : [];
    const activeOrders = snapshot?.active_orders ? (snapshot.active_orders as OrderItem[]) : [];

    if (!activeMedications.some((m) => m.code === drugCode)) {
      activeMedications.push({ code: drugCode });
    }
    if (!activeOrders.some((o) => o.id === orderId)) {
      activeOrders.push({ id: orderId, type: 'MEDICATION', drug_code: drugCode });
    }

    const { error } = await this.supabase.rpc('project_clinical_context_event', {
      p_tenant_id: tenantId,
      p_event_id: event.eventId || crypto.randomUUID(),
      p_event_type: event.eventType,
      p_event_timestamp: event.timestamp || new Date().toISOString(),
      p_event_sequence: eventSequence,
      p_encounter_id: encounterId,
      p_patient_id: patientId,
      p_snapshot_update: {
        active_medications: activeMedications,
        active_orders: activeOrders
      }
    });

    if (error) {
      throw new Error(`Failed to project OrderApproved event: ${error.message}`);
    }
  }
}
