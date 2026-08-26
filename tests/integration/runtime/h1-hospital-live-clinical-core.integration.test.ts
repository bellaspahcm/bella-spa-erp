/**
 * H1.8 — Real DB Integration Tests: Live Clinical Core
 *
 * Verifies 4 H1 workflows persist/retrieve REAL data from Supabase.
 * NO mocked Supabase, NO mocked service, NO in-memory repository.
 *
 * Framework: Vitest  (npm run test:runtime:3b)
 * Auth:      SUPABASE_SERVICE_ROLE_KEY (bypasses RLS for test setup/teardown)
 *
 * FK chain resolved (probed 2026-08-26):
 *   party_parties ──FK──► hc_encounters.patient_party_id
 *   hc_encounters ──FK──► hc_inpatient_admissions.encounter_id
 *   hc_beds       ──FK──► hc_inpatient_admissions.bed_id
 *   hc_wards      ──FK──► hc_inpatient_admissions.ward_id
 *   hc_inpatient_admissions ──FK──► hc_nursing_vital_signs.inpatient_admission_id
 *   hc_inpatient_admissions ──FK──► hc_medication_administration_records.inpatient_admission_id
 *
 * Real IDs pinned from TenantA DB (probed beforeAll):
 *   REAL_PARTY_ID  = ef4d0838-5309-4f23-82c3-80d1ee687a13
 *   REAL_BED_ID    = ab0d634c-c94c-4c0e-b9c1-8df0fcbaec55
 *   REAL_WARD_ID   = d5fbf272-0f03-4667-a52e-95ce927ac3c6  (ICU)
 *
 * Evidence target:
 *   H1.8
 *   ├── Admissions    WRITE ✅ READ ✅ UPDATE ✅
 *   ├── Beds           READ ✅ UPDATE ✅ READ-BACK ✅
 *   ├── Vitals         WRITE ✅ READ-BACK ✅
 *   └── MAR            WRITE ✅ READ-BACK ✅ UPDATE ✅
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Constants — TenantA (Bella General Hospital)
// ============================================================

const TENANT_ID = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';

// Real TenantA IDs pinned from DB probe (2026-08-26)
const REAL_PARTY_ID  = 'ef4d0838-5309-4f23-82c3-80d1ee687a13'; // party_parties (FK for hc_encounters.patient_party_id)
const REAL_MPI_ID    = 'b420e1f9-a4be-4145-86cd-cc48364e596b'; // hc_master_patient_index (FK for hc_inpatient_admissions.patient_id)
const REAL_BED_ID    = 'ab0d634c-c94c-4c0e-b9c1-8df0fcbaec55'; // hc_beds  (available)
const REAL_WARD_ID   = 'd5fbf272-0f03-4667-a52e-95ce927ac3c6'; // hc_wards (ICU)

// Sentinel IDs — valid RFC4122 UUIDs, unique prefix 'ee' for easy cleanup
const SENTINEL_ENCOUNTER_ID = 'ee000000-0000-4000-8000-100000000002';
const SENTINEL_ADMISSION_ID = 'ee000000-0000-4000-8000-100000000003';
const SENTINEL_DOCTOR_ID    = 'ee000000-0000-4000-8000-100000000004'; // no FK on doctor_id
const SENTINEL_NURSE_ID     = 'ee000000-0000-4000-8000-100000000005'; // no FK on nurse_id

// ============================================================
// Client
// ============================================================

let sb: SupabaseClient;
let realBedId: string = REAL_BED_ID;    // fallback to pinned; refreshed in beforeAll
let realWardId: string = REAL_WARD_ID;

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[H1.8] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
      'Load .env.local before running.'
    );
  }

  sb = createClient(url, key);

  // Pre-cleanup any leftover sentinel data from previous failed runs
  await cleanup(sb);

  // Verify real bed/ward still exist; refresh if needed
  const { data: beds } = await sb
    .from('hc_beds')
    .select('id, ward_id')
    .eq('tenant_id', TENANT_ID)
    .limit(1);
  if (beds && beds.length > 0) {
    realBedId  = beds[0].id;
    realWardId = beds[0].ward_id;
  }

  // ── Step 1: Create sentinel encounter (requires real party_id via FK) ──
  const { error: encErr } = await sb.from('hc_encounters').insert({
    id:               SENTINEL_ENCOUNTER_ID,
    tenant_id:        TENANT_ID,
    patient_party_id: REAL_PARTY_ID,        // FK → party_parties (real row)
    encounter_class:  'IMP',
    encounter_type:   'inpatient',
    status:           'in-progress',
    period_start:     new Date().toISOString(),
  });
  if (encErr) throw new Error(`[H1.8 beforeAll] Encounter insert failed: ${encErr.message}`);

  // ── Step 2: Create sentinel admission (requires encounter + bed + ward) ──
  const { error: admErr } = await sb.from('hc_inpatient_admissions').insert({
    id:                   SENTINEL_ADMISSION_ID,
    tenant_id:            TENANT_ID,
    encounter_id:         SENTINEL_ENCOUNTER_ID, // FK → hc_encounters
    patient_id:           REAL_MPI_ID,          // FK → hc_master_patient_index (real row)
    bed_id:               realBedId,              // FK → hc_beds
    ward_id:              realWardId,             // FK → hc_wards
    admitting_doctor_id:  SENTINEL_DOCTOR_ID,
    attending_doctor_id:  SENTINEL_DOCTOR_ID,
    admitted_at:          new Date().toISOString(),
    status:               'active',
    admission_diagnosis:  [{ code: 'Z00.0', description: 'H1.8 Integration Test Admission' }],
  });
  if (admErr) throw new Error(`[H1.8 beforeAll] Admission insert failed: ${admErr.message}`);
});

afterAll(async () => {
  if (sb) await cleanup(sb);
});

async function cleanup(client: SupabaseClient) {
  // FK-safe deletion order (children first)
  await client.from('hc_medication_administration_records')
    .delete().eq('inpatient_admission_id', SENTINEL_ADMISSION_ID);
  await client.from('hc_nursing_vital_signs')
    .delete().eq('inpatient_admission_id', SENTINEL_ADMISSION_ID);
  await client.from('hc_inpatient_admissions')
    .delete().eq('id', SENTINEL_ADMISSION_ID);
  await client.from('hc_encounters')
    .delete().eq('id', SENTINEL_ENCOUNTER_ID);
}

// ============================================================
// H1.1 — Admissions: READ + UPDATE + READ-BACK
// (Sentinel row created in beforeAll; tests READ and MUTATE it)
// ============================================================

describe('H1.8 — H1.1 Admissions: WRITE + READ + UPDATE', () => {

  it('reads sentinel hc_inpatient_admissions — WRITE confirmed in beforeAll', async () => {
    const { data, error } = await sb
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('id', SENTINEL_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID)
      .single();

    expect(error, `Admission read error: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(SENTINEL_ADMISSION_ID);
    expect(data?.tenant_id).toBe(TENANT_ID);
    expect(data?.encounter_id).toBe(SENTINEL_ENCOUNTER_ID);
    expect(data?.status).toBe('active');
    expect(data?.admission_diagnosis).toBeDefined();
    expect(Array.isArray(data?.admission_diagnosis)).toBe(true);
    expect(data?.admission_diagnosis[0]?.code).toBe('Z00.0');
  });

  it('reads hc_inpatient_admissions list by tenant — at least 1 row', async () => {
    const { data, error } = await sb
      .from('hc_inpatient_admissions')
      .select('id, status, tenant_id')
      .eq('tenant_id', TENANT_ID);

    expect(error, `Admissions list error: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every(a => a.tenant_id === TENANT_ID)).toBe(true);
  });

  it('updates admission status to "discharged" and reads back — mutation persistence', async () => {
    const { error: updateErr } = await sb
      .from('hc_inpatient_admissions')
      .update({ status: 'discharged', updated_at: new Date().toISOString() })
      .eq('id', SENTINEL_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID);

    expect(updateErr, `Admission update error: ${updateErr?.message}`).toBeNull();

    const { data, error: readErr } = await sb
      .from('hc_inpatient_admissions')
      .select('status')
      .eq('id', SENTINEL_ADMISSION_ID)
      .single();

    expect(readErr).toBeNull();
    expect(data?.status).toBe('discharged');

    // Restore for downstream tests
    await sb.from('hc_inpatient_admissions')
      .update({ status: 'active' })
      .eq('id', SENTINEL_ADMISSION_ID);
  });
});

// ============================================================
// H1.2 — Beds: READ + UPDATE + READ-BACK
// ============================================================

describe('H1.8 — H1.2 Beds: READ + UPDATE + READ-BACK', () => {

  it('reads hc_beds for TenantA — at least one bed exists', async () => {
    const { data, error } = await sb
      .from('hc_beds')
      .select('id, ward_id, status, tenant_id')
      .eq('tenant_id', TENANT_ID)
      .limit(5);

    expect(error, `Beds read error: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data![0].tenant_id).toBe(TENANT_ID);
  });

  it('reads hc_wards for TenantA — at least one ward exists', async () => {
    const { data, error } = await sb
      .from('hc_wards')
      .select('id, name, tenant_id')
      .eq('tenant_id', TENANT_ID)
      .limit(3);

    expect(error, `Wards read error: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data![0].tenant_id).toBe(TENANT_ID);
  });

  it('updates bed status to "cleaning" and reads back — mutation + persistence', async () => {
    // Capture original
    const { data: before } = await sb
      .from('hc_beds').select('status').eq('id', realBedId).single();
    const originalStatus = before?.status ?? 'available';

    // Mutate (same DB path as BedEngineService.updateBedStatus)
    const { error: updateErr } = await sb
      .from('hc_beds')
      .update({ status: 'cleaning', updated_at: new Date().toISOString() })
      .eq('id', realBedId)
      .eq('tenant_id', TENANT_ID);

    expect(updateErr, `Bed update error: ${updateErr?.message}`).toBeNull();

    // Read-back
    const { data: after, error: readErr } = await sb
      .from('hc_beds')
      .select('status')
      .eq('id', realBedId)
      .single();

    expect(readErr).toBeNull();
    expect(after?.status).toBe('cleaning');

    // Restore
    await sb.from('hc_beds')
      .update({ status: originalStatus })
      .eq('id', realBedId);
  });
});

// ============================================================
// H1.3 — Vitals: WRITE + READ-BACK
// ============================================================

describe('H1.8 — H1.3 Vitals: WRITE + READ-BACK', () => {

  let sentinelVitalId: string;

  it('writes hc_nursing_vital_signs — sentinel vital record', async () => {
    sentinelVitalId = crypto.randomUUID();

    const { data, error } = await sb
      .from('hc_nursing_vital_signs')
      .insert({
        id:                      sentinelVitalId,
        tenant_id:               TENANT_ID,
        inpatient_admission_id:  SENTINEL_ADMISSION_ID, // FK → hc_inpatient_admissions
        encounter_id:            SENTINEL_ENCOUNTER_ID,
        patient_id:              REAL_PARTY_ID,         // vitals patient_id — no FK constraint
        nurse_practitioner_id:   SENTINEL_NURSE_ID,
        temperature:             37.1,
        heart_rate:              72,
        systolic_bp:             120,
        diastolic_bp:            80,
        spo2:                    98,
        respiratory_rate:        16,
        notes:                   'H1.8 integration test vital sign',
        recorded_at:             new Date().toISOString(),
      })
      .select()
      .single();

    expect(error, `Vitals insert error: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(sentinelVitalId);
    expect(data?.tenant_id).toBe(TENANT_ID);
    expect(data?.heart_rate).toBe(72);
    expect(data?.spo2).toBe(98);
    expect(data?.temperature).toBe(37.1);
  });

  it('reads back hc_nursing_vital_signs by inpatient_admission_id — persistence confirmed', async () => {
    const { data, error } = await sb
      .from('hc_nursing_vital_signs')
      .select('*')
      .eq('inpatient_admission_id', SENTINEL_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID)
      .order('recorded_at', { ascending: false });

    expect(error, `Vitals read error: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const v = data!.find(r => r.id === sentinelVitalId);
    expect(v, 'Sentinel vital not found in read-back').toBeDefined();
    expect(v?.temperature).toBe(37.1);
    expect(v?.heart_rate).toBe(72);
    expect(v?.systolic_bp).toBe(120);
    expect(v?.diastolic_bp).toBe(80);
    expect(v?.spo2).toBe(98);
    expect(v?.notes).toContain('H1.8');
  });
});

// ============================================================
// H1.4 — MAR: WRITE + READ-BACK + UPDATE (administer)
// ============================================================

describe('H1.8 — H1.4 MAR: WRITE + READ-BACK + UPDATE', () => {

  let sentinelMARId: string;
  const scheduledAt = new Date(Date.now() + 3_600_000).toISOString(); // +1h

  it('writes hc_medication_administration_records — sentinel MAR record', async () => {
    sentinelMARId = crypto.randomUUID();

    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .insert({
        id:                      sentinelMARId,
        tenant_id:               TENANT_ID,
        inpatient_admission_id:  SENTINEL_ADMISSION_ID, // FK → hc_inpatient_admissions
        encounter_id:            SENTINEL_ENCOUNTER_ID,
        prescription_item_id:    crypto.randomUUID(),   // no FK constraint
        drug_name:               'Paracetamol 500mg',
        dosage:                  '500mg',
        route:                   'PO (Uống)',
        scheduled_time:          scheduledAt,
        status:                  'scheduled',
        notes:                   'H1.8 integration test MAR',
        created_at:              new Date().toISOString(),
      })
      .select()
      .single();

    expect(error, `MAR insert error: ${error?.message}`).toBeNull();
    expect(data?.id).toBe(sentinelMARId);
    expect(data?.tenant_id).toBe(TENANT_ID);
    expect(data?.drug_name).toBe('Paracetamol 500mg');
    expect(data?.status).toBe('scheduled');
  });

  it('reads back hc_medication_administration_records by inpatient_admission_id — persistence confirmed', async () => {
    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .select('*')
      .eq('inpatient_admission_id', SENTINEL_ADMISSION_ID)
      .eq('tenant_id', TENANT_ID)
      .order('scheduled_time', { ascending: true });

    expect(error, `MAR read error: ${error?.message}`).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const m = data!.find(r => r.id === sentinelMARId);
    expect(m, 'Sentinel MAR not found in read-back').toBeDefined();
    expect(m?.drug_name).toBe('Paracetamol 500mg');
    expect(m?.dosage).toBe('500mg');
    expect(m?.route).toBe('PO (Uống)');
    expect(m?.status).toBe('scheduled');
    expect(m?.notes).toContain('H1.8');
  });

  it('updates MAR to "administered" and reads back — mutation + status persistence', async () => {
    const administeredAt = new Date().toISOString();

    const { error: updateErr } = await sb
      .from('hc_medication_administration_records')
      .update({
        status:                    'administered',
        administered_time:         administeredAt,
        administered_by_nurse_id:  SENTINEL_NURSE_ID,
        notes:                     'H1.8 administered by sentinel nurse',
      })
      .eq('id', sentinelMARId)
      .eq('tenant_id', TENANT_ID);

    expect(updateErr, `MAR update error: ${updateErr?.message}`).toBeNull();

    // Read-back — MUST come from DB (not local state)
    const { data, error: readErr } = await sb
      .from('hc_medication_administration_records')
      .select('status, administered_time, administered_by_nurse_id, notes')
      .eq('id', sentinelMARId)
      .single();

    expect(readErr).toBeNull();
    expect(data?.status).toBe('administered');
    expect(data?.administered_by_nurse_id).toBe(SENTINEL_NURSE_ID);
    expect(data?.administered_time).not.toBeNull();
    expect(data?.notes).toContain('H1.8 administered');
  });
});
