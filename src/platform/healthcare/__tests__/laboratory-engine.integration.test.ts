import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { InMemoryEventBus } from '../engines/order-engine/contracts/event-bus.interface';
import { SupabaseLaboratoryRepository } from '../engines/laboratory-engine/repositories/supabase-laboratory.repository';
import { SupabaseClinicalOrderReader } from '../engines/laboratory-engine/repositories/supabase-clinical-order-reader';
import { LaboratoryEngineService } from '../engines/laboratory-engine/laboratory-engine.service';
import { LabOrderApprovedSubscriber } from '../engines/laboratory-engine/events/order-approved-subscriber';
import { LabOrder } from '../engines/laboratory-engine/domain/lab-order.entity';
import { TEST_DEFINITIONS } from '../engines/laboratory-engine/domain/test-definition';
import { ConcurrencyViolationError } from '../engines/laboratory-engine/repositories/laboratory-repository.interface';

jest.setTimeout(30000);

describe('Laboratory Engine Integration Tests (6 Gates)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  let eventBus: InMemoryEventBus;
  let repository: SupabaseLaboratoryRepository;
  let reader: SupabaseClinicalOrderReader;
  let service: LaboratoryEngineService;
  let subscriber: LabOrderApprovedSubscriber;

  let validUserId: string;
  let createdUserIds: string[] = [];
  let createdOrderIds: string[] = [];
  let createdLabOrderIds: string[] = [];

  beforeEach(async () => {
    fixtures = await HealthcareTestFixtures.setup();
    supabase = await createClient();
    eventBus = new InMemoryEventBus();
    repository = new SupabaseLaboratoryRepository(supabase);
    reader = new SupabaseClinicalOrderReader(supabase);
    service = new LaboratoryEngineService(repository, eventBus);
    subscriber = new LabOrderApprovedSubscriber(eventBus, repository, reader);

    // Dynamic User Bootstrap (Resolves foreign key verified_by constraints)
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users.length > 0) {
      validUserId = users[0].id;
    } else {
      validUserId = randomUUID();
      createdUserIds.push(validUserId);
      await supabase.from('users').insert({
        id: validUserId,
        tenant_id: fixtures.tenantId,
        email: `tech-${validUserId}@bella.vn`,
        role: 'practitioner',
        full_name: 'Test Technician',
      });
    }
  });

  afterEach(async () => {
    // Cleanup database records in dependency order
    if (createdLabOrderIds.length > 0) {
      await supabase.from('hc_lab_orders').delete().in('id', createdLabOrderIds);
    }
    if (createdOrderIds.length > 0) {
      await supabase.from('hc_clinical_orders').delete().in('id', createdOrderIds);
    }
    if (createdUserIds.length > 0) {
      await supabase.from('users').delete().in('id', createdUserIds);
    }
  });

  // =========================================================================
  // Gate 1: Domain State Machine Transitions
  // =========================================================================
  it('Gate 1 — Domain State Machine: should enforce sequential state transitions and prevent skips', async () => {
    const clinicalOrderId = randomUUID();
    const labOrderId = randomUUID();
    createdOrderIds.push(clinicalOrderId);
    createdLabOrderIds.push(labOrderId);

    // Bootstrap clinical order in db
    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientPartyId,
      order_type: 'laboratory',
      status: 'placed',
    });

    // Create LabOrder row directly
    const labOrder = LabOrder.create({
      id: labOrderId,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'ORDERED',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(labOrder);

    // Skip directly to verify result (must fail)
    await expect(service.verifyResult(fixtures.tenantId, labOrderId, validUserId)).rejects.toThrow('Invalid state transition');

    // Progress step-by-step
    await service.collectSpecimen(fixtures.tenantId, labOrderId, 'Serum', 'Gold');
    await service.receiveSpecimen(fixtures.tenantId, labOrderId);
    await service.startProcessing(fixtures.tenantId, labOrderId);
    await service.recordResult(fixtures.tenantId, labOrderId, '4.2', 'mEq/L');
    const verified = await service.verifyResult(fixtures.tenantId, labOrderId, validUserId);

    expect(verified.status).toBe('VERIFIED');
    expect(verified.safetyState).toBe('NORMAL');

    // Attempting to collect or verify again must fail
    await expect(service.collectSpecimen(fixtures.tenantId, labOrderId, 'Serum', 'Gold')).rejects.toThrow('Invalid state transition');
  });

  // =========================================================================
  // Gate 2: Diagnostic Range Safety
  // =========================================================================
  it('Gate 2 — Diagnostic Range Safety: should correctly classify normal, abnormal, and critical ranges', async () => {
    const clinicalOrderId = randomUUID();
    const labOrderIdKNormal = randomUUID();
    const labOrderIdKCritical = randomUUID();
    const labOrderIdGluAbnormal = randomUUID();

    createdOrderIds.push(clinicalOrderId);
    createdLabOrderIds.push(labOrderIdKNormal, labOrderIdKCritical, labOrderIdGluAbnormal);

    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientPartyId,
      order_type: 'laboratory',
      status: 'placed',
    });

    // 1. Normal Potassium (K = 4.0)
    const loNormal = LabOrder.create({
      id: labOrderIdKNormal,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(loNormal);
    await service.recordResult(fixtures.tenantId, labOrderIdKNormal, '4.0', 'mEq/L');
    const normalVerified = await service.verifyResult(fixtures.tenantId, labOrderIdKNormal, validUserId);
    expect(normalVerified.result?.assessment).toBe('NORMAL');

    // 2. Critical Potassium (K = 7.2)
    const loCritical = LabOrder.create({
      id: labOrderIdKCritical,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(loCritical);
    await service.recordResult(fixtures.tenantId, labOrderIdKCritical, '7.2', 'mEq/L');
    const criticalVerified = await service.verifyResult(fixtures.tenantId, labOrderIdKCritical, validUserId);
    expect(criticalVerified.result?.assessment).toBe('CRITICAL');
    expect(criticalVerified.safetyState).toBe('ESCALATION_REQUIRED');

    // 3. Abnormal Glucose (GLU = 135)
    const loAbnormal = LabOrder.create({
      id: labOrderIdGluAbnormal,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'GLU',
      testName: 'Glucose',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(loAbnormal);
    await service.recordResult(fixtures.tenantId, labOrderIdGluAbnormal, '135', 'mg/dL');
    const abnormalVerified = await service.verifyResult(fixtures.tenantId, labOrderIdGluAbnormal, validUserId);
    expect(abnormalVerified.result?.assessment).toBe('ABNORMAL');
    expect(abnormalVerified.safetyState).toBe('NORMAL');
  });

  // =========================================================================
  // Gate 3: Critical Acknowledgment Safety
  // =========================================================================
  it('Gate 3 — Critical Acknowledgment Safety: should enforce active clinician safety acknowledgment of panic values', async () => {
    const clinicalOrderId = randomUUID();
    const labOrderId = randomUUID();
    createdOrderIds.push(clinicalOrderId);
    createdLabOrderIds.push(labOrderId);

    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientPartyId,
      order_type: 'laboratory',
      status: 'placed',
    });

    const labOrder = LabOrder.create({
      id: labOrderId,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(labOrder);

    await service.recordResult(fixtures.tenantId, labOrderId, '1.9', 'mEq/L');
    const verified = await service.verifyResult(fixtures.tenantId, labOrderId, validUserId);

    expect(verified.safetyState).toBe('ESCALATION_REQUIRED');
    expect(verified.escalationRequired).toBe(true);

    // Clinical acknowledgment clears escalation required
    const acknowledged = await service.acknowledgeCritical(fixtures.tenantId, labOrderId, validUserId);
    expect(acknowledged.safetyState).toBe('ACKNOWLEDGED');
    expect(acknowledged.escalationRequired).toBe(false);
    expect(acknowledged.acknowledgedBy).toBe(validUserId);
    expect(acknowledged.acknowledgedAt).toBeDefined();
  });

  // =========================================================================
  // Gate 4: Kernel Boundary Isolation
  // =========================================================================
  it('Gate 4 — Kernel Boundary Isolation: should handle OrderApproved event and query reader with zero model leak', async () => {
    const clinicalOrderId = randomUUID();
    const labOrderId = randomUUID();
    createdOrderIds.push(clinicalOrderId);
    createdLabOrderIds.push(labOrderId);

    // Insert order in db
    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientPartyId,
      order_type: 'laboratory',
      status: 'placed',
    });

    // Seed relationship row in hc_lab_orders so reader can discover test items dynamically
    await supabase.from('hc_lab_orders').insert({
      id: labOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      clinical_order_id: clinicalOrderId,
      test_code: 'K',
      test_name: 'Potassium',
    });

    // Clear event bus and trigger OrderApproved event
    eventBus.clear();
    await eventBus.publish({
      eventType: 'OrderApproved',
      tenantId: fixtures.tenantId,
      aggregateId: clinicalOrderId,
      payload: {
        approvedBy: validUserId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'laboratory',
      },
    });

    // Check that LabOrderApprovedSubscriber reacted and loaded the aggregate
    const lo = await repository.findById(fixtures.tenantId, labOrderId);
    expect(lo).not.toBeNull();
    expect(lo?.status).toBe('ORDERED');
  });

  // =========================================================================
  // Gate 5: Event-After-Persistence
  // =========================================================================
  it('Gate 5 — Event-After-Persistence: should verify correct event publish ordering and rollback safety', async () => {
    const clinicalOrderId = randomUUID();
    const labOrderId = randomUUID();
    const failedLabOrderId = randomUUID();
    createdOrderIds.push(clinicalOrderId);
    createdLabOrderIds.push(labOrderId, failedLabOrderId);

    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientPartyId,
      order_type: 'laboratory',
      status: 'placed',
    });

    const labOrder = LabOrder.create({
      id: labOrderId,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(labOrder);

    // CASE A & C: Critical result successfully verified publishes both verified and escalated events after save
    await service.recordResult(fixtures.tenantId, labOrderId, '8.0', 'mEq/L');
    
    eventBus.clear();
    await service.verifyResult(fixtures.tenantId, labOrderId, validUserId);

    const published = eventBus.getPublishedEvents();
    expect(published.length).toBe(2);
    expect(published[0].eventType).toBe('ResultVerified');
    expect(published[1].eventType).toBe('CriticalResultEscalated');

    // CASE B: Suppress events if save fails
    const failedOrder = LabOrder.create({
      id: failedLabOrderId,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(failedOrder);
    await service.recordResult(fixtures.tenantId, failedLabOrderId, '8.0', 'mEq/L');

    const brokenRepository = new SupabaseLaboratoryRepository(supabase);
    // Force save to reject
    brokenRepository.save = jest.fn<any>().mockRejectedValue(new Error('Simulated network database collapse'));
    const brokenService = new LaboratoryEngineService(brokenRepository, eventBus);

    eventBus.clear();
    await expect(brokenService.verifyResult(fixtures.tenantId, failedLabOrderId, validUserId)).rejects.toThrow('Simulated network database collapse');

    // ZERO events should be emitted
    expect(eventBus.getPublishedEvents().length).toBe(0);
  });

  // =========================================================================
  // Gate 6: Concurrent Verification Defense
  // =========================================================================
  it('Gate 6 — Concurrent Verification: should defend against race conditions and enforce exactly one verification update', async () => {
    const clinicalOrderId = randomUUID();
    const labOrderId = randomUUID();
    createdOrderIds.push(clinicalOrderId);
    createdLabOrderIds.push(labOrderId);

    await supabase.from('hc_clinical_orders').insert({
      id: clinicalOrderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientPartyId,
      order_type: 'laboratory',
      status: 'placed',
    });

    const labOrder = LabOrder.create({
      id: labOrderId,
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      clinicalOrderId,
      patientId: fixtures.patientPartyId,
      testCode: 'K',
      testName: 'Potassium',
      status: 'PROCESSING',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(labOrder);

    // Record result to transition state to RESULTED
    await service.recordResult(fixtures.tenantId, labOrderId, '3.8', 'mEq/L');

    // Fire parallel verifyResult requests using Promise.all to simulate a race condition (Gate 6)
    const verificationAttempts = [
      service.verifyResult(fixtures.tenantId, labOrderId, validUserId),
      service.verifyResult(fixtures.tenantId, labOrderId, validUserId)
    ];

    const results = await Promise.allSettled(verificationAttempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed, the other must fail with a ConcurrencyViolationError
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error instanceof ConcurrencyViolationError || error.message.includes('Optimistic concurrency')).toBe(true);
  });
});
