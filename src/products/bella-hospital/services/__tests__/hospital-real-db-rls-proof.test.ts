import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { clearServiceCache, getHealthcareService } from '@/platform/healthcare/service-locator';
import type { IImagingEngine } from '@/platform/healthcare/contracts/imaging-engine.contract';
import type { ILaboratoryEngine } from '@/platform/healthcare/contracts/laboratory-engine.contract';
import type { NursingEngineContract } from '@/platform/healthcare/contracts/nursing-engine.contract';
import type { OrderEngineContract } from '@/platform/healthcare/contracts/order-engine.contract';
import type { PharmacyEngineContract } from '@/platform/healthcare/contracts/pharmacy-engine.contract';
import type { Database } from '@/types/database.types';
import { HospitalClinicalOrdersProductService } from '../hospital-clinical-orders.service';
import { HospitalImagingProductService } from '../hospital-imaging.service';
import { HospitalLaboratoryProductService } from '../hospital-laboratory.service';
import { HospitalMedicationPharmacyMarProductService } from '../hospital-medication-pharmacy-mar.service';
import { HospitalNursingProductService } from '../hospital-nursing.service';

jest.mock('server-only', () => ({}), { virtual: true });

jest.setTimeout(120_000);

const HEALTHCARE_TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const hasRealSupabaseRlsEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key'
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && process.env.SUPABASE_JWT_SECRET
  );
};

const describeWithRealSupabase = hasRealSupabaseRlsEnv() ? describe : describe.skip;

function createTenantRlsClient(tenantId: string, userId: string): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseUrl || !anonKey || !jwtSecret) {
    throw new Error('Supabase anon URL/key and JWT secret are required for Hospital RLS proof.');
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      tenant_id: tenantId,
      app_metadata: {
        tenant_id: tenantId,
        role: 'admin',
      },
      user_metadata: {
        tenant_id: tenantId,
        role: 'admin',
      },
    },
    jwtSecret,
    { algorithm: 'HS256' }
  );

  return createSupabaseClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

async function insertOrThrow(
  supabase: SupabaseClient<Database>,
  table: 'party_parties' | 'journey_journeys' | 'hc_encounters' | 'users',
  row: Record<string, string>
): Promise<void> {
  const { error } = await supabase.from(table).insert(row);

  if (error) {
    throw new Error(`${table} seed failed: ${error.message}`);
  }
}

describeWithRealSupabase('Hospital Real DB / RLS proof', () => {
  let supabase: SupabaseClient<Database>;
  let patientPartyId = '';
  let providerPartyId = '';
  let verifierUserId = '';
  let journeyId = '';
  let encounterId = '';
  let clinicalOrderId = '';
  let imagingClinicalOrderId = '';
  let medicationClinicalOrderId = '';
  let labOrderId = '';
  let imagingOrderId = '';
  let prescriptionId = '';
  let medicationAdministrationId = '';
  let inventoryItemId = '';
  let medicationCode = '';
  let vitalSignsId = '';
  let createRequestId = '';
  let approveRequestId = '';
  let imagingCreateRequestId = '';
  let imagingApproveRequestId = '';
  let medicationCreateRequestId = '';
  let medicationApproveRequestId = '';

  beforeEach(async () => {
    supabase = createSupabaseClient<Database>(getSupabaseAdminUrl(), getSupabaseAdminKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    patientPartyId = randomUUID();
    providerPartyId = randomUUID();
    verifierUserId = randomUUID();
    journeyId = randomUUID();
    encounterId = randomUUID();
    clinicalOrderId = '';
    imagingClinicalOrderId = '';
    medicationClinicalOrderId = '';
    labOrderId = '';
    imagingOrderId = '';
    prescriptionId = '';
    medicationAdministrationId = '';
    inventoryItemId = randomUUID();
    medicationCode = `HOSP-MED-${randomUUID().slice(0, 8)}`;
    vitalSignsId = '';
    createRequestId = randomUUID();
    approveRequestId = randomUUID();
    imagingCreateRequestId = randomUUID();
    imagingApproveRequestId = randomUUID();
    medicationCreateRequestId = randomUUID();
    medicationApproveRequestId = randomUUID();

    await insertOrThrow(supabase, 'party_parties', {
      id: patientPartyId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      party_type: 'person',
      display_name: 'Hospital Real DB Patient',
    });

    await insertOrThrow(supabase, 'party_parties', {
      id: providerPartyId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      party_type: 'person',
      display_name: 'Hospital Real DB Provider',
    });

    await insertOrThrow(supabase, 'users', {
      id: verifierUserId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      email: `hospital-lab-verifier-${verifierUserId}@example.test`,
      full_name: 'Hospital Lab Verifier',
      role: 'admin',
      status: 'active',
    });

    await insertOrThrow(supabase, 'journey_journeys', {
      id: journeyId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      primary_party_id: patientPartyId,
      journey_type: 'clinical_journey',
      vertical: 'healthcare',
      status: 'active',
    });

    await insertOrThrow(supabase, 'hc_encounters', {
      id: encounterId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      patient_party_id: patientPartyId,
      doctor_party_id: providerPartyId,
      care_journey_id: journeyId,
      encounter_class: 'AMB',
      encounter_type: 'outpatient',
      status: 'in-progress',
      scheduled_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      period_start: new Date().toISOString(),
    });

    const { error: inventoryError } = await supabase.from('inventory_items').insert({
      id: inventoryItemId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      sku: medicationCode,
      name: `Medication ${medicationCode}`,
      stock_level: 10,
      unit: 'tablet',
      min_stock_level: 0,
      price_per_unit: 100,
      updated_at: new Date().toISOString(),
    });

    if (inventoryError) {
      throw new Error(`inventory_items seed failed: ${inventoryError.message}`);
    }

    clearServiceCache();
  });

  afterEach(async () => {
    if (medicationAdministrationId) {
      await supabase.from('hc_medication_administration_records').delete().eq('id', medicationAdministrationId);
    }
    if (prescriptionId) {
      await supabase.from('hc_prescriptions').delete().eq('id', prescriptionId);
    }
    if (labOrderId) {
      await supabase.from('hc_lab_orders').delete().eq('id', labOrderId);
    }
    if (imagingOrderId) {
      await supabase.from('hc_imaging_orders').delete().eq('id', imagingOrderId);
    }
    if (vitalSignsId) {
      await supabase.from('hc_nursing_vital_signs').delete().eq('id', vitalSignsId);
    }
    if (clinicalOrderId) {
      await supabase.from('hc_clinical_orders').delete().eq('id', clinicalOrderId);
    }
    if (imagingClinicalOrderId) {
      await supabase.from('hc_clinical_orders').delete().eq('id', imagingClinicalOrderId);
    }
    if (medicationClinicalOrderId) {
      await supabase.from('hc_clinical_orders').delete().eq('id', medicationClinicalOrderId);
    }
    await supabase.from('hc_idempotency_keys').delete().in('request_id', [
      createRequestId,
      approveRequestId,
      imagingCreateRequestId,
      imagingApproveRequestId,
      medicationCreateRequestId,
      medicationApproveRequestId,
    ]);
    if (inventoryItemId) {
      await supabase.from('inventory_items').delete().eq('id', inventoryItemId);
    }
    if (encounterId) {
      await supabase.from('hc_medication_administration_records').delete().eq('tenant_id', HEALTHCARE_TEST_TENANT_ID).eq('encounter_id', encounterId);
      await supabase.from('hc_prescriptions').delete().eq('tenant_id', HEALTHCARE_TEST_TENANT_ID).eq('encounter_id', encounterId);
      await supabase.from('hc_lab_orders').delete().eq('tenant_id', HEALTHCARE_TEST_TENANT_ID).eq('encounter_id', encounterId);
      await supabase.from('hc_imaging_orders').delete().eq('tenant_id', HEALTHCARE_TEST_TENANT_ID).eq('encounter_id', encounterId);
      await supabase.from('hc_nursing_vital_signs').delete().eq('tenant_id', HEALTHCARE_TEST_TENANT_ID).eq('encounter_id', encounterId);
      await supabase.from('hc_encounters').delete().eq('id', encounterId);
    }
    if (journeyId) {
      await supabase.from('journey_journeys').delete().eq('id', journeyId);
    }
    if (verifierUserId) {
      await supabase.from('users').delete().eq('id', verifierUserId);
    }
    await supabase
      .from('party_parties')
      .delete()
      .in('id', [patientPartyId, providerPartyId].filter(Boolean));
    clearServiceCache();
  });

  it('persists and isolates Hospital clinical order to verified lab result', async () => {
    const orderEngine = getHealthcareService<OrderEngineContract>('order-engine', supabase);
    const laboratoryEngine = getHealthcareService<ILaboratoryEngine>('laboratory-engine', supabase);
    const imagingEngine = getHealthcareService<IImagingEngine>('imaging-engine', supabase);
    const nursingEngine = getHealthcareService<NursingEngineContract>('nursing-engine', supabase);
    const pharmacyEngine = getHealthcareService<PharmacyEngineContract>('pharmacy-engine', supabase);
    const clinicalOrders = new HospitalClinicalOrdersProductService(orderEngine);
    const laboratory = new HospitalLaboratoryProductService(clinicalOrders, laboratoryEngine);
    const imaging = new HospitalImagingProductService(clinicalOrders, imagingEngine);
    const nursing = new HospitalNursingProductService(nursingEngine);
    const medicationPharmacyMar = new HospitalMedicationPharmacyMarProductService(
      clinicalOrders,
      pharmacyEngine
    );

    const labResult = await laboratory.completeLaboratoryWorkflow({
      requestId: createRequestId,
      approvalRequestId: approveRequestId,
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      priority: 'ROUTINE',
      orderDetails: {
        testCode: 'K',
        testName: 'Potassium',
        specimenType: 'Serum',
      },
      actor: {
        actorId: providerPartyId,
        role: 'doctor',
      },
      sampleType: 'Serum',
      tubeColor: 'Gold',
      resultValue: '4.5',
      resultUnit: 'mEq/L',
      verifiedBy: verifierUserId,
    });

    clinicalOrderId = labResult.orderId;
    labOrderId = labResult.labOrderId;

    expect(labResult).toMatchObject({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      orderStatus: 'APPROVED',
      labWorkflowStatus: 'VERIFIED',
      resultStatus: 'VERIFIED',
    });

    const imagingResult = await imaging.completeImagingWorkflow({
      requestId: imagingCreateRequestId,
      approvalRequestId: imagingApproveRequestId,
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      priority: 'ROUTINE',
      orderDetails: {
        modalityCode: 'XRAY',
        bodyRegion: 'CHEST',
        withContrast: false,
        clinicalIndication: 'Cough',
      },
      actor: {
        actorId: providerPartyId,
        role: 'doctor',
      },
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: verifierUserId,
    });

    imagingClinicalOrderId = imagingResult.orderId;
    imagingOrderId = imagingResult.imagingOrderId;

    expect(imagingResult).toMatchObject({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      orderStatus: 'APPROVED',
      imagingWorkflowStatus: 'VERIFIED',
      resultStatus: 'VERIFIED',
    });

    const nursingResult = await nursing.recordVitalSigns({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      recordedBy: verifierUserId,
      temperature: { value: 37, unit: 'C' },
      bloodPressure: { systolic: 120, diastolic: 80 },
      heartRate: { value: 75, unit: 'bpm' },
      oxygenSaturation: { value: 98, unit: '%' },
    });

    vitalSignsId = nursingResult.vitalSignsId;

    expect(nursingResult).toMatchObject({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      recordedBy: verifierUserId,
    });

    const medicationResult = await medicationPharmacyMar.completeMedicationPharmacyMarChain({
      requestId: medicationCreateRequestId,
      approvalRequestId: medicationApproveRequestId,
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      priority: 'ROUTINE',
      orderDetails: {
        drugCode: medicationCode,
        drugName: `Medication ${medicationCode}`,
        dose: 500,
        doseUnit: 'mg',
        route: 'PO',
        frequency: 'BID',
        durationDays: 3,
        currentMedicationCodes: [],
      },
      actor: {
        actorId: providerPartyId,
        role: 'doctor',
      },
      pharmacistId: verifierUserId,
      administeredBy: verifierUserId,
      administeredAt: new Date().toISOString(),
      dosageGiven: { value: 500, unit: 'mg' },
      route: 'PO',
      administrationNotes: 'Hospital Real DB MAR proof',
    });

    medicationClinicalOrderId = medicationResult.medicationOrder.orderId;
    medicationAdministrationId = medicationResult.mar.medicationAdministrationId;
    prescriptionId = medicationResult.pharmacy.verificationId;

    expect(medicationResult.medicationOrder).toMatchObject({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      orderStatus: 'APPROVED',
    });
    expect(medicationResult.pharmacy).toMatchObject({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      orderId: medicationClinicalOrderId,
      verificationStatus: 'VERIFIED',
      dispensedMedicationStatus: 'active',
      dispensedBy: verifierUserId,
    });
    expect(medicationResult.mar).toMatchObject({
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      patientId: patientPartyId,
      encounterId,
      orderId: medicationClinicalOrderId,
      administeredBy: verifierUserId,
    });

    const clinicalReadBack = await supabase
      .from('hc_clinical_orders')
      .select('id, tenant_id, encounter_id, patient_party_id, order_status')
      .eq('id', clinicalOrderId)
      .single();
    expect(clinicalReadBack.error).toBeNull();
    expect(clinicalReadBack.data).toMatchObject({
      id: clinicalOrderId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      patient_party_id: patientPartyId,
      order_status: 'APPROVED',
    });

    const labReadBack = await supabase
      .from('hc_lab_orders')
      .select('id, tenant_id, encounter_id, clinical_order_id, result_value, verified_by, verified_at')
      .eq('id', labOrderId)
      .single();
    expect(labReadBack.error).toBeNull();
    expect(labReadBack.data).toMatchObject({
      id: labOrderId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      clinical_order_id: clinicalOrderId,
      result_value: '4.5',
      verified_by: verifierUserId,
    });
    expect(labReadBack.data?.verified_at).toBeTruthy();

    const imagingReadBack = await supabase
      .from('hc_imaging_orders')
      .select('id, tenant_id, encounter_id, clinical_order_id, modality, body_site, radiologist_report, radiologist_id, verified_at')
      .eq('id', imagingOrderId)
      .single();
    expect(imagingReadBack.error).toBeNull();
    expect(imagingReadBack.data).toMatchObject({
      id: imagingOrderId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      clinical_order_id: imagingClinicalOrderId,
      modality: 'XRAY',
      body_site: 'CHEST',
      radiologist_report: 'No acute cardiopulmonary abnormality.',
      radiologist_id: verifierUserId,
    });
    expect(imagingReadBack.data?.verified_at).toBeTruthy();

    const nursingReadBack = await supabase
      .from('hc_nursing_vital_signs')
      .select('id, tenant_id, encounter_id, patient_id, nurse_practitioner_id')
      .eq('id', vitalSignsId)
      .single();
    expect(nursingReadBack.error).toBeNull();
    expect(nursingReadBack.data).toMatchObject({
      id: vitalSignsId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      patient_id: patientPartyId,
      nurse_practitioner_id: verifierUserId,
    });

    const prescriptionReadBack = await supabase
      .from('hc_prescriptions')
      .select('id, tenant_id, encounter_id, patient_party_id, clinical_order_id, status')
      .eq('id', prescriptionId)
      .single();
    expect(prescriptionReadBack.error).toBeNull();
    expect(prescriptionReadBack.data).toMatchObject({
      id: prescriptionId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      patient_party_id: patientPartyId,
      clinical_order_id: medicationClinicalOrderId,
      status: 'mar_ready',
    });

    const medicationAdministrationReadBack = await supabase
      .from('hc_medication_administration_records')
      .select('id, tenant_id, encounter_id, prescription_item_id, administered_by_nurse_id, status')
      .eq('id', medicationAdministrationId)
      .single();
    expect(medicationAdministrationReadBack.error).toBeNull();
    expect(medicationAdministrationReadBack.data).toMatchObject({
      id: medicationAdministrationId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      prescription_item_id: prescriptionId,
      administered_by_nurse_id: verifierUserId,
      status: 'administered',
    });

    const sameTenantClient = createTenantRlsClient(HEALTHCARE_TEST_TENANT_ID, verifierUserId);
    const otherTenantClient = createTenantRlsClient(randomUUID(), randomUUID());

    const sameTenantClinicalOrder = await sameTenantClient
      .from('hc_clinical_orders')
      .select('id, patient_party_id')
      .eq('id', clinicalOrderId);
    expect(sameTenantClinicalOrder.error).toBeNull();
    expect(sameTenantClinicalOrder.data).toHaveLength(1);
    expect(sameTenantClinicalOrder.data?.[0]?.patient_party_id).toBe(patientPartyId);

    const sameTenantLabOrder = await sameTenantClient
      .from('hc_lab_orders')
      .select('id, clinical_order_id')
      .eq('id', labOrderId);
    expect(sameTenantLabOrder.error).toBeNull();
    expect(sameTenantLabOrder.data).toHaveLength(1);
    expect(sameTenantLabOrder.data?.[0]?.clinical_order_id).toBe(clinicalOrderId);

    const sameTenantImagingOrder = await sameTenantClient
      .from('hc_imaging_orders')
      .select('id, clinical_order_id')
      .eq('id', imagingOrderId);
    expect(sameTenantImagingOrder.error).toBeNull();
    expect(sameTenantImagingOrder.data).toHaveLength(1);
    expect(sameTenantImagingOrder.data?.[0]?.clinical_order_id).toBe(imagingClinicalOrderId);

    const sameTenantVitalSigns = await sameTenantClient
      .from('hc_nursing_vital_signs')
      .select('id, patient_id')
      .eq('id', vitalSignsId);
    expect(sameTenantVitalSigns.error).toBeNull();
    expect(sameTenantVitalSigns.data).toHaveLength(1);
    expect(sameTenantVitalSigns.data?.[0]?.patient_id).toBe(patientPartyId);

    const sameTenantPrescription = await sameTenantClient
      .from('hc_prescriptions')
      .select('id, clinical_order_id')
      .eq('id', prescriptionId);
    expect(sameTenantPrescription.error).toBeNull();
    expect(sameTenantPrescription.data).toHaveLength(1);
    expect(sameTenantPrescription.data?.[0]?.clinical_order_id).toBe(medicationClinicalOrderId);

    const sameTenantMedicationAdministration = await sameTenantClient
      .from('hc_medication_administration_records')
      .select('id, prescription_item_id')
      .eq('id', medicationAdministrationId);
    expect(sameTenantMedicationAdministration.error).toBeNull();
    expect(sameTenantMedicationAdministration.data).toHaveLength(1);
    expect(sameTenantMedicationAdministration.data?.[0]?.prescription_item_id).toBe(prescriptionId);

    const crossTenantClinicalOrder = await otherTenantClient
      .from('hc_clinical_orders')
      .select('id')
      .eq('id', clinicalOrderId);
    expect(crossTenantClinicalOrder.error).toBeNull();
    expect(crossTenantClinicalOrder.data).toHaveLength(0);

    const crossTenantLabOrder = await otherTenantClient
      .from('hc_lab_orders')
      .select('id')
      .eq('id', labOrderId);
    expect(crossTenantLabOrder.error).toBeNull();
    expect(crossTenantLabOrder.data).toHaveLength(0);

    const crossTenantImagingOrder = await otherTenantClient
      .from('hc_imaging_orders')
      .select('id')
      .eq('id', imagingOrderId);
    expect(crossTenantImagingOrder.error).toBeNull();
    expect(crossTenantImagingOrder.data).toHaveLength(0);

    const crossTenantVitalSigns = await otherTenantClient
      .from('hc_nursing_vital_signs')
      .select('id')
      .eq('id', vitalSignsId);
    expect(crossTenantVitalSigns.error).toBeNull();
    expect(crossTenantVitalSigns.data).toHaveLength(0);

    const crossTenantPrescription = await otherTenantClient
      .from('hc_prescriptions')
      .select('id')
      .eq('id', prescriptionId);
    expect(crossTenantPrescription.error).toBeNull();
    expect(crossTenantPrescription.data).toHaveLength(0);

    const crossTenantMedicationAdministration = await otherTenantClient
      .from('hc_medication_administration_records')
      .select('id')
      .eq('id', medicationAdministrationId);
    expect(crossTenantMedicationAdministration.error).toBeNull();
    expect(crossTenantMedicationAdministration.data).toHaveLength(0);

  });
});
