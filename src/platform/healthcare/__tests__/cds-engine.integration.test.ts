import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { CdsEngineService } from '../engines/cds-engine/cds-engine.service';
import { CdsEventHandler } from '../engines/cds-engine/events/cds-event-handler';
import { eventBus } from '@/platform/host/event-bus';

jest.setTimeout(30000);

describe('CDS Engine H8 Integration Tests (6 Gates)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  let cdsEngine: CdsEngineService;
  let cdsEventHandler: CdsEventHandler;

  beforeEach(async () => {
    supabase = await createClient();
    fixtures = await HealthcareTestFixtures.setup();
    cdsEngine = new CdsEngineService(supabase);
    cdsEventHandler = new CdsEventHandler(supabase);

    // Clean up before starting to ensure clean state
    await supabase.from('hc_decision_overrides').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_decisions').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_cds_rules').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_context_snapshots').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_cds_processed_events').delete().eq('tenant_id', fixtures.tenantId);
  });

  afterEach(async () => {
    // Cleanup generated database records
    await supabase.from('hc_decision_overrides').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_decisions').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_cds_rules').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_clinical_context_snapshots').delete().eq('tenant_id', fixtures.tenantId);
    await supabase.from('hc_cds_processed_events').delete().eq('tenant_id', fixtures.tenantId);
    await fixtures.cleanup();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 1: Fresh Context Projection
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 1: should project inbound events into the context snapshot read model', async () => {
    const eventId = randomUUID();
    
    // Publish AllergyRecorded event via global eventBus
    await eventBus.publish({
      eventType: 'hos.allergy.recorded.v1',
      eventId,
      timestamp: new Date().toISOString(),
      tenantId: fixtures.tenantId,
      aggregateId: randomUUID(),
      aggregateType: 'Allergy',
      payload: {
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientId,
        allergenType: 'DRUG',
        allergenCode: 'PENICILLIN-500',
        allergenName: 'Penicillin V',
        reactionType: 'ANAPHYLAXIS',
        severity: 'LIFE_THREATENING'
      },
      userId: 'test-doc'
    });

    // Wait a brief moment for the event subscriber to complete DB transaction
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Retrieve projected snapshot from database
    const { data: snapshot, error } = await supabase
      .from('hc_clinical_context_snapshots')
      .select('*')
      .eq('tenant_id', fixtures.tenantId)
      .eq('encounter_id', fixtures.encounterId)
      .single();

    expect(error).toBeNull();
    expect(snapshot).toBeDefined();
    expect(snapshot.projection_status).toBe('FRESH');
    expect(snapshot.patient_id).toBe(fixtures.patientId);
    expect(snapshot.allergies).toHaveLength(1);
    
    const allergyList = snapshot.allergies as any[];
    expect(allergyList[0].allergen_code).toBe('PENICILLIN-500');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 2: Dynamic Freshness Check
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 2: should dynamically evaluate snapshot as STALE if last processed event > 300s', async () => {
    const oldTimestamp = new Date(Date.now() - 360000).toISOString(); // 360s ago
    const drugCode = `CEF-${randomUUID().slice(0, 6)}`;

    // Manually insert stale snapshot
    await supabase.from('hc_clinical_context_snapshots').insert({
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientId,
      allergies: [],
      active_medications: [],
      projection_status: 'FRESH',
      last_processed_event_at: oldTimestamp,
      last_event_sequence: 12345
    });

    // Evaluate proposed drug
    const res = await cdsEngine.evaluate({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionContext: {
        proposedDrugCode: drugCode,
        actionType: 'PRESCRIBE'
      }
    });

    if (!res.success) console.error('EVALUATE ERROR:', res.error);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();

    // Query recorded decision to check evaluated snapshot status
    const { data: decision, error } = await supabase
      .from('hc_clinical_decisions')
      .select('input_snapshot')
      .eq('tenant_id', fixtures.tenantId)
      .eq('encounter_id', fixtures.encounterId)
      .single();

    if (error) console.error('Query decision error:', error);
    expect(decision).toBeDefined();
    expect(decision?.input_snapshot.snapshotStatus).toBe('STALE');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 3: Double Barrier Escalation
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 3: should escalate alerts to BLOCK when context snapshot is stale (escalation-only policy)', async () => {
    // Seed drugs to satisfy foreign key constraint on hc_drug_interactions if not exists
    const { data: existingDrugA } = await supabase.from('hc_drugs').select('id').eq('drug_code', 'PARACETAMOL').maybeSingle();
    if (!existingDrugA) {
      await supabase.from('hc_drugs').insert({
        drug_code: 'PARACETAMOL',
        drug_class: 'ANALGESIC',
        drug_name: 'Paracetamol',
        kb_version: '1.0',
        is_active: true
      });
    }

    const { data: existingDrugB } = await supabase.from('hc_drugs').select('id').eq('drug_code', 'WARFARIN').maybeSingle();
    if (!existingDrugB) {
      await supabase.from('hc_drugs').insert({
        drug_code: 'WARFARIN',
        drug_class: 'ANTICOAGULANT',
        drug_name: 'Warfarin',
        kb_version: '1.0',
        is_active: true
      });
    }

    // 1. Seed or retrieve a drug interaction rule
    let ddi;
    const { data: existingDdi } = await supabase
      .from('hc_drug_interactions')
      .select('*')
      .eq('drug_a_code', 'PARACETAMOL')
      .eq('drug_b_code', 'WARFARIN')
      .maybeSingle();

    if (existingDdi) {
      ddi = existingDdi;
    } else {
      const { data: insertedDdi, error: ddiErr } = await supabase.from('hc_drug_interactions').insert({
        id: randomUUID(),
        drug_a_code: 'PARACETAMOL',
        drug_b_code: 'WARFARIN',
        severity: 'WARNING',
        enforcement: 'ACKNOWLEDGE', // Soft warning
        clinical_effect: 'May increase anticoagulation',
        evidence_level: 'B',
        kb_version: '1.0',
        is_active: true
      }).select().single();
      
      if (ddiErr) console.error('DDI Rule Seed Error:', ddiErr);
      ddi = insertedDdi;
    }

    expect(ddi).toBeDefined();

    // 2. Insert stale context snapshot containing WARFARIN as active medication
    const oldTimestamp = new Date(Date.now() - 360000).toISOString();
    await supabase.from('hc_clinical_context_snapshots').insert({
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientId,
      allergies: [],
      active_medications: [{ code: 'WARFARIN' }],
      projection_status: 'FRESH',
      last_processed_event_at: oldTimestamp,
      last_event_sequence: 12345
    });

    // 3. Evaluate PARACETAMOL prescribing
    const res = await cdsEngine.evaluate({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionContext: {
        proposedDrugCode: 'PARACETAMOL',
        actionType: 'PRESCRIBE'
      }
    });

    // Verify it is hard blocked or normal block because snapshot is STALE
    if (!res.success) console.error('EVALUATE ERROR:', res.error);
    expect(res.success).toBe(true);
    expect(res.data?.passed).toBe(false);
    expect(res.data?.alerts[0].enforcement).toBe('BLOCK');
    expect(res.data?.alerts[0].severity).toBe('CRITICAL');
    expect(res.data?.alerts[0].message).toContain('STALE clinical context');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 4: Deterministic Decision Idempotency
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 4: should return cached decision for identical action contexts (SHA-256 fingerprinting)', async () => {
    const drugCode = `AMOX-${randomUUID().slice(0, 6)}`;

    // 1. Perform first evaluation
    const res1 = await cdsEngine.evaluate({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionContext: {
        proposedDrugCode: drugCode,
        proposedDoseMg: 500,
        actionType: 'PRESCRIBE'
      }
    });

    if (!res1.success) console.error('EVALUATE 1 ERROR:', res1.error);
    expect(res1.success).toBe(true);
    const calcId1 = res1.data?.calculationId;

    // 2. Perform second evaluation with identical keys but different order of properties
    const res2 = await cdsEngine.evaluate({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionContext: {
        actionType: 'PRESCRIBE',
        proposedDoseMg: 500,
        proposedDrugCode: drugCode
      }
    });

    if (!res2.success) console.error('EVALUATE 2 ERROR:', res2.error);
    expect(res2.success).toBe(true);
    const calcId2 = res2.data?.calculationId;

    // Must hit the cache and return identical calculation/decision ID
    expect(calcId1).toBe(calcId2);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 5: Immutable Provenance Log
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 5: should block updates or deletions on decisions table via DB triggers', async () => {
    const drugCode = `CEF-IM-${randomUUID().slice(0, 6)}`;

    const res = await cdsEngine.evaluate({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientId,
      actionContext: {
        proposedDrugCode: drugCode,
        actionType: 'PRESCRIBE'
      }
    });

    if (!res.success) console.error('EVALUATE ERROR:', res.error);
    expect(res.success).toBe(true);

    const decisionId = res.data?.calculationId;
    expect(decisionId).toBeDefined();

    // Try updating the record -> should return error code from DB constraint trigger
    const updateRes = await supabase
      .from('hc_clinical_decisions')
      .update({ result: 'ALLOW' })
      .eq('id', decisionId);

    expect(updateRes.error).toBeDefined();
    expect(updateRes.error?.message).toContain('Mutation not allowed');

    // Try deleting the record -> should return error code from DB constraint trigger
    const deleteRes = await supabase
      .from('hc_clinical_decisions')
      .delete()
      .eq('id', decisionId);

    expect(deleteRes.error).toBeDefined();
    expect(deleteRes.error?.message).toContain('Mutation not allowed');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Gate 6: Override Role-Governance Policy
  // ────────────────────────────────────────────────────────────────────────────
  it('Gate 6: should enforce severity-to-clinician role override policies', async () => {
    // 1. Create a simulated blocking decision of LOW severity
    const ruleId = randomUUID();
    const lowFingerprint = `fp-low-${randomUUID()}`;
    const highFingerprint = `fp-high-${randomUUID()}`;
    const absFingerprint = `fp-abs-${randomUUID()}`;

    // Seed rule
    const ruleInsert = await supabase.from('hc_cds_rules').insert({
      id: ruleId,
      tenant_id: fixtures.tenantId,
      rule_code: `R-LOW-${randomUUID().slice(0, 6)}`,
      rule_version: '1.0',
      conditions: {},
      outcome: 'BLOCK',
      enforcement: 'OVERRIDABLE',
      severity: 'LOW',
      rule_checksum: 'chk-low'
    });
    if (ruleInsert.error) console.error('Rule Insert Error:', ruleInsert.error);

    const decLowId = randomUUID();
    const decLowInsert = await supabase.from('hc_clinical_decisions').insert({
      id: decLowId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientId,
      rule_id: ruleId,
      rule_version: '1.0',
      rule_checksum: 'chk-low',
      context_snapshot_version: 1,
      input_snapshot: {},
      action_context: { proposedDrugCode: 'PARA' },
      result: 'BLOCK',
      enforcement: 'OVERRIDABLE',
      severity: 'LOW',
      evaluator_version: '1.0',
      evaluation_fingerprint: lowFingerprint
    });
    if (decLowInsert.error) console.error('Decision Low Insert Error:', decLowInsert.error);

    // Low severity can be overridden by doctor role
    const ovLow = await supabase.from('hc_decision_overrides').insert({
      tenant_id: fixtures.tenantId,
      original_decision_id: decLowId,
      clinician_id: 'dr-smith',
      clinician_role: 'doctor',
      reason: 'Clinical rationale post-stent protection.',
      rule_version: '1.0',
      decision_result: 'BLOCK',
      policy_version: 'v1.0'
    });
    if (ovLow.error) console.error('Override Low Error:', ovLow.error);
    expect(ovLow.error).toBeNull();

    // 2. High severity override test
    const decHighId = randomUUID();
    const decHighInsert = await supabase.from('hc_clinical_decisions').insert({
      id: decHighId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientId,
      rule_id: ruleId,
      rule_version: '1.0',
      rule_checksum: 'chk-high',
      context_snapshot_version: 1,
      input_snapshot: {},
      action_context: { proposedDrugCode: 'PARA2' },
      result: 'BLOCK',
      enforcement: 'OVERRIDABLE',
      severity: 'HIGH',
      evaluator_version: '1.0',
      evaluation_fingerprint: highFingerprint
    });
    if (decHighInsert.error) console.error('Decision High Insert Error:', decHighInsert.error);

    // High severity overridden by doctor role -> should fail (requires chief_of_department or clinical_director)
    const ovHighFail = await supabase.from('hc_decision_overrides').insert({
      tenant_id: fixtures.tenantId,
      original_decision_id: decHighId,
      clinician_id: 'dr-smith',
      clinician_role: 'doctor',
      reason: 'Low authority trying to override high block.',
      rule_version: '1.0',
      decision_result: 'BLOCK',
      policy_version: 'v1.0'
    });
    expect(ovHighFail.error).toBeDefined();
    expect(ovHighFail.error?.message).toContain('not authorized to override HIGH severity');

    // High severity overridden by chief_of_department -> should succeed
    const ovHighSuccess = await supabase.from('hc_decision_overrides').insert({
      tenant_id: fixtures.tenantId,
      original_decision_id: decHighId,
      clinician_id: 'chief-jones',
      clinician_role: 'chief_of_department',
      reason: 'Justified chief override.',
      rule_version: '1.0',
      decision_result: 'BLOCK',
      policy_version: 'v1.0'
    });
    expect(ovHighSuccess.error).toBeNull();

    // 3. Absolute block cannot be overridden
    const decAbsId = randomUUID();
    const decAbsInsert = await supabase.from('hc_clinical_decisions').insert({
      id: decAbsId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_id: fixtures.patientId,
      rule_id: ruleId,
      rule_version: '1.0',
      rule_checksum: 'chk-abs',
      context_snapshot_version: 1,
      input_snapshot: {},
      action_context: { proposedDrugCode: 'PARA3' },
      result: 'BLOCK',
      enforcement: 'ABSOLUTE_BLOCK',
      severity: 'CRITICAL',
      evaluator_version: '1.0',
      evaluation_fingerprint: absFingerprint
    });
    if (decAbsInsert.error) console.error('Decision Absolute Insert Error:', decAbsInsert.error);

    const ovAbs = await supabase.from('hc_decision_overrides').insert({
      tenant_id: fixtures.tenantId,
      original_decision_id: decAbsId,
      clinician_id: 'med-director',
      clinician_role: 'medical_director',
      reason: 'Trying to bypass absolute block.',
      rule_version: '1.0',
      decision_result: 'BLOCK',
      policy_version: 'v1.0'
    });
    expect(ovAbs.error).toBeDefined();
    expect(ovAbs.error?.message).toContain('strictly prohibited for ABSOLUTE_BLOCK');

    // Clean up rules
    await supabase.from('hc_cds_rules').delete().eq('id', ruleId);
  });
});
