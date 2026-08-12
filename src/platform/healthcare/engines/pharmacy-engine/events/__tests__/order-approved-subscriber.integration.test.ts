import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { InMemoryEventBus } from '../../../order-engine/contracts/event-bus.interface';
import { SupabasePharmacyRepository } from '../../repositories/supabase-pharmacy.repository';
import { SupabaseClinicalOrderReader } from '../../repositories/supabase-clinical-order-reader';
import { OrderApprovedSubscriber } from '../order-approved-subscriber';
import { Prescription } from '../../domain/prescription.entity';
import type { OrderApprovedEvent } from '../../../order-engine/events/order-events';

describe('OrderApprovedSubscriber Integration Tests (4B.3)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let eventBus: InMemoryEventBus;
  let repository: SupabasePharmacyRepository;
  let reader: SupabaseClinicalOrderReader;
  let subscriber: OrderApprovedSubscriber;
  let fixtures: HealthcareTestFixture;

  let createdPrescriptionIds: string[] = [];
  let createdOrderIds: string[] = [];

  const clinicalOrderId = randomUUID();
  const labOrderId = randomUUID();

  beforeEach(async () => {
    fixtures = await HealthcareTestFixtures.setup();
    supabase = await createClient();
    eventBus = new InMemoryEventBus();
    repository = new SupabasePharmacyRepository(supabase);
    reader = new SupabaseClinicalOrderReader(supabase);
    
    // Instantiate subscriber (registers itself to eventBus)
    subscriber = new OrderApprovedSubscriber(eventBus, repository, reader);

    // Bootstrap clinical orders in the database
    // 1. Medication Order
    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_party_id: fixtures.patientPartyId,
      order_type: 'MEDICATION',
      order_status: 'APPROVED',
      ordered_by: fixtures.providerPartyId,
      order_details: {
        drugCode: 'A02B',
        drugName: 'Omeprazole 20mg',
        dose: 20,
        doseUnit: 'mg',
        route: 'PO',
        frequency: 'QD',
        durationDays: 14,
      },
    });
    createdOrderIds.push(clinicalOrderId);

    // 2. Lab Order (should be filtered out by subscriber)
    await supabase.from('hc_clinical_orders').insert({
      id: labOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_party_id: fixtures.patientPartyId,
      order_type: 'LAB',
      order_status: 'APPROVED',
      ordered_by: fixtures.providerPartyId,
      order_details: {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      },
    });
    createdOrderIds.push(labOrderId);
  });

  afterEach(async () => {
    // Teardown prescriptions
    if (createdPrescriptionIds.length > 0) {
      await supabase.from('hc_prescriptions').delete().in('id', createdPrescriptionIds);
      createdPrescriptionIds = [];
    }

    // Teardown clinical orders
    if (createdOrderIds.length > 0) {
      await supabase.from('hc_clinical_orders').delete().in('id', createdOrderIds);
      createdOrderIds = [];
    }

    await fixtures.cleanup();
  });

  async function waitForPrescription(tenantId: string, orderId: string, timeoutMs = 5000): Promise<Prescription | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const rx = await repository.findPrescriptionByClinicalOrderId(tenantId, orderId);
      if (rx) {
        createdPrescriptionIds.push(rx.id);
        return rx;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  it('should successfully create a prescription on OrderApproved event for MEDICATION', async () => {
    const event: OrderApprovedEvent = {
      eventType: 'OrderApproved',
      eventId: randomUUID(),
      eventVersion: '1',
      occurredAt: new Date(),
      tenantId: fixtures.tenantId,
      aggregateId: clinicalOrderId,
      aggregateType: 'ClinicalOrder',
      aggregateVersion: 2,
      payload: {
        orderId: clinicalOrderId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        approvedBy: fixtures.providerPartyId,
        approvedAt: new Date(),
        previousStatus: 'VALIDATED',
        newStatus: 'APPROVED',
        previousVersion: 1,
        newVersion: 2,
      },
    };

    // Publish event to the bus
    await eventBus.publish(event);

    // Wait for async subscriber to insert
    const prescription = await waitForPrescription(fixtures.tenantId, clinicalOrderId);
    expect(prescription).not.toBeNull();
    expect(prescription?.status).toBe('PENDING_REVIEW');
    expect(prescription?.encounterId).toBe(fixtures.encounterId);
    expect(prescription?.patientPartyId).toBe(fixtures.patientPartyId);
    expect(prescription?.drugs).toHaveLength(1);
    expect(prescription?.drugs[0].code).toBe('A02B');
    expect(prescription?.drugs[0].name).toBe('Omeprazole 20mg');
  });

  it('should filter out OrderApproved event if orderType is not MEDICATION', async () => {
    const event: OrderApprovedEvent = {
      eventType: 'OrderApproved',
      eventId: randomUUID(),
      eventVersion: '1',
      occurredAt: new Date(),
      tenantId: fixtures.tenantId,
      aggregateId: labOrderId, // LAB order
      aggregateType: 'ClinicalOrder',
      aggregateVersion: 2,
      payload: {
        orderId: labOrderId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        approvedBy: fixtures.providerPartyId,
        approvedAt: new Date(),
        previousStatus: 'VALIDATED',
        newStatus: 'APPROVED',
        previousVersion: 1,
        newVersion: 2,
      },
    };

    await eventBus.publish(event);

    // Wait a brief period (500ms instead of 5000ms to avoid test timeouts) and ensure no prescription is created
    const prescription = await waitForPrescription(fixtures.tenantId, labOrderId, 500);
    expect(prescription).toBeNull();
  });

  it('should enforce event replay idempotency and ignore duplicate events', async () => {
    const event: OrderApprovedEvent = {
      eventType: 'OrderApproved',
      eventId: randomUUID(),
      eventVersion: '1',
      occurredAt: new Date(),
      tenantId: fixtures.tenantId,
      aggregateId: clinicalOrderId,
      aggregateType: 'ClinicalOrder',
      aggregateVersion: 2,
      payload: {
        orderId: clinicalOrderId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        approvedBy: fixtures.providerPartyId,
        approvedAt: new Date(),
        previousStatus: 'VALIDATED',
        newStatus: 'APPROVED',
        previousVersion: 1,
        newVersion: 2,
      },
    };

    // First delivery
    await eventBus.publish(event);
    const rx1 = await waitForPrescription(fixtures.tenantId, clinicalOrderId);
    expect(rx1).not.toBeNull();

    // Second delivery (replay)
    await eventBus.publish(event);
    
    // Give subscriber time to execute
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify only one prescription exists for the clinical order
    const { data, error } = await supabase
      .from('hc_prescriptions')
      .select('*')
      .eq('tenant_id', fixtures.tenantId)
      .eq('clinical_order_id', clinicalOrderId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
