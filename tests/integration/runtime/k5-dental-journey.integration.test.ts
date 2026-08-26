/**
 * K5 — Dental Reuse Proof: End-to-End Integration Test
 *
 * Validates the outpatient Dental journey on a REAL Supabase database.
 * Zero runtime mocks — every step writes and reads back from the live DB.
 *
 * Journey sequence (9 steps):
 *   1. Patient Resolution (Platform Core Identity) — verify patient exists in party_parties
 *   2. Encounter Creation — EncounterEngineService.createEncounter with outpatient type and AMB class
 *   3. Arrival Check-In — update encounter status to 'arrived' via EncounterEngineService
 *   4. Pre-Procedure Vitals — NursingEngineService.recordVitalSigns anchored to encounter
 *   5. Dental Assessment (Odontogram) — record decayed status of tooth 18 in den_odontograms
 *   6. Diagnosis — EncounterEngineService.addDiagnosis (ICD-10 K02.9 for Dental Caries)
 *   7. Dental Order — OrderEngineService.createOrder (PROCEDURE type for tooth 18 extraction)
 *   8. Order Approval — OrderEngineService.approveOrder (transitions order to APPROVED canonically)
 *   9. FK-Safe Cleanup — call cleanup_k3_sentinel_encounter RPC + delete sentinel odontogram record
 *
 * Guardrails:
 *   - No new database tables or migrations.
 *   - No custom clinical core tables (like dental_patients, dental_encounters).
 *   - No new kernel engine code modifications.
 *   - Zero direct Supabase client updates to modify order status (stops canonically at APPROVED).
 *   - Cleanup failure = test failure.
 *
 * Sentinel prefix: 'dd' (Dental K5) — distinct from K3 'cc', K2 'bb', and H1.8 'ee'
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EncounterEngineService } from '@/platform/healthcare/engines/encounter-engine/encounter-engine.service';
import { SupabaseEncounterRepository } from '@/platform/healthcare/engines/encounter-engine/infrastructure/supabase-encounter.repository';
import { NursingEngineService } from '@/platform/healthcare/engines/nursing-engine/nursing-engine.service';
import { OrderEngineService } from '@/platform/healthcare/engines/order-engine/order-engine.service';
import { CdsEngineService } from '@/platform/healthcare/engines/cds-engine/cds-engine.service';
import { EventBusService } from '@/platform/host/event-bus/event-bus.service';

// ============================================================
// Constants — TenantA (Bella General Hospital / Dental Clinic)
// ============================================================

const TENANT_ID = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';

// Real TenantA anchor IDs (pinned from DB probe)
const REAL_PARTY_ID = 'ef4d0838-5309-4f23-82c3-80d1ee687a13'; // Patient

// Sentinel IDs — 'dd' prefix for K5 Dental sentinels
let K5_ENCOUNTER_ID: string; // assigned in beforeAll
const K5_DOCTOR_ID = 'dd000000-0000-4000-8000-300000000002';
const K5_NURSE_ID  = 'dd000000-0000-4000-8000-300000000003';

// ============================================================
// State
// ============================================================

let sb: SupabaseClient<Database>;
let encounterEngine: EncounterEngineService;
let nursingEngine: NursingEngineService;
let orderEngine: OrderEngineService;
let cdsEngine: CdsEngineService;

// Dynamic IDs created during test run (for cleanup)
let sentinelVitalId: string;
let sentinelOdontogramId: string;
let sentinelOrderId: string;

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[K5] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
      'Load .env.local before running.'
    );
  }

  sb = createClient<Database>(url, key);

  // Assign a fresh encounter UUID per test run
  K5_ENCOUNTER_ID = crypto.randomUUID();

  // Pre-cleanup any leftover sentinel data from a previous failed run
  await cleanup(sb, { failOnError: false });

  // Wire engines through real Supabase client
  const repo = new SupabaseEncounterRepository(sb);
  const eventBus = new EventBusService();
  encounterEngine = new EncounterEngineService(repo, eventBus);
  nursingEngine = new NursingEngineService(sb);
  cdsEngine = new CdsEngineService(sb);
  orderEngine = new OrderEngineService(sb, cdsEngine);
});

afterAll(async () => {
  // Post-cleanup sentinel data
  const { failed, errors } = await cleanup(sb, { failOnError: true });
  if (failed) {
    throw new Error(`[K5 Teardown] Cleanup failed:\n${errors.join('\n')}`);
  }
});

/**
 * FK-safe cleanup helper. Reuses the trigger-bypass RPC and deletes the odontogram.
 */
async function cleanup(
  client: SupabaseClient<Database>,
  { failOnError }: { failOnError: boolean }
): Promise<{ failed: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Step 1: Clean sentinel encounter + all FK children via trigger-bypass RPC
  if (K5_ENCOUNTER_ID) {
    const { error: rpcErr } = await client.rpc(
      'cleanup_k3_sentinel_encounter' as never,
      { p_encounter_id: K5_ENCOUNTER_ID } as never
    );
    if (rpcErr) {
      const msg = `cleanup_k3_sentinel_encounter(${K5_ENCOUNTER_ID}): ${rpcErr.message}`;
      if (failOnError) errors.push(msg);
      else console.warn(`[K5 cleanup] ${msg}`);
    }
  }

  // Step 2: Clean sentinel odontogram if created
  if (sentinelOdontogramId) {
    const { error: odErr } = await client
      .from('den_odontograms')
      .delete()
      .eq('id', sentinelOdontogramId);
    if (odErr) {
      const msg = `Cleanup den_odontograms(${sentinelOdontogramId}): ${odErr.message}`;
      if (failOnError) errors.push(msg);
      else console.warn(`[K5 cleanup] ${msg}`);
    }
  } else {
    // Fallback: delete any leftover sentinel odontogram for this patient
    const { error: fallbackErr } = await client
      .from('den_odontograms')
      .delete()
      .eq('patient_party_id', REAL_PARTY_ID)
      .eq('tenant_id', TENANT_ID);
    if (fallbackErr && failOnError) {
      errors.push(`Cleanup leftover den_odontograms: ${fallbackErr.message}`);
    }
  }

  // Step 3: Verify no sentinel residue
  if (failOnError && K5_ENCOUNTER_ID) {
    const { data: residue } = await client
      .from('hc_encounters')
      .select('id')
      .eq('id', K5_ENCOUNTER_ID);
    if (residue && residue.length > 0) {
      errors.push(`Sentinel encounter ${K5_ENCOUNTER_ID} still present after cleanup!`);
    }
  }

  return { failed: errors.length > 0, errors };
}

// ============================================================
// Journey Tests
// ============================================================

describe('K5 — Dental Outpatient Journey Steps', () => {

  it('Step 1: resolves patient using existing Platform Core identity path', async () => {
    const { data: patient, error } = await sb
      .from('party_parties')
      .select('id, party_type')
      .eq('id', REAL_PARTY_ID)
      .single();

    expect(error).toBeNull();
    expect(patient).toBeDefined();
    expect(patient?.id).toBe(REAL_PARTY_ID);
    expect(patient?.party_type).toBe('person');
  });

  it('Step 2: creates a DENT encounter via EncounterEngineService', async () => {
    const result = await encounterEngine.createEncounter({
      tenantId: TENANT_ID,
      patientId: REAL_PARTY_ID,
      encounterClass: 'AMB', // Outpatient
      encounterType: 'outpatient', // Outpatient type to satisfy SQL constraint check
      userId: K5_DOCTOR_ID,
    });

    expect(result.success, `Encounter creation failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.encounter?.id).toBeDefined();
    
    // Set K5_ENCOUNTER_ID to match the actual created encounter
    K5_ENCOUNTER_ID = result.encounter!.id;
    
    expect(result.encounter?.status).toBe('planned');
    expect(result.encounter?.encounterClass).toBe('AMB');
    expect(result.encounter?.encounterType).toBe('outpatient');
  });

  it('Step 3: transitions encounter status to arrived', async () => {
    const result = await encounterEngine.updateStatus({
      tenantId: TENANT_ID,
      encounterId: K5_ENCOUNTER_ID,
      status: 'arrived',
      userId: K5_DOCTOR_ID,
    });

    expect(result.success, `Status transition failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.encounter?.status).toBe('arrived');
  });

  it('Step 4: records pre-procedure vitals via NursingEngineService', async () => {
    const result = await nursingEngine.recordVitalSigns({
      tenantId: TENANT_ID,
      encounterId: K5_ENCOUNTER_ID,
      patientId: REAL_PARTY_ID,
      recordedBy: K5_NURSE_ID,
      temperature: { value: 36.8, unit: 'C' },
      heartRate: { value: 78, unit: 'bpm' },
      respiratoryRate: { value: 16, unit: 'cpm' },
      bloodPressure: { systolic: 120, diastolic: 80 },
      oxygenSaturation: { value: 99, unit: '%' },
    });

    expect(result.success, `Vitals recording failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.data?.id).toBeDefined();
    sentinelVitalId = result.data!.id;
  });

  it('Step 5: updates odontogram status for tooth 18 in den_odontograms', async () => {
    const toothData = {
      '18': { status: 'decayed', notes: 'Severe caries on third molar' }
    };

    // First try to check if odontogram exists for the patient
    const { data: existing } = await sb
      .from('den_odontograms')
      .select('id')
      .eq('patient_party_id', REAL_PARTY_ID)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    if (existing) {
      const { data, error } = await sb
        .from('den_odontograms')
        .update({
          tooth_data: toothData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id, tooth_data')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      sentinelOdontogramId = data!.id;
      const tData = data!.tooth_data as Record<string, unknown>;
      expect(tData['18']).toBeDefined();
    } else {
      const { data, error } = await sb
        .from('den_odontograms')
        .insert({
          tenant_id: TENANT_ID,
          patient_party_id: REAL_PARTY_ID,
          tooth_data: toothData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, tooth_data')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      sentinelOdontogramId = data!.id;
      const tData = data!.tooth_data as Record<string, unknown>;
      expect(tData['18']).toBeDefined();
    }
  });

  it('Step 6: adds primary diagnosis (ICD-10 K02.9) via EncounterEngineService', async () => {
    const result = await encounterEngine.addDiagnosis({
      tenantId: TENANT_ID,
      encounterId: K5_ENCOUNTER_ID,
      code: 'K02.9', // Dental caries, unspecified
      system: 'ICD-10',
      display: 'Dental caries, unspecified',
      isPrimary: true,
      userId: K5_DOCTOR_ID,
    });

    expect(result.success, `Diagnosis addition failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.encounter?.diagnoses).toBeDefined();
    
    const diagList = result.encounter?.diagnoses as Array<{ code: string; system: string; isPrimary: boolean }>;
    const primaryDiag = diagList.find((d) => d.isPrimary);
    expect(primaryDiag).toBeDefined();
    expect(primaryDiag?.code).toBe('K02.9');
    expect(primaryDiag?.system).toBe('ICD-10');
  });

  it('Step 7: creates a PROCEDURE order for tooth 18 extraction via OrderEngineService', async () => {
    const result = await orderEngine.createOrder({
      requestId: crypto.randomUUID(),
      tenantId: TENANT_ID,
      encounterId: K5_ENCOUNTER_ID,
      patientId: REAL_PARTY_ID,
      orderType: 'PROCEDURE',
      priority: 'ROUTINE',
      orderedBy: K5_DOCTOR_ID,
      orderDetails: {
        description: 'Extraction of tooth 18',
        instructions: 'Simple extraction of impacted third molar under local anesthesia',
        toothNumber: 18,
      },
      notes: 'Dental K5 Reuse Proof — Tooth 18 extraction. Non-medication order skips CDS.',
    });

    expect(result.success, `Order creation failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.data?.order.id).toBeDefined();
    sentinelOrderId = result.data!.order.id;
    
    expect(result.data?.order.orderType).toBe('PROCEDURE');
    expect(result.data?.order.orderStatus).toBe('VALIDATED');
    expect(result.data?.cdsCheckStatus).toBe('PASSED'); // defaults to passed for non-medication
  });

  it('Step 8: approves the procedure order canonically', async () => {
    const result = await orderEngine.approveOrder({
      requestId: crypto.randomUUID(),
      tenantId: TENANT_ID,
      orderId: sentinelOrderId,
      approvedBy: K5_DOCTOR_ID,
    });

    expect(result.success, `Order approval failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.data?.orderStatus).toBe('APPROVED');
  });
});

// ============================================================
// K5 — Full Journey Coherence
// ============================================================

describe('K5 — Dental Journey Coherence', () => {

  it('encounter has: arrived status + K02.9 diagnosis + vitals + approved procedure order', async () => {
    // Read back encounter from DB
    const { data: enc, error: encErr } = await sb
      .from('hc_encounters')
      .select('status, diagnosis')
      .eq('id', K5_ENCOUNTER_ID)
      .single();

    expect(encErr).toBeNull();
    expect(enc?.status).toBe('arrived');
    
    const diagList = enc?.diagnosis as Array<{ code: string; system: string }>;
    expect(diagList).toBeDefined();
    expect(diagList.some((d) => d.code === 'K02.9')).toBe(true);

    // Read back vital signs
    const { data: vitals, error: vitErr } = await sb
      .from('hc_nursing_vital_signs')
      .select('id, systolic_bp, heart_rate')
      .eq('encounter_id', K5_ENCOUNTER_ID)
      .single();

    expect(vitErr).toBeNull();
    expect(vitals?.systolic_bp).toBe(120);
    expect(vitals?.heart_rate).toBe(78);

    // Read back odontogram
    const { data: od, error: odErr } = await sb
      .from('den_odontograms')
      .select('tooth_data')
      .eq('id', sentinelOdontogramId)
      .single();

    expect(odErr).toBeNull();
    const toothMap = od?.tooth_data as Record<string, { status: string }>;
    expect(toothMap['18']).toBeDefined();
    expect(toothMap['18'].status).toBe('decayed');

    // Read back procedure order
    const { data: order, error: ordErr } = await sb
      .from('hc_clinical_orders')
      .select('order_status, order_type, cds_check_status')
      .eq('id', sentinelOrderId)
      .single();

    expect(ordErr).toBeNull();
    expect(order?.order_type).toBe('PROCEDURE');
    expect(order?.order_status).toBe('APPROVED');
    expect(order?.cds_check_status).toBe('PASSED');
  });
});
