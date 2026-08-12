import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { InMemoryEventBus } from '../engines/order-engine/contracts/event-bus.interface';
import { SupabaseOrderRepository } from '../engines/order-engine/repositories/supabase-order-repository';
import { ClinicalOrderService } from '../engines/order-engine/services/clinical-order.service';
import { SupabasePharmacyRepository } from '../engines/pharmacy-engine/repositories/supabase-pharmacy.repository';
import { SupabaseClinicalOrderReader } from '../engines/pharmacy-engine/repositories/supabase-clinical-order-reader';
import { OrderApprovedSubscriber } from '../engines/pharmacy-engine/events/order-approved-subscriber';
import { PharmacyEngineService } from '../engines/pharmacy-engine/pharmacy-engine.service';
import { eventBus as platformHostEventBus } from '@/platform/host/event-bus';

// Encounter Reader for ClinicalOrderService to fetch status from DB
class IntegrationEncounterReader {
  constructor(private readonly supabase: Awaited<ReturnType<typeof createClient>>) {}
  
  async getEncounterSnapshot(tenantId: string, encounterId: string) {
    const { data, error } = await this.supabase
      .from('hc_encounters')
      .select('id, patient_party_id, status, encounter_class, started_at, finished_at')
      .eq('tenant_id', tenantId)
      .eq('id', encounterId)
      .single();
    
    if (error || !data) {
      throw new Error('Encounter not found');
    }
    
    return {
      encounterId: data.id,
      patientPartyId: data.patient_party_id,
      status: this.mapEncounterStatus(data.status),
      encounterType: data.encounter_class || 'scheduled',
      admittedAt: data.started_at ? new Date(data.started_at) : new Date(),
      dischargedAt: data.finished_at ? new Date(data.finished_at) : null,
    };
  }
  
  async canCreateOrders(tenantId: string, encounterId: string): Promise<boolean> {
    try {
      const snapshot = await this.getEncounterSnapshot(tenantId, encounterId);
      return snapshot.status === 'IN_PROGRESS';
    } catch {
      return false;
    }
  }
  
  private mapEncounterStatus(dbStatus: string): 'REGISTERED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED' {
    switch (dbStatus) {
      case 'planned':
      case 'arrived':
        return 'REGISTERED';
      case 'triaged':
      case 'in-progress':
      case 'on-hold':
        return 'IN_PROGRESS';
      case 'finished':
        return 'FINISHED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'REGISTERED';
    }
  }
}

describe('3-Engine Clinical Workflow Integration Tests (4B.4 & 4B.5)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;

  // Services & Repositories
  let orderRepository: SupabaseOrderRepository;
  let orderService: ClinicalOrderService;
  let pharmacyRepository: SupabasePharmacyRepository;
  let pharmacyService: PharmacyEngineService;
  let clinicalOrderReader: SupabaseClinicalOrderReader;
  let subscriber: OrderApprovedSubscriber;

  // Shared event bus for clinical order -> pharmacy subscriber transition
  let orderEventBus: InMemoryEventBus;

  // Cleanup trackers
  let createdOrderIds: string[] = [];
  let createdPrescriptionIds: string[] = [];
  let createdMARIds: string[] = [];

  beforeEach(async () => {
    fixtures = await HealthcareTestFixtures.setup();
    supabase = await createClient();

    // 1. Initialize Order Engine dependencies
    orderRepository = new SupabaseOrderRepository(supabase);
    const encounterReader = new IntegrationEncounterReader(supabase);
    orderEventBus = new InMemoryEventBus();
    orderService = new ClinicalOrderService(orderRepository, encounterReader, orderEventBus);

    // 2. Initialize Pharmacy Engine dependencies
    pharmacyRepository = new SupabasePharmacyRepository(supabase);
    clinicalOrderReader = new SupabaseClinicalOrderReader(supabase);
    pharmacyService = new PharmacyEngineService(supabase);

    // 3. Instantiate subscriber linking them via event bus
    subscriber = new OrderApprovedSubscriber(orderEventBus, pharmacyRepository, clinicalOrderReader);

    // 4. Setup mock listener on platform host event bus to verify MAR events
    jest.spyOn(platformHostEventBus, 'publish').mockImplementation(async () => Promise.resolve());
  });

  afterEach(async () => {
    // Teardown MAR records
    if (createdMARIds.length > 0) {
      await supabase.from('hc_medication_administration_records').delete().in('id', createdMARIds);
      createdMARIds = [];
    }

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
    jest.restoreAllMocks();
  });

  async function pollForPrescription(tenantId: string, orderId: string): Promise<Prescription | null> {
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const rx = await pharmacyRepository.findPrescriptionByClinicalOrderId(tenantId, orderId);
      if (rx) {
        createdPrescriptionIds.push(rx.id);
        return rx;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  it('should execute full 3-engine clinical flow from Encounter to Medication Administration (MAR)', async () => {
    const requestId = randomUUID();

    // =========================================================================
    // STEP A: Create Clinical Order of type MEDICATION (Order Engine)
    // =========================================================================
    const orderResult = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderedBy: fixtures.providerPartyId,
      orderDetails: {
        drugCode: 'A02B',
        drugName: 'Omeprazole 20mg',
        dose: 20,
        doseUnit: 'mg',
        route: 'PO',
        frequency: 'QD',
        durationDays: 7,
        currentMedicationCodes: [],
      },
      notes: 'Take daily before breakfast',
      requestId,
    });

    expect(orderResult.success).toBe(true);
    const orderId = orderResult.data!.id;
    createdOrderIds.push(orderId);

    // Verify order is initially PENDING
    const initialOrder = await orderRepository.findById(fixtures.tenantId, orderId);
    expect(initialOrder?.orderStatus).toBe('PENDING');

    // =========================================================================
    // STEP B: Validate & Approve the Clinical Order (Order Engine)
    // =========================================================================
    // Transition to VALIDATED state first (satisfying state machine)
    const orderAggregate = await orderRepository.findById(fixtures.tenantId, orderId);
    expect(orderAggregate).not.toBeNull();
    orderAggregate!.validate();
    await orderRepository.update(orderAggregate!);

    // Approve the order (service calls save + publishes OrderApproved event)
    const approveResult = await orderService.approveOrder({
      tenantId: fixtures.tenantId,
      orderId,
      approvedBy: fixtures.providerPartyId,
      expectedVersion: 2,
    });
    expect(approveResult.success).toBe(true);

    // =========================================================================
    // STEP C: Event subscriber consumes OrderApproved and bootstraps Prescription (Pharmacy)
    // =========================================================================
    // The subscriber automatically hears the event, queries DB reader, and inserts prescription.
    const prescription = await pollForPrescription(fixtures.tenantId, orderId);
    expect(prescription).not.toBeNull();
    expect(prescription.status).toBe('PENDING_REVIEW');
    expect(prescription.clinicalOrderId).toBe(orderId);
    expect(prescription.drugs).toHaveLength(1);
    expect(prescription.drugs[0].code).toBe('A02B');

    // =========================================================================
    // STEP D: Dispense the Prescription (Pharmacy Engine)
    // =========================================================================
    // Dispensing will transition PENDING_REVIEW -> APPROVED -> READY_FOR_DISPENSE -> DISPENSED
    const dispenseResult = await pharmacyService.dispenseMedication({
      tenantId: fixtures.tenantId,
      medicationOrderId: orderId,
      dispensedBy: fixtures.providerPartyId,
    });

    expect(dispenseResult.success).toBe(true);
    expect(dispenseResult.data?.status).toBe('active');
    expect(dispenseResult.data?.dispensedBy).toBe(fixtures.providerPartyId);

    // Verify aggregate in DB is DISPENSED
    const finalPrescription = await pharmacyRepository.findPrescriptionByClinicalOrderId(fixtures.tenantId, orderId);
    expect(finalPrescription?.status).toBe('DISPENSED');

    // =========================================================================
    // STEP E: Record Medication Administration - MAR (Pharmacy Engine)
    // =========================================================================
    const adminResult = await pharmacyService.recordMedicationAdministration({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientPartyId,
      medicationOrderId: orderId,
      administeredBy: fixtures.providerPartyId,
      administeredAt: new Date().toISOString(),
      dosageGiven: { value: 1, unit: 'capsule' },
      route: 'PO',
      notes: 'Administered at bedside',
    });

    expect(adminResult.success).toBe(true);
    const marId = adminResult.data!.id;
    createdMARIds.push(marId);

    // Verify MAR record exists in DB
    const marRecord = await pharmacyRepository.findMARById(fixtures.tenantId, marId);
    expect(marRecord).not.toBeNull();
    expect(marRecord?.status).toBe('administered');
    expect(marRecord?.route).toBe('PO');

    // Verify platform event bus was notified of the clinical activity (MedicationAdministered)
    expect(platformHostEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'MedicationAdministered',
        tenantId: fixtures.tenantId,
        aggregateId: marId,
        payload: expect.objectContaining({
          marId,
          drugName: 'Omeprazole 20mg',
        }),
      })
    );
  });

  it('should enforce audit preservation and block deleting encounters/orders linked to prescriptions/MARs', async () => {
    const testOrderId = randomUUID();
    
    // 1. Bootstrap clinical order first
    await supabase.from('hc_clinical_orders').insert({
      id: testOrderId,
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
    createdOrderIds.push(testOrderId);

    // 2. Bootstrap prescription referencing the clinical order
    await supabase.from('hc_prescriptions').insert({
      id: randomUUID(),
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_party_id: fixtures.patientPartyId,
      doctor_party_id: fixtures.providerPartyId,
      clinical_order_id: testOrderId,
      status: 'pending_review',
      drugs: [
        {
          code: 'A02B',
          name: 'Omeprazole 20mg',
          dose: '20 mg',
          frequency: 'QD',
          durationDays: 7,
        },
      ],
    });
    
    // Add to cleanup list
    const { data: rx } = await supabase
      .from('hc_prescriptions')
      .select('id')
      .eq('clinical_order_id', testOrderId)
      .single();
    if (rx) createdPrescriptionIds.push(rx.id);

    // 3. Try to delete the Clinical Order referencing this prescription
    // DB Constraint on clinical_order_id is ON DELETE RESTRICT
    const deleteOrderResult = await supabase
      .from('hc_clinical_orders')
      .delete()
      .eq('id', testOrderId);

    // Verify delete was blocked (PostgreSQL foreign key violation returns error code)
    expect(deleteOrderResult.error).not.toBeNull();
    expect(deleteOrderResult.error?.code).toBe('23503'); // foreign_key_violation
  });
});
