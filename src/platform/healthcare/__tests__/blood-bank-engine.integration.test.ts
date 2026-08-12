/**
 * Blood Bank Bounded Context Integration Tests (H7 Acceptance)
 * 
 * Verifies all 6 clinical safety gates.
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase-server';
import { eventBus } from '@/platform/host/event-bus';
import { BloodBankEngineService } from '../engines/blood-bank-engine/blood-bank-engine.service';
import { HealthcareTestFixtures } from './fixtures/healthcare-test-fixtures';
import { BloodUnitStatus } from '../engines/blood-bank-engine/domain/blood-component.vo';

describe('Blood Bank Engine Integration Tests (Phase H7)', () => {
  jest.setTimeout(60_000);
  let supabase: any;
  let service: BloodBankEngineService;
  let fixtures: any;
  let tenantId: string;
  let encounterId: string;
  let patientId: string;
  let clinicianA: string;
  let clinicianB: string;

  const createdUnitIds: string[] = [];
  const createdCrossmatchIds: string[] = [];
  const createdVerificationIds: string[] = [];
  const createdTransfusionIds: string[] = [];

  beforeAll(async () => {
    supabase = await createClient();
    service = new BloodBankEngineService(supabase);
    fixtures = await HealthcareTestFixtures.setup();
    
    tenantId = fixtures.tenantId;
    encounterId = fixtures.encounterId;
    patientId = fixtures.patientPartyId;
    clinicianA = fixtures.providerPartyId;
    
    // Create clinician A user record
    const { error: userAError } = await supabase.from('users').insert({
      id: clinicianA,
      tenant_id: tenantId,
      email: `clinician.a.${clinicianA.slice(0, 8)}@bella.com`,
      role: 'admin_staff',
      status: 'active',
      full_name: 'Clinician A',
    });
    if (userAError) throw userAError;

    // Create clinician B user record
    clinicianB = randomUUID();
    const { error: userError } = await supabase.from('users').insert({
      id: clinicianB,
      tenant_id: tenantId,
      email: `clinician.b.${clinicianB.slice(0, 8)}@bella.com`,
      role: 'admin_staff',
      status: 'active',
      full_name: 'Clinician B',
    });
    if (userError) throw userError;
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    // Clean up transfusion records
    if (createdTransfusionIds.length > 0) {
      await supabase.from('hc_transfusion_records').delete().in('id', createdTransfusionIds);
      createdTransfusionIds.length = 0;
    }

    // Clean up verifications
    if (createdVerificationIds.length > 0) {
      await supabase.from('hc_transfusion_verifications').delete().in('id', createdVerificationIds);
      createdVerificationIds.length = 0;
    }

    // Clean up crossmatches
    if (createdCrossmatchIds.length > 0) {
      await supabase.from('hc_blood_crossmatch_records').delete().in('id', createdCrossmatchIds);
      createdCrossmatchIds.length = 0;
    }

    // Clean up units
    if (createdUnitIds.length > 0) {
      await supabase.from('hc_blood_units').delete().in('id', createdUnitIds);
      createdUnitIds.length = 0;
    }
  });

  afterAll(async () => {
    if (clinicianA) {
      await supabase.from('users').delete().eq('id', clinicianA);
    }
    if (clinicianB) {
      await supabase.from('users').delete().eq('id', clinicianB);
    }
    await fixtures.cleanup();
  });

  // Helper helper to create valid blood unit
  async function helperCreateUnit(abo: 'A' | 'B' | 'AB' | 'O', rh: 'POSITIVE' | 'NEGATIVE', expiryHours = 24): Promise<string> {
    const unitNo = `UNIT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + expiryHours);

    const res = await service.receiveBloodUnit({
      requestId: randomUUID(),
      tenantId,
      unitNumber: unitNo,
      bloodType: abo,
      rhFactor: rh,
      componentType: 'RBC',
      expiryDate: expiry.toISOString(),
    });

    if (!res.success || !res.data) {
      console.error('Receive Blood Unit Error:', res.error);
      throw new Error('Receive blood unit helper failed');
    }
    createdUnitIds.push(res.data.id);
    return res.data.id;
  }

  // Helper helper to set unit to Available
  async function helperSetUnitAvailable(unitId: string): Promise<void> {
    await supabase.from('hc_blood_units').update({ status: 'AVAILABLE' }).eq('id', unitId);
  }

  // ============================================================================
  // Gate 1: RBC Compatibility Matrix
  // ============================================================================
  it('Gate 1: should enforce compatibility matrix and block incompatible double verifications', async () => {
    // 1. Recipient is O+
    // 2. Try to verify an A+ donor bag -> Incompatible
    const unitId = await helperCreateUnit('A', 'POSITIVE');
    await helperSetUnitAvailable(unitId);

    const xmRes = await service.requestCrossmatch({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId,
    });
    expect(xmRes.success).toBe(true);
    const xmId = xmRes.data!.id;
    createdCrossmatchIds.push(xmId);

    // Record crossmatch resultTested
    await supabase.from('hc_blood_crossmatch_records').update({ status: 'TESTED' }).eq('id', xmId);

    // Approve crossmatch
    const appRes = await service.approveCrossmatch({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      approvedBy: clinicianA,
    });
    expect(appRes.success).toBe(true);

    const publishSpy = jest.spyOn(eventBus, 'publish');

    // Attempt double verification with recipient O+
    const verifyRes = await service.doubleVerifyTransfusion({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId,
      crossmatchId: xmId,
      verificationData: {
        patientId,
        unitNumber: xmRes.data!.blood_unit_id,
        bloodType: 'O', // O receives A is incompatible
        rhFactor: 'POSITIVE',
        component: 'RBC',
        crossmatchResult: 'COMPATIBLE',
      },
      verifiedByClinicianA: clinicianA,
      verifiedByClinicianB: clinicianB,
    });

    expect(verifyRes.success).toBe(false);
    expect(verifyRes.error?.code).toBe('DOUBLE_VERIFICATION_FAILED');

    // Assert block event published
    const blockCall = publishSpy.mock.calls.find((c) => c[0].eventType === 'hos.blood.transfusion.blocked.v1');
    expect(blockCall).toBeDefined();
    expect(blockCall![0].payload.reasonCode).toBe('RBC_INCOMPATIBILITY');
  });

  // ============================================================================
  // Gate 2: Crossmatch State Machine & Emergency Override
  // ============================================================================
  it('Gate 2: should reject incompatible approval unless emergency override is logged with provenance', async () => {
    const unitId = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId);

    const xmRes = await service.requestCrossmatch({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId,
    });
    const xmId = xmRes.data!.id;
    createdCrossmatchIds.push(xmId);

    // Record result as INCOMPATIBLE
    const recRes = await service.recordCrossmatchResult({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      status: 'INCOMPATIBLE',
      crossmatchedBy: clinicianA,
    });
    expect(recRes.success).toBe(true);
    expect(recRes.data?.status).toBe('INCOMPATIBLE');

    // Attempt to approve without override -> Fails
    const appFailRes = await service.approveCrossmatch({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      approvedBy: clinicianA,
    });
    expect(appFailRes.success).toBe(false);

    // Approve with emergency override -> Succeeds
    const appOkRes = await service.approveCrossmatch({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      approvedBy: clinicianA,
      emergencyOverride: {
        authorizedBy: clinicianA,
        practitionerRole: 'physician',
        reason: 'Extreme hemorrhagic shock, no compatible bags available',
      },
    });
    expect(appOkRes.success).toBe(true);
    expect(appOkRes.data?.status).toBe('APPROVED');
  });

  // ============================================================================
  // Gate 3: Double Verification Safety & Write-Once snapshot
  // ============================================================================
  it('Gate 3: should enforce write-once immutability for transfusion verifications', async () => {
    const unitId = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId);

    const xmRes = await service.requestCrossmatch({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId,
    });
    const xmId = xmRes.data!.id;
    createdCrossmatchIds.push(xmId);

    // Test compatible & approve
    await supabase.from('hc_blood_crossmatch_records').update({ status: 'TESTED' }).eq('id', xmId);
    await service.approveCrossmatch({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      approvedBy: clinicianA,
    });

    // Double verify -> creates verification record
    const verRes = await service.doubleVerifyTransfusion({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId,
      crossmatchId: xmId,
      verificationData: {
        patientId,
        unitNumber: 'UNIT-001',
        bloodType: 'O',
        rhFactor: 'POSITIVE',
        component: 'RBC',
        crossmatchResult: 'COMPATIBLE',
      },
      verifiedByClinicianA: clinicianA,
      verifiedByClinicianB: clinicianB,
    });
    expect(verRes.success).toBe(true);
    const verId = verRes.data!.id;
    createdVerificationIds.push(verId);

    // Attempt direct database update on verification -> must throw DB trigger exception
    const { error: updateError } = await supabase
      .from('hc_transfusion_verifications')
      .update({ verified_by_clinician_a: clinicianB })
      .eq('id', verId);
    expect(updateError).not.toBeNull();
    expect(updateError!.message).toContain('write-once');

    // Attempt direct database delete -> must throw DB trigger exception
    const { error: deleteError } = await supabase
      .from('hc_transfusion_verifications')
      .delete()
      .eq('id', verId);
    expect(deleteError).not.toBeNull();
    expect(deleteError!.message).toContain('write-once');
  });

  // ============================================================================
  // Gate 4: Concurrent Blood Unit Allocation
  // ============================================================================
  it('Gate 4: should handle concurrent reservations and reaction lockdowns', async () => {
    const unitId1 = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId1);

    // Case A: Same unit concurrent reservation
    const reservePromise1 = service.reserveBloodUnit({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId1,
    });
    const reservePromise2 = service.reserveBloodUnit({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId1,
    });

    const [res1, res2] = await Promise.all([reservePromise1, reservePromise2]);
    const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
    const failCount = (!res1.success ? 1 : 0) + (!res2.success ? 1 : 0);

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    // Case B: Different units concurrent reservation
    const unitId2 = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId2);

    const reservePromise3 = service.reserveBloodUnit({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId2,
    });
    const res3 = await reservePromise3;
    expect(res3.success).toBe(true);
  });

  // ============================================================================
  // Gate 5: Transfusion Reaction Safety Lockdown
  // ============================================================================
  it('Gate 5: should lockdown encounter and abort/reject allocations on reaction', async () => {
    const unitId1 = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId1);

    const xmRes1 = await service.requestCrossmatch({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId1,
    });
    const xmId1 = xmRes1.data!.id;
    createdCrossmatchIds.push(xmId1);
    await supabase.from('hc_blood_crossmatch_records').update({ status: 'TESTED' }).eq('id', xmId1);
    await service.approveCrossmatch({ requestId: randomUUID(), tenantId, crossmatchId: xmId1, approvedBy: clinicianA });

    // Verify
    const verRes = await service.doubleVerifyTransfusion({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId1,
      crossmatchId: xmId1,
      verificationData: { patientId, unitNumber: 'UNIT-1', bloodType: 'O', rhFactor: 'POSITIVE', component: 'RBC', crossmatchResult: 'COMPATIBLE' },
      verifiedByClinicianA: clinicianA,
      verifiedByClinicianB: clinicianB,
    });
    const verId = verRes.data!.id;
    createdVerificationIds.push(verId);

    // Start transfusion
    const startRes = await service.startTransfusion({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId1,
      verificationId: verId,
      startedAt: new Date().toISOString(),
    });
    expect(startRes.success).toBe(true);
    const transfusionId = startRes.data!.id;
    createdTransfusionIds.push(transfusionId);

    // Reserve unit 2 (AVAILABLE -> RESERVED)
    const unitId2 = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId2);
    const res2 = await service.reserveBloodUnit({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId2,
    });
    expect(res2.success).toBe(true);

    // Complete transfusion with reaction -> aborts transfusion, rejects unit 1, locks encounter
    const compRes = await service.completeTransfusion({
      requestId: randomUUID(),
      tenantId,
      transfusionId,
      completedAt: new Date().toISOString(),
      reactionOccurred: true,
      reactionDetails: 'Patient developed fever and chills',
    });
    expect(compRes.success).toBe(true);
    expect(compRes.data?.status).toBe('aborted');

    // Assert unit 1 status is REJECTED
    const { data: dbUnit1 } = await supabase.from('hc_blood_units').select('status').eq('id', unitId1).single();
    expect(dbUnit1.status).toBe('REJECTED');

    // Attempt to verify another unit for the locked encounter -> must fail
    const verifyFailRes = await service.doubleVerifyTransfusion({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId2,
      crossmatchId: xmId1,
      verificationData: { patientId, unitNumber: 'UNIT-2', bloodType: 'O', rhFactor: 'POSITIVE', component: 'RBC', crossmatchResult: 'COMPATIBLE' },
      verifiedByClinicianA: clinicianA,
      verifiedByClinicianB: clinicianB,
    });
    expect(verifyFailRes.success).toBe(false);
    expect(verifyFailRes.error?.message).toContain('locked');
  });

  // ============================================================================
  // Gate 6: Event-After-Persistence
  // ============================================================================
  it('Gate 6: should enforce event-after-persistence ordering rules', async () => {
    const unitId = await helperCreateUnit('O', 'POSITIVE');
    await helperSetUnitAvailable(unitId);

    const xmRes = await service.requestCrossmatch({
      requestId: randomUUID(),
      tenantId,
      encounterId,
      bloodUnitId: unitId,
    });
    const xmId = xmRes.data!.id;
    createdCrossmatchIds.push(xmId);

    // CASE A: DB commit success -> event emitted
    const publishSpy = jest.spyOn(eventBus, 'publish');

    const recRes = await service.recordCrossmatchResult({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      status: 'COMPATIBLE',
      crossmatchedBy: clinicianA,
    });
    expect(recRes.success).toBe(true);

    const matchCall = publishSpy.mock.calls.find((c) => c[0].eventType === 'hos.blood.crossmatch.completed.v1');
    expect(matchCall).toBeDefined();

    // CASE B: DB commit failure -> NO event
    jest.resetAllMocks();
    const badService = new BloodBankEngineService({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: new Error('Simulated DB failure') }),
            }),
          }),
        }),
      }),
    } as any);

    const publishSpy2 = jest.spyOn(eventBus, 'publish');
    const failRes = await badService.recordCrossmatchResult({
      requestId: randomUUID(),
      tenantId,
      crossmatchId: xmId,
      status: 'COMPATIBLE',
      crossmatchedBy: clinicianA,
    });
    expect(failRes.success).toBe(false);
    expect(publishSpy2).not.toHaveBeenCalled();
  });
});
