/**
 * K2 — Hospital Clinical Journey: End-to-End Integration Test
 *
 * Validates the full inpatient clinical journey on a REAL Supabase database.
 * Zero mocks — every step writes and reads back from the live DB.
 *
 * Journey sequence (7 steps):
 *   1. Patient Intake — sentinel encounter + inpatient admission
 *   2. Encounter Anchoring — vitals and orders bound to encounter_id
 *   3. Vitals Recording — write + read-back hc_nursing_vital_signs
 *   4. Clinical Diagnosis — canonical EncounterEngineService.addDiagnosis (JSONB)
 *   5. Clinical Order — write + read-back hc_medication_administration_records (order-engine evidence)
 *   6. MAR Administration — update order to "administered"
 *   7. Discharge & Bed Release — set admission=discharged, bed=cleaning
 *
 * Guardrails:
 *   - No hardcoded patient data used in production UI
 *   - Cleanup in FK dependency order; failure to cleanup = test failure
 *   - Diagnosis update goes through EncounterEngineService, not direct table update
 *   - order-engine evidence collected; NOT promoted to Kernel
 *
 * FK chain (inherited from H1.8 probe):
 *   party_parties ──FK──► hc_encounters.patient_party_id
 *   hc_encounters ──FK──► hc_inpatient_admissions.encounter_id
 *   hc_beds       ──FK──► hc_inpatient_admissions.bed_id
 *   hc_wards      ──FK──► hc_inpatient_admissions.ward_id
 *   hc_inpatient_admissions ──FK──► hc_nursing_vital_signs.inpatient_admission_id
 *   hc_inpatient_admissions ──FK──► hc_medication_administration_records.inpatient_admission_id
 *
 * Real IDs pinned from TenantA DB (probed 2026-08-26):
 *   REAL_PARTY_ID  = ef4d0838-5309-4f23-82c3-80d1ee687a13
 *   REAL_MPI_ID    = b420e1f9-a4be-4145-86cd-cc48364e596b
 *   REAL_BED_ID    = ab0d634c-c94c-4c0e-b9c1-8df0fcbaec55  (fallback; refreshed in beforeAll)
 *   REAL_WARD_ID   = d5fbf272-0f03-4667-a52e-95ce927ac3c6
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EncounterEngineService } from '@/platform/healthcare/engines/encounter-engine/encounter-engine.service';
import { SupabaseEncounterRepository } from '@/platform/healthcare/engines/encounter-engine/infrastructure/supabase-encounter.repository';
import { EventBusService } from '@/platform/host/event-bus/event-bus.service';

// ============================================================
// Constants — TenantA (Bella General Hospital)
// ============================================================

const TENANT_ID = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';

// Real TenantA anchor IDs (pinned from DB probe 2026-08-26)
const REAL_PARTY_ID = 'ef4d0838-5309-4f23-82c3-80d1ee687a13'; // FK for hc_encounters.patient_party_id
const REAL_MPI_ID   = 'b420e1f9-a4be-4145-86cd-cc48364e596b'; // FK for hc_inpatient_admissions.patient_id

// Sentinel IDs — 'bb' prefix distinguishes K2 sentinels from H1.8 'ee' sentinels (must be valid hex)
const K2_ENCOUNTER_ID  = 'bb000000-0000-4000-8000-200000000001';
const K2_ADMISSION_ID  = 'bb000000-0000-4000-8000-200000000002';
const K2_DOCTOR_ID     = 'bb000000-0000-4000-8000-200000000003'; // no FK constraint
const K2_NURSE_ID      = 'bb000000-0000-4000-8000-200000000004'; // no FK constraint

// ============================================================
// State
// ============================================================

let sb: SupabaseClient<Database>;
let encounterEngine: EncounterEngineService;
let realBedId: string;
let realWardId: string;

// Dynamic IDs created during test run (for cleanup)
let sentinelVitalId: string;
let sentinelOrderId: string;
let originalBedStatus: string;

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[K2] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
      'Load .env.local before running.'
    );
  }

  sb = createClient<Database>(url, key);

  // Pre-cleanup any leftover sentinel data from a previous failed run
  await cleanup(sb, { failOnError: false });

  // Resolve a real available bed (refreshes pinned fallback)
  const { data: beds, error: bedErr } = await sb
    .from('hc_beds')
    .select('id, ward_id, status')
    .eq('tenant_id', TENANT_ID)
    .limit(5);

  if (bedErr || !beds || beds.length === 0) {
    throw new Error(`[K2 beforeAll] Could not find any beds for tenant: ${bedErr?.message}`);
  }

  // Prefer an 'available' bed; fall back to first
  const availableBed = beds.find((b) => b.status === 'available') ?? beds[0];
  realBedId   = availableBed.id;
  realWardId  = availableBed.ward_id;
  originalBedStatus = availableBed.status;

  // Wire EncounterEngineService through real Supabase client
  // EventBusService defaults to MemoryEventBusAdapter (no Supabase needed for test)
  const repo = new SupabaseEncounterRepository(sb);
  const eventBus = new EventBusService();
  encounterEngine = new EncounterEngineService(repo, eventBus);

  // ── Step 1: Create sentinel encounter ────────────────────────────
  // created_by / updated_by must be valid UUIDs (DB column type = uuid)
  // Use K2_DOCTOR_ID so that EncounterEngineService.addDiagnosis can later UPDATE without type error.
  const { error: encErr } = await sb.from('hc_encounters').insert({
    id:               K2_ENCOUNTER_ID,
    tenant_id:        TENANT_ID,
    patient_party_id: REAL_PARTY_ID,
    encounter_class:  'IMP',
    encounter_type:   'inpatient',
    status:           'in-progress',
    period_start:     new Date().toISOString(),
    created_by:       K2_DOCTOR_ID, // must be UUID
    updated_by:       K2_DOCTOR_ID, // must be UUID
  });
  if (encErr) throw new Error(`[K2 beforeAll] Encounter insert failed: ${encErr.message}`);

  // ── Step 2: Create sentinel admission ────────────────────────────
  const { error: admErr } = await sb.from('hc_inpatient_admissions').insert({
    id:                  K2_ADMISSION_ID,
    tenant_id:           TENANT_ID,
    encounter_id:        K2_ENCOUNTER_ID,
    patient_id:          REAL_MPI_ID,
    bed_id:              realBedId,
    ward_id:             realWardId,
    admitting_doctor_id: K2_DOCTOR_ID,
    attending_doctor_id: K2_DOCTOR_ID,
    admitted_at:         new Date().toISOString(),
    status:              'active',
    admission_diagnosis: [{ code: 'K35.2', description: 'K2 Sentinel — Appendicitis (ICD-10)' }],
  });
  if (admErr) throw new Error(`[K2 beforeAll] Admission insert failed: ${admErr.message}`);
});

afterAll(async () => {
  if (!sb) return;

  const { failed, errors } = await cleanup(sb, { failOnError: true });
  if (failed) {
    throw new Error(
      `[K2 afterAll] Cleanup FAILED — sentinel data may remain in DB.\n` +
      `Errors:\n${errors.join('\n')}`
    );
  }
});

/**
 * FK-safe cleanup — children before parents.
 * @param failOnError  When true, returns {failed, errors}. When false, swallows.
 */
async function cleanup(
  client: SupabaseClient<Database>,
  { failOnError }: { failOnError: boolean }
): Promise<{ failed: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Delete in FK-safe order: children before parents
  const cleanupSteps: Array<() => Promise<{ error: { message: string } | null }>> = [
    () => client.from('hc_medication_administration_records')
      .delete().eq('inpatient_admission_id', K2_ADMISSION_ID),
    () => client.from('hc_nursing_vital_signs')
      .delete().eq('inpatient_admission_id', K2_ADMISSION_ID),
    () => client.from('hc_inpatient_admissions')
      .delete().eq('id', K2_ADMISSION_ID),
    () => client.from('hc_encounters')
      .delete().eq('id', K2_ENCOUNTER_ID),
  ];

  const tableNames = [
    'hc_medication_administration_records',
    'hc_nursing_vital_signs',
    'hc_inpatient_admissions',
    'hc_encounters',
  ];

  for (let i = 0; i < cleanupSteps.length; i++) {
    const { error } = await cleanupSteps[i]();
    if (error) {
      const msg = `Cleanup ${tableNames[i]}: ${error.message}`;
      if (failOnError) errors.push(msg);
      else console.warn(`[K2 cleanup] ${msg}`);
    }
  }

  // Restore bed status to original
  if (realBedId && originalBedStatus) {
    const { error: bedErr } = await client
      .from('hc_beds')
      .update({ status: originalBedStatus })
      .eq('id', realBedId);
    if (bedErr) {
      const msg = `Cleanup hc_beds restore: ${bedErr.message}`;
      if (failOnError) errors.push(msg);
      else console.warn(`[K2 cleanup] ${msg}`);
    }
  }

  // Verify no sentinel residue
  if (failOnError) {
    const { data: residue } = await client
      .from('hc_encounters')
      .select('id')
      .eq('id', K2_ENCOUNTER_ID);
    if (residue && residue.length > 0) {
      errors.push(`Sentinel encounter K2_ENCOUNTER_ID still present after cleanup!`);
    }
  }

  return { failed: errors.length > 0, errors };
}

// ============================================================
// K2.1 — Patient Intake & Admission
// ============================================================

describe('K2 — 1. Patient Intake & Admission', () => {

  it('sentinel encounter exists in hc_encounters', async () => {
    const { data, error } = await sb
      .from('hc_encounters')
      .select('id, status, encounter_class, encounter_type, patient_party_id')
      .eq('id', K2_ENCOUNTER_ID)
      .eq('tenant_id', TENANT_ID)
      .single();

    expect(error, `Encounter read: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(K2_ENCOUNTER_ID);
    expect(data?.status).toBe('in-progress');
    expect(data?.encounter_class).toBe('IMP');
    expect(data?.patient_party_id).toBe(REAL_PARTY_ID);
  });

  it('sentinel admission exists and is linked to encounter', async () => {
    const { data, error } = await sb
      .from('hc_inpatient_admissions')
      .select('id, encounter_id, status, patient_id, bed_id')
      .eq('id', K2_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID)
      .single();

    expect(error, `Admission read: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(K2_ADMISSION_ID);
    expect(data?.encounter_id).toBe(K2_ENCOUNTER_ID); // Encounter anchoring verified
    expect(data?.status).toBe('active');
    expect(data?.patient_id).toBe(REAL_MPI_ID);
    expect(data?.bed_id).toBe(realBedId);
  });
});

// ============================================================
// K2.2 — Vitals Recording (Encounter-Anchored)
// ============================================================

describe('K2 — 2. Vitals Recording (encounter-anchored)', () => {

  it('writes hc_nursing_vital_signs with encounter_id and reads back', async () => {
    sentinelVitalId = crypto.randomUUID();

    const { data, error } = await sb
      .from('hc_nursing_vital_signs')
      .insert({
        id:                     sentinelVitalId,
        tenant_id:              TENANT_ID,
        inpatient_admission_id: K2_ADMISSION_ID,  // FK → hc_inpatient_admissions
        encounter_id:           K2_ENCOUNTER_ID,  // Encounter anchoring
        patient_id:             REAL_PARTY_ID,
        nurse_practitioner_id:  K2_NURSE_ID,
        temperature:            37.5,
        heart_rate:             88,
        systolic_bp:            125,
        diastolic_bp:           82,
        spo2:                   97,
        respiratory_rate:       18,
        notes:                  'K2 integration test — initial vitals post-admission',
        recorded_at:            new Date().toISOString(),
      })
      .select()
      .single();

    expect(error, `Vitals insert: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(sentinelVitalId);
    expect(data?.encounter_id).toBe(K2_ENCOUNTER_ID);
    expect(data?.inpatient_admission_id).toBe(K2_ADMISSION_ID);
    expect(data?.temperature).toBe(37.5);
    expect(data?.spo2).toBe(97);
  });

  it('reads back vitals by inpatient_admission_id — encounter_id anchor present', async () => {
    const { data, error } = await sb
      .from('hc_nursing_vital_signs')
      .select('id, encounter_id, temperature, heart_rate, spo2')
      .eq('inpatient_admission_id', K2_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID);

    expect(error, `Vitals read: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const v = data!.find((r) => r.id === sentinelVitalId);
    expect(v, 'K2 sentinel vital not found').toBeDefined();
    expect(v?.encounter_id).toBe(K2_ENCOUNTER_ID); // Encounter anchor confirmed
    expect(v?.temperature).toBe(37.5);
    expect(v?.heart_rate).toBe(88);
  });
});

// ============================================================
// K2.3 — Clinical Diagnosis (Canonical Path via EncounterEngineService)
// ============================================================

describe('K2 — 3. Clinical Diagnosis via EncounterEngineService.addDiagnosis', () => {

  it('adds ICD-10 diagnosis through canonical EncounterEngineService path', async () => {
    const response = await encounterEngine.addDiagnosis({
      tenantId:    TENANT_ID,
      encounterId: K2_ENCOUNTER_ID,
      code:        'K35.2',
      system:      'ICD-10',
      display:     'Acute appendicitis with generalized peritonitis',
      isPrimary:   true,
      userId:      K2_DOCTOR_ID,
    });

    expect(response.success, `addDiagnosis failed: ${response.error}`).toBe(true);
    expect(response.encounter).toBeDefined();
    expect(response.encounter?.diagnoses).toBeDefined();
    expect(response.encounter?.diagnoses.length).toBeGreaterThan(0);

    const diag = response.encounter?.diagnoses.find((d) => d.code === 'K35.2');
    expect(diag, 'ICD-10 K35.2 not found in DTO').toBeDefined();
    expect(diag?.isPrimary).toBe(true);
  });

  it('reads back diagnosis JSONB from hc_encounters — canonical persistence confirmed', async () => {
    const { data, error } = await sb
      .from('hc_encounters')
      .select('diagnosis')
      .eq('id', K2_ENCOUNTER_ID)
      .single();

    expect(error, `Encounter diagnosis read: ${error?.message}`).toBeNull();
    expect(Array.isArray(data?.diagnosis)).toBe(true);

    const diagnosisArray = data?.diagnosis as Array<{ code: string; system: string; type: string }>;
    const k35 = diagnosisArray.find((d) => d.code === 'K35.2');
    expect(k35, 'K35.2 not persisted in JSONB').toBeDefined();
    expect(k35?.system).toBe('ICD-10');
    expect(k35?.type).toBe('primary');
  });
});

// ============================================================
// K2.4 — Clinical Order (order-engine candidate evidence)
// ============================================================

describe('K2 — 4. Clinical Order (order-engine candidate evidence)', () => {

  /**
   * Order-engine evidence collection.
   * This does NOT promote order-engine to Kernel.
   * Evidence needed: Hospital vertical can issue orders via the MAR table path.
   * Next vertical (e.g., Clinic, Dental) will validate cross-vertical reuse before Kernel promotion.
   */
  it('issues a medication order via hc_medication_administration_records — order evidence', async () => {
    sentinelOrderId = crypto.randomUUID();

    const scheduledAt = new Date(Date.now() + 2 * 3_600_000).toISOString(); // +2h

    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .insert({
        id:                     sentinelOrderId,
        tenant_id:              TENANT_ID,
        inpatient_admission_id: K2_ADMISSION_ID,
        encounter_id:           K2_ENCOUNTER_ID,   // Encounter-anchored order
        prescription_item_id:   crypto.randomUUID(), // no FK constraint
        drug_name:              'Cefazolin 1g',
        dosage:                 '1g',
        route:                  'IV (Tĩnh mạch)',
        scheduled_time:         scheduledAt,
        status:                 'scheduled',
        notes:                  'K2 integration test — post-op prophylactic antibiotic',
        created_at:             new Date().toISOString(),
      })
      .select()
      .single();

    expect(error, `Order insert: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(sentinelOrderId);
    expect(data?.encounter_id).toBe(K2_ENCOUNTER_ID); // Encounter anchor
    expect(data?.drug_name).toBe('Cefazolin 1g');
    expect(data?.status).toBe('scheduled');
  });

  it('reads back order by inpatient_admission_id — encounter anchor and order data verified', async () => {
    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .select('id, encounter_id, drug_name, status, route')
      .eq('inpatient_admission_id', K2_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID);

    expect(error, `Order read: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const order = data!.find((r) => r.id === sentinelOrderId);
    expect(order, 'K2 sentinel order not found').toBeDefined();
    expect(order?.encounter_id).toBe(K2_ENCOUNTER_ID);
    expect(order?.status).toBe('scheduled');
    expect(order?.route).toBe('IV (Tĩnh mạch)');
  });
});

// ============================================================
// K2.5 — MAR Administration (scheduled → administered)
// ============================================================

describe('K2 — 5. MAR Administration (scheduled → administered)', () => {

  it('transitions order status to "administered" and reads back', async () => {
    const administeredAt = new Date().toISOString();

    const { error: updateErr } = await sb
      .from('hc_medication_administration_records')
      .update({
        status:                   'administered',
        administered_time:        administeredAt,
        administered_by_nurse_id: K2_NURSE_ID,
        notes:                    'K2 — administered per protocol, 30 min post-op',
      })
      .eq('id', sentinelOrderId)
      .eq('tenant_id', TENANT_ID);

    expect(updateErr, `MAR update: ${updateErr?.message}`).toBeNull();

    const { data, error: readErr } = await sb
      .from('hc_medication_administration_records')
      .select('status, administered_time, administered_by_nurse_id, notes')
      .eq('id', sentinelOrderId)
      .single();

    expect(readErr).toBeNull();
    expect(data?.status).toBe('administered');
    expect(data?.administered_by_nurse_id).toBe(K2_NURSE_ID);
    expect(data?.administered_time).not.toBeNull();
    expect(data?.notes).toContain('K2 — administered');
  });
});

// ============================================================
// K2.6 — Discharge & Bed Release
// ============================================================

describe('K2 — 6. Discharge & Bed Release', () => {

  it('sets admission status to "discharged" and reads back', async () => {
    const dischargedAt = new Date().toISOString();

    const { error: updateErr } = await sb
      .from('hc_inpatient_admissions')
      .update({
        status:        'discharged',
        discharged_at: dischargedAt,
        updated_at:    dischargedAt,
      })
      .eq('id', K2_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID);

    expect(updateErr, `Admission discharge: ${updateErr?.message}`).toBeNull();

    const { data, error: readErr } = await sb
      .from('hc_inpatient_admissions')
      .select('status, discharged_at')
      .eq('id', K2_ADMISSION_ID)
      .single();

    expect(readErr).toBeNull();
    expect(data?.status).toBe('discharged');
    expect(data?.discharged_at).not.toBeNull();
  });

  it('sets bed status to "cleaning" after discharge and reads back', async () => {
    const { error: updateErr } = await sb
      .from('hc_beds')
      .update({ status: 'cleaning', updated_at: new Date().toISOString() })
      .eq('id', realBedId)
      .eq('tenant_id', TENANT_ID);

    expect(updateErr, `Bed status update: ${updateErr?.message}`).toBeNull();

    const { data, error: readErr } = await sb
      .from('hc_beds')
      .select('status')
      .eq('id', realBedId)
      .single();

    expect(readErr).toBeNull();
    expect(data?.status).toBe('cleaning');
    // Note: afterAll cleanup will restore bed to originalBedStatus
  });
});

// ============================================================
// K2.7 — Full Journey Verification
// ============================================================

describe('K2 — 7. Full Journey Verification (cross-step coherence)', () => {

  it('encounter has: active status record with diagnoses + vitals + MAR all anchored', async () => {
    // Encounter: diagnoses JSONB populated
    const { data: enc } = await sb
      .from('hc_encounters')
      .select('status, diagnosis')
      .eq('id', K2_ENCOUNTER_ID)
      .single();

    expect(enc?.status).toBe('in-progress');
    expect(Array.isArray(enc?.diagnosis)).toBe(true);
    expect((enc?.diagnosis as unknown[]).length).toBeGreaterThan(0);

    // Vitals: at least 1 row anchored to encounter
    const { data: vitals } = await sb
      .from('hc_nursing_vital_signs')
      .select('id, encounter_id')
      .eq('encounter_id', K2_ENCOUNTER_ID)
      .eq('tenant_id', TENANT_ID);

    expect(vitals!.length).toBeGreaterThan(0);
    expect(vitals![0].encounter_id).toBe(K2_ENCOUNTER_ID);

    // MAR: at least 1 administered order anchored to encounter
    const { data: mar } = await sb
      .from('hc_medication_administration_records')
      .select('id, encounter_id, status')
      .eq('encounter_id', K2_ENCOUNTER_ID)
      .eq('tenant_id', TENANT_ID);

    expect(mar!.length).toBeGreaterThan(0);
    const administered = mar!.find((m) => m.status === 'administered');
    expect(administered, 'No administered MAR for this encounter').toBeDefined();

    // Admission: discharged
    const { data: adm } = await sb
      .from('hc_inpatient_admissions')
      .select('status')
      .eq('id', K2_ADMISSION_ID)
      .single();

    expect(adm?.status).toBe('discharged');
  });
});
