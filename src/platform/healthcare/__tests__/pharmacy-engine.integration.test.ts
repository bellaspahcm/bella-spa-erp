import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { PharmacyEngineService } from '../engines/pharmacy-engine/pharmacy-engine.service';
import { Prescription } from '../engines/pharmacy-engine/domain/prescription.entity';
import { eventBus } from '@/platform/host/event-bus';
import { ScreeningResult } from '../engines/pharmacy-engine/domain/screening-policies';

describe('H6 Pharmacy Verification Integration Test Suite', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  let service: PharmacyEngineService;

  let createdPrescriptionIds: string[] = [];
  let createdOrderIds: string[] = [];
  let createdAllergyIds: string[] = [];
  let createdInventorySkus: string[] = [];
  let createdMARIds: string[] = [];

  const clinicalOrderId = randomUUID();
  const highAlertClinicalOrderId = randomUUID();
  const pharmacistA = randomUUID();
  const pharmacistB = randomUUID();
  const nurseId = randomUUID();

  beforeEach(async () => {
    fixtures = await HealthcareTestFixtures.setup();
    supabase = await createClient();
    service = new PharmacyEngineService(supabase);

    // Bootstrap clinical orders
    await supabase.from('hc_clinical_orders').insert([
      {
        id: clinicalOrderId,
        tenant_id: fixtures.tenantId,
        encounter_id: fixtures.encounterId,
        patient_party_id: fixtures.patientPartyId,
        order_type: 'MEDICATION',
        order_status: 'APPROVED',
        ordered_by: fixtures.providerPartyId,
        order_details: {
          drugCode: 'PARACETAMOL',
          drugName: 'Paracetamol 500mg',
          dose: 500,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'QID',
          durationDays: 5,
        },
      },
      {
        id: highAlertClinicalOrderId,
        tenant_id: fixtures.tenantId,
        encounter_id: fixtures.encounterId,
        patient_party_id: fixtures.patientPartyId,
        order_type: 'MEDICATION',
        order_status: 'APPROVED',
        ordered_by: fixtures.providerPartyId,
        order_details: {
          drugCode: 'WARFARIN',
          drugName: 'Warfarin 5mg',
          dose: 5,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'QD',
          durationDays: 30,
        },
      },
    ]);
    createdOrderIds.push(clinicalOrderId, highAlertClinicalOrderId);
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

    // Teardown patient allergies
    if (createdAllergyIds.length > 0) {
      await supabase.from('hc_patient_allergies').delete().in('id', createdAllergyIds);
      createdAllergyIds = [];
    }

    // Teardown inventory items
    if (createdInventorySkus.length > 0) {
      await supabase.from('inventory_items').delete().in('sku', createdInventorySkus);
      createdInventorySkus = [];
    }

    await fixtures.cleanup();
  });

  describe('Gate 1: Verify Clear Prescription', () => {
    it('should successfully verify a clear prescription', async () => {
      // 1. Create a prescription aggregate
      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [
          {
            code: 'PARACETAMOL',
            name: 'Paracetamol 500mg',
            dose: '500mg',
            frequency: 'QID',
            durationDays: 5,
          },
        ],
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // 2. Verify prescription
      const res = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        pharmacistId: pharmacistA,
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('VERIFIED');
      expect(res.data?.safetyState).toBe('NO_BLOCK');
    });
  });

  describe('Gate 2: Allergy Block check', () => {
    it('should prevent verification if patient is allergic to proposed drug', async () => {
      // 1. Add allergy to patient
      const allergyId = randomUUID();
      await supabase.from('hc_patient_allergies').insert({
        id: allergyId,
        tenant_id: fixtures.tenantId,
        patient_id: fixtures.patientPartyId,
        encounter_id: fixtures.encounterId,
        allergen_code: 'ALLERGEN-PARA',
        allergen_name: 'Paracetamol',
        allergen_type: 'DRUG',
        severity: 'SEVERE',
        reaction_type: 'ANAPHYLAXIS',
        is_active: true,
        recorded_by: fixtures.providerPartyId,
      });
      createdAllergyIds.push(allergyId);

      // 2. Create prescription
      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [
          {
            code: 'PARACETAMOL',
            name: 'Paracetamol 500mg',
            dose: '500mg',
            frequency: 'QID',
            durationDays: 5,
          },
        ],
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // 3. Verify must fail
      const res = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        pharmacistId: pharmacistA,
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('blocked due to critical screening findings');
    });
  });

  describe('Gate 3: Warning Screening and Override', () => {
    it('should require override for safety warning', async () => {
      // 1. Add active conflicting medication
      const activeOrderId = randomUUID();
      await supabase.from('hc_clinical_orders').insert({
        id: activeOrderId,
        tenant_id: fixtures.tenantId,
        encounter_id: fixtures.encounterId,
        patient_party_id: fixtures.patientPartyId,
        order_type: 'MEDICATION',
        order_status: 'APPROVED',
        ordered_by: fixtures.providerPartyId,
        order_details: {
          drugCode: 'WARFARIN',
          drugName: 'Warfarin 5mg',
          dose: 5,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'QD',
          durationDays: 30,
        },
      });
      createdOrderIds.push(activeOrderId);

      const activeRx = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId: activeOrderId,
        drugs: [
          {
            code: 'WARFARIN',
            name: 'Warfarin 5mg',
            dose: '5mg',
            frequency: 'QD',
            durationDays: 30,
          },
        ],
      });
      activeRx.verify(pharmacistA, ScreeningResult.clear());
      activeRx.dispense(pharmacistA);
      createdPrescriptionIds.push(activeRx.id);
      await service['pharmacyRepository'].savePrescription(activeRx);

      // 2. Create Paracetamol prescription (has interaction warning with active Warfarin)
      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [
          {
            code: 'PARACETAMOL',
            name: 'Paracetamol 500mg',
            dose: '500mg',
            frequency: 'QID',
            durationDays: 5,
          },
        ],
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // 3. Try to verify without override - must fail requesting override
      const res1 = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        pharmacistId: pharmacistA,
      });
      expect(res1.success).toBe(false);
      expect(res1.error?.message).toContain('override rationale required');

      // 4. Try with valid override rationale - must succeed
      const res2 = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        pharmacistId: pharmacistA,
        overrides: [
          { warningCode: 'INTERACTION_WARFARIN', rationale: 'Patient coagulation is monitored.' },
        ],
      });
      expect(res2.success).toBe(true);
      expect(res2.data?.status).toBe('VERIFIED');
      expect(res2.data?.safetyState).toBe('ACKNOWLEDGED');
    });
  });

  describe('Gate 4 & 5: Dual Verification and Concurrency', () => {
    it('should enforce dual verification by two distinct pharmacists for High-Alert meds', async () => {
      // 1. Create High-Alert prescription (Warfarin is high-alert in definition)
      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId: highAlertClinicalOrderId,
        drugs: [
          {
            code: 'WARFARIN',
            name: 'Warfarin 5mg',
            dose: '5mg',
            frequency: 'QD',
            durationDays: 30,
          },
        ],
        isHighAlert: true,
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // 2. Pharmacist A verifys (verification 1)
      const res1 = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: highAlertClinicalOrderId,
        pharmacistId: pharmacistA,
      });
      expect(res1.success).toBe(true);
      expect(res1.data?.status).toBe('PENDING_VERIFICATION');

      // 3. Pharmacist A verifys again - must fail (cannot verify twice)
      const res2 = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: highAlertClinicalOrderId,
        pharmacistId: pharmacistA,
      });
      expect(res2.success).toBe(false);
      expect(res2.error?.message).toContain('two distinct pharmacists');

      // 4. Pharmacist B verifys (verification 2) - must succeed and transition status to VERIFIED
      const res3 = await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: highAlertClinicalOrderId,
        pharmacistId: pharmacistB,
      });
      expect(res3.success).toBe(true);
      expect(res3.data?.status).toBe('VERIFIED');
    });

    it('should handle parallel verifications concurrently and prevent race conditions via OCC', async () => {
      // Create High-Alert prescription
      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId: highAlertClinicalOrderId,
        drugs: [
          {
            code: 'WARFARIN',
            name: 'Warfarin 5mg',
            dose: '5mg',
            frequency: 'QD',
            durationDays: 30,
          },
        ],
        isHighAlert: true,
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // Dispatch concurrent calls using the same pharmacist ID (simulate race condition)
      const results = await Promise.all([
        service.verifyPrescription({ tenantId: fixtures.tenantId, medicationOrderId: highAlertClinicalOrderId, pharmacistId: pharmacistA }),
        service.verifyPrescription({ tenantId: fixtures.tenantId, medicationOrderId: highAlertClinicalOrderId, pharmacistId: pharmacistA }),
      ]);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      // Exactly one should succeed, the other fails due to Optimistic Lock OCC check
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
    });
  });

  describe('Gate 6: Stock deduction and Concurrency', () => {
    it('should successfully dispense when stock is available', async () => {
      const medCode = 'PARA-DISP';
      createdInventorySkus.push(medCode);

      // Initialize stock
      await service['pharmacyRepository'].setStock(fixtures.tenantId, medCode, 5);

      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [
          {
            code: medCode,
            name: 'Paracetamol 500mg',
            dose: '500mg',
            frequency: 'QID',
            durationDays: 5,
          },
        ],
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // Verify first
      await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        pharmacistId: pharmacistA,
      });

      // Dispense
      const res = await service.dispenseMedication({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        dispensedBy: pharmacistA,
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('active');
      expect(await service['pharmacyRepository'].getStock(fixtures.tenantId, medCode)).toBe(4);
    });

    it('should fail dispense if stock is out', async () => {
      const medCode = 'PARA-DISP-OUT';
      createdInventorySkus.push(medCode);

      await service['pharmacyRepository'].setStock(fixtures.tenantId, medCode, 0);

      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [
          {
            code: medCode,
            name: 'Paracetamol 500mg',
            dose: '500mg',
            frequency: 'QID',
            durationDays: 5,
          },
        ],
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      await service.verifyPrescription({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        pharmacistId: pharmacistA,
      });

      const res = await service.dispenseMedication({
        tenantId: fixtures.tenantId,
        medicationOrderId: clinicalOrderId,
        dispensedBy: pharmacistA,
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Insufficient stock');
    });

    it('should prevent negative stock level under concurrent dispense calls', async () => {
      const medCode = 'PARA-CONC-DISP';
      createdInventorySkus.push(medCode);

      // Setting stock level to exactly 1
      await service['pharmacyRepository'].setStock(fixtures.tenantId, medCode, 1);

      // Create two separate prescription orders
      const p1 = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [{ code: medCode, name: 'Drug', dose: '1', frequency: '1', durationDays: 1 }],
      });
      createdPrescriptionIds.push(p1.id);
      await service['pharmacyRepository'].savePrescription(p1);

      const p2 = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId: highAlertClinicalOrderId,
        drugs: [{ code: medCode, name: 'Drug', dose: '1', frequency: '1', durationDays: 1 }],
      });
      createdPrescriptionIds.push(p2.id);
      await service['pharmacyRepository'].savePrescription(p2);

      // Verify both
      await service.verifyPrescription({ tenantId: fixtures.tenantId, medicationOrderId: clinicalOrderId, pharmacistId: pharmacistA });
      await service.verifyPrescription({ tenantId: fixtures.tenantId, medicationOrderId: highAlertClinicalOrderId, pharmacistId: pharmacistA });

      // Concurrent Dispense calls
      const results = await Promise.all([
        service.dispenseMedication({ tenantId: fixtures.tenantId, medicationOrderId: clinicalOrderId, dispensedBy: pharmacistA }),
        service.dispenseMedication({ tenantId: fixtures.tenantId, medicationOrderId: highAlertClinicalOrderId, dispensedBy: pharmacistA }),
      ]);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      // Exactly 1 should succeed (stock goes 1 -> 0), the other must fail (insufficient stock)
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      expect(await service['pharmacyRepository'].getStock(fixtures.tenantId, medCode)).toBe(0);
    });
  });

  describe('Gate 7: Out-of-bounds MAR Ready check', () => {
    it('should transition status to MAR_READY when medication administration is recorded', async () => {
      const medCode = 'PARA-MAR';
      createdInventorySkus.push(medCode);
      await service['pharmacyRepository'].setStock(fixtures.tenantId, medCode, 5);

      const p = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs: [
          {
            code: medCode,
            name: 'Paracetamol 500mg',
            dose: '500mg',
            frequency: 'QID',
            durationDays: 5,
          },
        ],
      });
      createdPrescriptionIds.push(p.id);
      await service['pharmacyRepository'].savePrescription(p);

      // Verify
      await service.verifyPrescription({ tenantId: fixtures.tenantId, medicationOrderId: clinicalOrderId, pharmacistId: pharmacistA });
      // Dispense
      await service.dispenseMedication({ tenantId: fixtures.tenantId, medicationOrderId: clinicalOrderId, dispensedBy: pharmacistA });

      // Record administration
      const res = await service.recordMedicationAdministration({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        medicationOrderId: clinicalOrderId,
        administeredBy: nurseId,
        administeredAt: new Date().toISOString(),
        dosageGiven: { value: 500, unit: 'mg' },
        route: 'PO',
      });

      expect(res.success).toBe(true);
      createdMARIds.push(res.data!.id);

      // Reload prescription
      const loaded = await service['pharmacyRepository'].findPrescriptionById(fixtures.tenantId, p.id);
      expect(loaded?.status).toBe('MAR_READY');
    });
  });
});
