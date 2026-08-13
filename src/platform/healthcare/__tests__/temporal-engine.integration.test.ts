/**
 * Phase H9 — Temporal & Clinical History Engine Integration Tests (6 Gates)
 *
 * Verification Gates:
 * 1. Gate 1: Bitemporal Timeline Recording (valid_time vs transaction_time)
 * 2. Gate 2: Point-in-Time State Reconstruction (reconstructStateAt T1 vs T2)
 * 3. Gate 3: Late-Arriving Backdated Event Handling (valid_time vs transaction_time distinction)
 * 4. Gate 4: H8 CDS Decision Temporal Provenance Integration
 * 5. Gate 5: Immutable Timeline DB Triggers (UPDATE/DELETE blocked)
 * 6. Gate 6: Historical Point-in-Time Field Filtering Query
 *
 * @module platform/healthcare/__tests__/temporal-engine.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { TemporalEngineService } from '../engines/temporal-engine/temporal-engine.service';
import { CdsEngineService } from '../engines/cds-engine/cds-engine.service';

jest.setTimeout(30000);

describe('Temporal & Clinical History Engine H9 Integration Tests (6 Gates)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  let temporalEngine: TemporalEngineService;
  let cdsEngine: CdsEngineService;

  beforeEach(async () => {
    supabase = await createClient();
    fixtures = await HealthcareTestFixtures.setup();
    temporalEngine = new TemporalEngineService(supabase);
    cdsEngine = new CdsEngineService(supabase);

    // Clean up before starting
    await supabase.from('hc_decision_overrides').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_decisions').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_temporal_snapshots').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_temporal_events').delete().eq('tenant_id', fixtures.tenantId);
  });

  afterEach(async () => {
    await supabase.from('hc_decision_overrides').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_decisions').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_temporal_snapshots').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_temporal_events').delete().eq('tenant_id', fixtures.tenantId);
    await fixtures.cleanup();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 1: Bitemporal Timeline Recording
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 1: should record events into hc_temporal_events with valid_time and transaction_time', async () => {
    const validTime = new Date(Date.now() - 3600000).toISOString(); // 1 hr ago

    const res = await temporalEngine.recordTemporalEvent({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      aggregateType: 'Pharmacy',
      aggregateId: randomUUID(),
      eventType: 'hos.medication.prescribed.v1',
      validTime,
      deltaPayload: { drugCode: 'AMOXICILLIN-500', doseMg: 500 }
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.validTime).toBe(validTime);
    expect(res.data?.transactionTime).toBeDefined();

    // Verify database record
    const { data: record, error } = await supabase
      .from('hc_temporal_events')
      .select('*')
      .eq('tenant_id', fixtures.tenantId)
      .eq('id', res.data?.id)
      .single();

    expect(error).toBeNull();
    expect(record).toBeDefined();
    expect(record.aggregate_type).toBe('Pharmacy');
    expect(record.delta_payload.drugCode).toBe('AMOXICILLIN-500');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 2: Point-in-Time State Reconstruction
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 2: should reconstruct exact clinical state deltas at T1 vs T2', async () => {
    const t1 = new Date('2026-08-13T10:00:00Z').toISOString();
    const t1_mid = new Date('2026-08-13T10:15:00Z').toISOString();
    const t2 = new Date('2026-08-13T10:30:00Z').toISOString();
    const t2_after = new Date('2026-08-13T10:45:00Z').toISOString();

    // Event 1 at 10:00
    await temporalEngine.recordTemporalEvent({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      aggregateType: 'Encounter',
      aggregateId: randomUUID(),
      eventType: 'hos.allergy.recorded.v1',
      validTime: t1,
      deltaPayload: { allergenCode: 'PENICILLIN' }
    });

    // Event 2 at 10:30
    await temporalEngine.recordTemporalEvent({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      aggregateType: 'Pharmacy',
      aggregateId: randomUUID(),
      eventType: 'hos.medication.dispensed.v1',
      validTime: t2,
      deltaPayload: { drugCode: 'ASPIRIN-81' }
    });

    // Reconstruct at 10:15 (T1_mid) -> should have allergy but NO medication
    const stateMid = await temporalEngine.reconstructStateAt(
      fixtures.tenantId,
      fixtures.encounterId,
      t1_mid,
      'VALID_TIME'
    );

    expect(stateMid.success).toBe(true);
    expect(stateMid.data?.allergies).toHaveLength(1);
    expect(stateMid.data?.activeMedications).toHaveLength(0);

    // Reconstruct at 10:45 (T2_after) -> should have BOTH allergy and medication
    const stateAfter = await temporalEngine.reconstructStateAt(
      fixtures.tenantId,
      fixtures.encounterId,
      t2_after,
      'VALID_TIME'
    );

    expect(stateAfter.success).toBe(true);
    expect(stateAfter.data?.allergies).toHaveLength(1);
    expect(stateAfter.data?.activeMedications).toHaveLength(1);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 3: Late-Arriving Backdated Event Handling
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 3: should correctly distinguish valid_time vs transaction_time for backdated events', async () => {
    const validPastTime = new Date('2026-08-13T08:00:00Z').toISOString();
    const queryTimeEarly = new Date('2026-08-13T09:00:00Z').toISOString();
    const txLateTime = new Date('2026-08-13T14:00:00Z').toISOString();

    // Insert backdated event: valid_time = 08:00, but transaction_time = 14:00 (recorded late)
    await temporalEngine.recordTemporalEvent({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      aggregateType: 'Laboratory',
      aggregateId: randomUUID(),
      eventType: 'hos.lab.result_finalized.v1',
      validTime: validPastTime,
      transactionTime: txLateTime,
      deltaPayload: { testCode: 'K+', value: '3.2' }
    });

    // Querying by VALID_TIME at 09:00 -> includes event (since 08:00 <= 09:00)
    const validState = await temporalEngine.reconstructStateAt(
      fixtures.tenantId,
      fixtures.encounterId,
      queryTimeEarly,
      'VALID_TIME'
    );

    expect(validState.success).toBe(true);
    expect(validState.data?.labResults).toHaveLength(1);

    // Querying by TRANSACTION_TIME at 09:00 -> EXCLUDES event (since transaction_time NOW > 09:00)
    const txState = await temporalEngine.reconstructStateAt(
      fixtures.tenantId,
      fixtures.encounterId,
      queryTimeEarly,
      'TRANSACTION_TIME'
    );

    expect(txState.success).toBe(true);
    expect(txState.data?.labResults).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 4: H8 CDS Decision Temporal Provenance Integration
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 4: should retrieve full temporal audit context for an H8 decision', async () => {
    const drugCode = `CEF-${randomUUID().slice(0, 6)}`;

    // 1. Evaluate CDS decision via H8 engine
    const evalRes = await cdsEngine.evaluate({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionContext: { proposedDrugCode: drugCode, actionType: 'PRESCRIBE' }
    });

    expect(evalRes.success).toBe(true);
    const decisionId = evalRes.data?.calculationId;
    expect(decisionId).toBeDefined();

    // 2. Fetch temporal audit context for decision
    const auditRes = await temporalEngine.getDecisionTemporalContext(
      fixtures.tenantId,
      decisionId!
    );

    expect(auditRes.success).toBe(true);
    expect(auditRes.data).toBeDefined();
    expect(auditRes.data?.decisionId).toBe(decisionId);
    expect(auditRes.data?.evaluationFingerprint).toBeDefined();
    expect(auditRes.data?.temporalSnapshot).toBeDefined();
    expect(auditRes.data?.auditProvenanceMatch).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 5: Immutable Timeline DB Triggers
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 5: should block updates or deletions on temporal tables via DB triggers', async () => {
    const res = await temporalEngine.recordTemporalEvent({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      aggregateType: 'Encounter',
      aggregateId: randomUUID(),
      eventType: 'hos.vital_signs.recorded.v1',
      validTime: new Date().toISOString(),
      deltaPayload: { bp: '120/80' }
    });

    expect(res.success).toBe(true);
    const eventId = res.data?.id;

    // Try updating record -> should fail by trigger
    const updateRes = await supabase
      .from('hc_temporal_events')
      .update({ aggregate_type: 'Tampered' })
      .eq('id', eventId);

    expect(updateRes.error).toBeDefined();
    expect(updateRes.error?.message).toContain('strictly append-only');

    // Try deleting record -> should fail by trigger
    const deleteRes = await supabase
      .from('hc_temporal_events')
      .delete()
      .eq('id', eventId);

    expect(deleteRes.error).toBeDefined();
    expect(deleteRes.error?.message).toContain('strictly append-only');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 6: Historical Point-in-Time Querying API
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 6: should filter and return targeted clinical state fields from historical query', async () => {
    const validTime = new Date().toISOString();

    await temporalEngine.recordTemporalEvent({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      aggregateType: 'Pharmacy',
      aggregateId: randomUUID(),
      eventType: 'hos.medication.prescribed.v1',
      validTime,
      deltaPayload: { drugCode: 'METFORMIN-500' }
    });

    const queryRes = await temporalEngine.queryHistoricalState({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      targetTime: validTime,
      includeFields: ['MEDICATIONS']
    });

    expect(queryRes.success).toBe(true);
    expect(queryRes.data?.activeMedications).toBeDefined();
    expect(queryRes.data?.allergies).toBeUndefined();
    expect(queryRes.data?.labResults).toBeUndefined();
  });
});
