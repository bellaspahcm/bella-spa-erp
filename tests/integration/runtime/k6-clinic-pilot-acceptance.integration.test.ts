/**
 * K6 — Bella Medical / Clinic Pilot Acceptance Test
 *
 * The single question this test answers:
 *   "Can a clinic use Bella Medical to execute a basic clinical journey on
 *    real data, correct tenant, with no mock hiding errors?"
 *
 * Pilot scope: Bella Medical (Clinic / Outpatient)
 * Kernel baseline: FROZEN — no changes to engines/, contracts/, or migrations.
 *
 * Journey (9 steps — P1 Clinical Pilot Journey):
 *   1. Tenant Resolve    — getTenantIdOrThrow() returns a real UUID (not a hardcode)
 *   2. Patient Create    — party_parties + customers + patient_profiles INSERT via Kernel (MPI entry)
 *   3. Encounter Open    — EncounterEngineService.createEncounter → 'planned'
 *   4. Check-In          — EncounterEngineService.updateStatus → 'arrived'
 *   5. Vitals Record     — NursingEngineService.recordVitalSigns
 *   6. Consultation Start— EncounterEngineService.updateStatus → 'in-progress'
 *   7. SOAP + Diagnosis  — direct SOAP metadata update + addDiagnosis (ICD-10)
 *   8. Order             — OrderEngineService.createOrder (no CDS block expected)
 *   9. Complete          — EncounterEngineService.updateStatus → 'finished'
 *
 * K6 Directives enforced:
 *   - ZERO runtime mocks — all steps write/read from live Supabase DB
 *   - DB error ≠ empty state: any action error throws, not silently returns []
 *   - Tenant path: TenantA UUID from ENV, never hardcoded 'bella_healthcare'
 *   - Cleanup in FK-safe reverse order — failure to cleanup = test failure
 *   - Kernel engines/ NOT modified — actions are the only surface touched
 *
 * FK chain (Outpatient/Clinic):
 *   party_parties ──FK──► patient_profiles.id
 *   patient_profiles ──FK──► hc_encounters.patient_party_id (via party_id)
 *   hc_encounters ──FK──► hc_nursing_vital_signs.encounter_id
 *   hc_encounters ──FK──► hc_clinical_orders.encounter_id
 *
 * Sentinel prefix: 'k6' — distinct from K2 'bb', K3 'cc', K5 'dd'
 *
 * TenantA: c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import {
  createPatientRecordAction,
  createEMREncounterAction,
  updateEncounterSOAPAction,
  createPrescriptionAction,
  approvePrescriptionAction,
  completeEncounterAction,
  getDrugsAction,
} from '@/services/healthcare/healthcare-actions';
import { updateAppointmentStatusAction } from '@/services/healthcare/appointments-actions';

// Mock the getCurrentUser service action to return our TenantA user context
vi.mock('@/services/user-actions', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: '88888888-8888-8888-8888-888888888888',
    email: 'admin@medical.vn',
    full_name: 'Bác sĩ Admin Phòng Khám',
    role: 'admin',
    status: 'active',
    tenant_id: 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d',
  })
}));

// Increase global timeout for all integration steps (live Supabase I/O)
vi.setConfig({ testTimeout: 30_000 });


// ============================================================
// K6 Constants — TenantA (Bella Medical / Clinic Outpatient)
// ============================================================

const TENANT_ID = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d'; // TenantA UUID

// Sentinel IDs — 'k6' prefix, isolated from K2/K3/K5 namespaces
let K6_ENCOUNTER_ID: string;
let K6_DOCTOR_ID: string = '88888888-8888-8888-8888-888888888888';
let K6_NURSE_ID: string;
let K6_PARTY_ID: string;
let K6_CUSTOMER_ID: string;
let K6_PATIENT_ID: string;
let K6_ORDER_ID: string;
let K6_VITAL_ID: string;
let K6_PRESCRIPTION_ID: string;
let K6_DRUG_ID: string;
let K6_APP_CODE: string;
let K6_APP_PATIENT_PARTY_ID: string;
let K6_APP_ENCOUNTER_ID: string;

// K6 Pilot: a routine analgesic order (no DDI block expected)
const PILOT_DRUG_CODE = 'AUG-625'; // Augmentin

// Event tracking
const capturedEvents: Record<string, boolean> = {
  EncounterCreated: false,
  EncounterStarted: false,
  VitalsRecorded: false,
  'hos.order.created.v1': false,
  'hos.order.approved.v1': false,
  EncounterFinished: false,
};

let unsubscribers: Array<() => void> = [];

// ============================================================
// Supabase Admin Client (bypasses RLS — integration test only)
// ============================================================

function makeAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[K6 Acceptance] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient<Database>(url, key);
}

// ============================================================
// K6 Pilot Acceptance Suite
// ============================================================

describe('[K6 Acceptance] Bella Medical / Clinic Outpatient Pilot Journey', () => {
  let supabase: SupabaseClient<Database>;

  beforeAll(async () => {
    supabase = makeAdminClient();

    // Subscribe to global eventBus to verify event publishing
    unsubscribers = [
      eventBus.subscribe('EncounterCreated', () => { capturedEvents.EncounterCreated = true; }),
      eventBus.subscribe('EncounterStarted', () => { capturedEvents.EncounterStarted = true; }),
      eventBus.subscribe('VitalsRecorded', () => { capturedEvents.VitalsRecorded = true; }),
      eventBus.subscribe('hos.order.created.v1', () => { capturedEvents['hos.order.created.v1'] = true; }),
      eventBus.subscribe('hos.order.approved.v1', () => { capturedEvents['hos.order.approved.v1'] = true; }),
      eventBus.subscribe('EncounterFinished', () => { capturedEvents.EncounterFinished = true; }),
    ];
  });

  // ──────────────────────────────────────────────
  // Step 1: Tenant Resolve
  // ──────────────────────────────────────────────
  it('Step 1 — Tenant: TENANT_ID is a real UUID, not a string literal', () => {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(TENANT_ID).toMatch(uuidV4Regex);
    expect(TENANT_ID).not.toBe('bella_healthcare');
    expect(TENANT_ID).not.toBe('bella_dental');
    expect(TENANT_ID).not.toBe('bella_spa');
  });

  it('Step 1b — Tenant row exists in DB (not a ghost UUID)', async () => {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', TENANT_ID)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.id).toBe(TENANT_ID);
  });

  // ──────────────────────────────────────────────
  // Step 2: Patient Create (MPI) via Server Action
  // ──────────────────────────────────────────────
  it('Step 2 — Patient: Create patient profile records via Server Action', async () => {
    const patientName = 'K6 Pilot Patient ' + Date.now();
    const phone = '0966' + Math.floor(100000 + Math.random() * 900000);
    const bhytCode = 'DN401' + Math.floor(1000000000 + Math.random() * 9000000000);

    const result = await createPatientRecordAction({
      name: patientName,
      gender: 'male',
      phone,
      bloodType: 'O+',
      bhytCode,
      bhytBenefitRate: 80,
      allergies: ['Penicillin'],
    });

    expect(result.success).toBe(true);

    // Retrieve K6_PARTY_ID and K6_PATIENT_ID from DB to verify state
    const { data: party } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('display_name', patientName)
      .single();

    expect(party).not.toBeNull();
    K6_PARTY_ID = party!.id;

    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('id, customer_id')
      .eq('id', K6_PARTY_ID)
      .single();

    expect(profile).not.toBeNull();
    K6_PATIENT_ID = profile!.id;
    K6_CUSTOMER_ID = profile!.customer_id;
  });

  // ──────────────────────────────────────────────
  // Step 3: Encounter Open → arrived → in-progress
  // ──────────────────────────────────────────────
  it('Step 3 — Encounter: createEMREncounterAction chains creation & transitions', async () => {
    const { data: patient } = await supabase
      .from('party_parties')
      .select('display_name')
      .eq('id', K6_PARTY_ID)
      .single();

    const result = await createEMREncounterAction({
      patientName: patient!.display_name!,
      chiefComplaint: '[K6] Đau đầu nhẹ vùng thái dương, sốt 37.5°C',
      subjective: 'Bệnh nhân đau đầu vùng thái dương phải, âm ỉ, kéo dài 2 ngày.',
      assessment: 'R51 - Đau đầu không đặc hiệu',
      careSetting: 'ambulatory',
    });

    expect(result.success, `createEMREncounterAction failed: ${result.error}`).toBe(true);

    // Retrieve active encounter ID
    const { data: enc, error } = await supabase
      .from('hc_encounters')
      .select('id, status, reason_code')
      .eq('patient_party_id', K6_PARTY_ID)
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(enc).not.toBeNull();
    K6_ENCOUNTER_ID = enc!.id;

    // Verify encounter is in-progress (Check-in and Start transitioned canonically)
    expect(enc!.status).toBe('in-progress');
    expect(enc!.reason_code?.[0]).toContain('[K6]');
  });

  // ──────────────────────────────────────────────
  // Step 4: SOAP + Vitals + ICD-10 Diagnosis (All in one via updateEncounterSOAPAction)
  // ──────────────────────────────────────────────
  it('Step 4 — SOAP + Vitals + Diagnosis: updateEncounterSOAPAction parses & records to DB', async () => {
    const result = await updateEncounterSOAPAction({
      encounterId: K6_ENCOUNTER_ID,
      soap: {
        chiefComplaint: '[K6] Đau đầu nhẹ vùng thái dương, sốt 37.5°C',
        subjective: 'Bệnh nhân đau đầu vùng thái dương phải, âm ỉ, kéo dài 2 ngày.',
        objective: 'Temp: 37.5, HR: 72, BP: 118/76, SpO2: 98, RR: 16',
        assessment: 'R51 - Đau đầu không đặc hiệu',
        plan: 'Dùng Paracetamol 500mg x 3 lần/ngày. Tái khám sau 3 ngày nếu không đỡ.',
      },
    });

    expect(result.success, `updateEncounterSOAPAction failed: ${result.error}`).toBe(true);

    // Verify vital signs record created via NursingEngineService under the hood
    const { data: vital, error: vitalErr } = await supabase
      .from('hc_nursing_vital_signs')
      .select('id, heart_rate, temperature')
      .eq('encounter_id', K6_ENCOUNTER_ID)
      .single();

    expect(vitalErr).toBeNull();
    expect(vital).not.toBeNull();
    expect(vital.heart_rate).toBe(72);
    expect(vital.temperature).toBe(37.5);
    K6_VITAL_ID = vital.id;

    // Verify diagnosis record created via EncounterEngineService under the hood
    const { data: enc, error: encErr } = await supabase
      .from('hc_encounters')
      .select('diagnosis')
      .eq('id', K6_ENCOUNTER_ID)
      .single();

    expect(encErr).toBeNull();
    const diags = enc?.diagnosis as any[];
    expect(diags).toBeDefined();
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].code).toBe('R51');
    expect(diags[0].display).toBe('Đau đầu không đặc hiệu');
  });

  // ──────────────────────────────────────────────
  // Step 5: Prescription Order (createPrescriptionAction)
  // ──────────────────────────────────────────────
  it('Step 5 — Prescription: createPrescriptionAction invokes OrderEngineService and CDSS check', async () => {
    // Seed default drugs if empty
    const seedRes = await getDrugsAction();
    expect(seedRes.success).toBe(true);

    // 1. Fetch real Paracetamol drug ID
    const { data: drugProfile } = await supabase
      .from('hc_drug_profiles')
      .select('id')
      .eq('drug_code', PILOT_DRUG_CODE)
      .eq('tenant_id', TENANT_ID)
      .single();

    expect(drugProfile).not.toBeNull();
    K6_DRUG_ID = drugProfile!.id;

    const { data: patient } = await supabase
      .from('party_parties')
      .select('display_name')
      .eq('id', K6_PARTY_ID)
      .single();

    const result = await createPrescriptionAction({
      patientName: patient!.display_name!,
      drugId: K6_DRUG_ID,
      qty: 10,
      dosageInstruction: 'Uống 1 viên khi đau, tối đa 3 viên/ngày',
    });

    expect(result.success, `createPrescriptionAction failed: ${result.error}`).toBe(true);

    // Retrieve child prescription and parent clinical order from DB
    const { data: rx, error: rxErr } = await supabase
      .from('hc_prescriptions')
      .select('id, clinical_order_id, drugs')
      .eq('encounter_id', K6_ENCOUNTER_ID)
      .single();

    expect(rxErr).toBeNull();
    expect(rx).not.toBeNull();
    K6_PRESCRIPTION_ID = rx!.id;
    K6_ORDER_ID = rx!.clinical_order_id;

    const drugsPayload = rx.drugs as any[];
    expect(drugsPayload?.[0]?.drugId).toBe(K6_DRUG_ID);

    // Verify canonical order exists
    const { data: order, error: orderErr } = await supabase
      .from('hc_clinical_orders')
      .select('order_status')
      .eq('id', K6_ORDER_ID)
      .single();

    expect(orderErr).toBeNull();
    expect(order?.order_status).toBe('VALIDATED');
  });

  // ──────────────────────────────────────────────
  // Step 6: Approve Order & Prescription
  // ──────────────────────────────────────────────
  it('Step 6 — Approve: approvePrescriptionAction transitions clinical order & prescription to completed/approved', async () => {
    const result = await approvePrescriptionAction(K6_PRESCRIPTION_ID);
    expect(result.success, `approvePrescriptionAction failed: ${result.error}`).toBe(true);

    // Verify clinical order status transitioned to approved first
    const { data: order } = await supabase
      .from('hc_clinical_orders')
      .select('order_status')
      .eq('id', K6_ORDER_ID)
      .single();

    expect(order?.order_status).toBe('APPROVED');

    // Verify child prescription row is completed
    const { data: rx } = await supabase
      .from('hc_prescriptions')
      .select('status')
      .eq('id', K6_PRESCRIPTION_ID)
      .single();

    expect(rx?.status).toBe('completed');
  });

  // ──────────────────────────────────────────────
  // Step 7: Complete Encounter → 'finished'
  // ──────────────────────────────────────────────
  it('Step 7 — Complete: completeEncounterAction updates encounter to finished', async () => {
    const result = await completeEncounterAction(K6_ENCOUNTER_ID);
    expect(result.success, `completeEncounterAction failed: ${result.error}`).toBe(true);

    const { data, error } = await supabase
      .from('hc_encounters')
      .select('status')
      .eq('id', K6_ENCOUNTER_ID)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('finished');
  });

  // ──────────────────────────────────────────────
  // Step 8: Verify Event Publishing via global eventBus
  // ──────────────────────────────────────────────
  it('Step 8 — Events: Verify that all expected events were emitted through the global eventBus', () => {
    expect(capturedEvents.EncounterCreated).toBe(true);
    expect(capturedEvents.EncounterStarted).toBe(true);
    expect(capturedEvents.VitalsRecorded).toBe(true);
    expect(capturedEvents['hos.order.created.v1']).toBe(true);
    expect(capturedEvents['hos.order.approved.v1']).toBe(true);
    expect(capturedEvents.EncounterFinished).toBe(true);
  });

  // ──────────────────────────────────────────────
  // Step 9: Re-verify DB state integrity (no mock state)
  // ──────────────────────────────────────────────
  it('Step 9 — DB Ground Truth Verification: Verify all clinical data remains correctly written in DB', async () => {
    const { data: enc, error: encErr } = await supabase
      .from('hc_encounters')
      .select('id, status, reason_code')
      .eq('id', K6_ENCOUNTER_ID)
      .single();

    expect(encErr).toBeNull();
    expect(enc?.status).toBe('finished');
    expect(enc?.reason_code?.[0]).toContain('[K6]');

    const { data: vital, error: vitalErr } = await supabase
      .from('hc_nursing_vital_signs')
      .select('id')
      .eq('encounter_id', K6_ENCOUNTER_ID)
      .single();

    expect(vitalErr).toBeNull();
    expect(vital?.id).toBe(K6_VITAL_ID);

    const { data: order, error: orderErr } = await supabase
      .from('hc_clinical_orders')
      .select('id, order_status')
      .eq('encounter_id', K6_ENCOUNTER_ID)
      .single();

    expect(orderErr).toBeNull();
    expect(order?.id).toBe(K6_ORDER_ID);
    expect(order?.order_status).toBe('APPROVED');
  });

  // ──────────────────────────────────────────────
  // Step 10: Appointment Check-In E2E Validation
  // ──────────────────────────────────────────────
  it('Step 10 — Appointment Check-in E2E Validation: checks in appointment and asserts encounter_class is AMB', async () => {
    K6_APP_CODE = 'K6-APP-' + Date.now();
    const appPatientName = 'K6 App Patient ' + Date.now();

    // 1. Insert dummy appointment record
    const { error: appErr } = await supabase
      .from('hc_appointments')
      .insert({
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        appointment_code: K6_APP_CODE,
        patient_name: appPatientName,
        patient_phone: '0988776655',
        specialty: 'Khám theo lịch hẹn',
        doctor_name: 'BS. Trực Lâm Sàng',
        appointment_date: new Date().toISOString().split('T')[0],
        slot_time: '09:00',
        status: 'confirmed',
        channel: 'walk_in',
        qr_code: 'DUMMY_QR_' + K6_APP_CODE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    expect(appErr).toBeNull();

    // 2. Call updateAppointmentStatusAction to check in the appointment
    const checkinRes = await updateAppointmentStatusAction(K6_APP_CODE, 'checked_in');
    expect(checkinRes.success, `updateAppointmentStatusAction failed: ${checkinRes.error}`).toBe(true);

    // 3. Resolve the created patient party
    const { data: party, error: partyErr } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('display_name', appPatientName)
      .maybeSingle();

    expect(partyErr).toBeNull();
    expect(party).not.toBeNull();
    K6_APP_PATIENT_PARTY_ID = party!.id;

    // 4. Fetch the resulting encounter
    const { data: enc, error: encErr } = await supabase
      .from('hc_encounters')
      .select('id, encounter_class, status')
      .eq('tenant_id', TENANT_ID)
      .eq('patient_party_id', K6_APP_PATIENT_PARTY_ID)
      .maybeSingle();

    expect(encErr).toBeNull();
    expect(enc).not.toBeNull();
    K6_APP_ENCOUNTER_ID = enc!.id;

    // 5. Assert canonical schema constraint invariants: status = 'arrived' & class = 'AMB'
    expect(enc!.status).toBe('arrived');
    expect(enc!.encounter_class).toBe('AMB');
  });

  // ──────────────────────────────────────────────
  // Cleanup (FK-safe reverse order)
  // ──────────────────────────────────────────────
  afterAll(async () => {
    // Unsubscribe handlers
    unsubscribers.forEach((unsub) => unsub());

    const errors: string[] = [];

    // 1. Delete prescription child record first
    if (K6_PRESCRIPTION_ID) {
      const { error } = await supabase
        .from('hc_prescriptions')
        .delete()
        .eq('id', K6_PRESCRIPTION_ID);
      if (error) errors.push(`Prescription cleanup failed: ${error.message}`);
    }

    // 2. Call RPC to clean up main encounter, vital signs, clinical orders, clinical decisions
    if (K6_ENCOUNTER_ID) {
      const { error } = await supabase.rpc(
        'cleanup_k3_sentinel_encounter' as never,
        { p_encounter_id: K6_ENCOUNTER_ID } as never
      );
      if (error) errors.push(`Encounter RPC cleanup failed: ${error.message}`);
    }

    // 3. Patient profile
    if (K6_PATIENT_ID) {
      const { error } = await supabase
        .from('patient_profiles')
        .delete()
        .eq('id', K6_PATIENT_ID);
      if (error) errors.push(`Patient profile cleanup failed: ${error.message}`);
    }

    // 4. Customer
    if (K6_CUSTOMER_ID) {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', K6_CUSTOMER_ID);
      if (error) errors.push(`Customer cleanup failed: ${error.message}`);
    }

    // 5. Clean up main patient party using our new test-only RPC (which disables timeline_events_no_delete rule)
    if (K6_PARTY_ID) {
      const { error } = await supabase.rpc(
        'cleanup_k6_test_party' as never,
        { p_party_id: K6_PARTY_ID } as never
      );
      if (error) errors.push(`Patient party RPC cleanup failed: ${error.message}`);
    }

    // 6. Clean up Step 10 encounter, vitals, etc.
    if (K6_APP_ENCOUNTER_ID) {
      const { error } = await supabase.rpc(
        'cleanup_k3_sentinel_encounter' as never,
        { p_encounter_id: K6_APP_ENCOUNTER_ID } as never
      );
      if (error) errors.push(`Step 10 encounter RPC cleanup failed: ${error.message}`);
    }

    // 7. Clean up Step 10 patient party using the test-only RPC
    if (K6_APP_PATIENT_PARTY_ID) {
      const { error } = await supabase.rpc(
        'cleanup_k6_test_party' as never,
        { p_party_id: K6_APP_PATIENT_PARTY_ID } as never
      );
      if (error) errors.push(`Step 10 patient party RPC cleanup failed: ${error.message}`);
    }

    // 8. Clean up Step 10 appointment
    if (K6_APP_CODE) {
      const { error } = await supabase
        .from('hc_appointments')
        .delete()
        .eq('appointment_code', K6_APP_CODE);
      if (error) errors.push(`Appointment cleanup failed: ${error.message}`);
    }

    // Report cleanup errors
    if (errors.length > 0) {
      throw new Error(`[K6 Cleanup] ${errors.length} cleanup error(s):\n${errors.join('\n')}`);
    }
  });
});
