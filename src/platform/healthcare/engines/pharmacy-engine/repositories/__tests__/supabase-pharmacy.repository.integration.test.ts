import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { Prescription, MAREntry, PrescriptionDrugItem } from '../../domain/prescription.entity';
import { SupabasePharmacyRepository } from '../supabase-pharmacy.repository';
import { SupabaseClinicalOrderReader } from '../supabase-clinical-order-reader';
import { OptimisticLockError, UniqueConstraintViolationError } from '../pharmacy-repository.interface';
import { ScreeningResult } from '../../domain/screening-policies';

describe('SupabasePharmacyRepository & Reader Integration Tests (H6 Refined)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let repository: SupabasePharmacyRepository;
  let reader: SupabaseClinicalOrderReader;
  let fixtures: HealthcareTestFixture;

  const clinicalOrderId = randomUUID();
  const otherClinicalOrderId = randomUUID();
  let createdPrescriptionIds: string[] = [];
  let createdMARIds: string[] = [];
  let createdAdmissionIds: string[] = [];
  let createdOrderIds: string[] = [];
  let createdInventoryItemIds: string[] = [];

  const drugs: PrescriptionDrugItem[] = [
    {
      code: 'PARACETAMOL',
      name: 'Paracetamol 500mg',
      dose: '500mg',
      frequency: 'QID',
      durationDays: 5,
    },
  ];

  beforeEach(async () => {
    fixtures = await HealthcareTestFixtures.setup();
    supabase = await createClient();
    repository = new SupabasePharmacyRepository(supabase);
    reader = new SupabaseClinicalOrderReader(supabase);

    // Bootstrap a clinical order record to reference (violating FK constraint otherwise)
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
        id: otherClinicalOrderId,
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
    ]);
    createdOrderIds.push(clinicalOrderId, otherClinicalOrderId);
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

    // Teardown admissions
    if (createdAdmissionIds.length > 0) {
      await supabase.from('hc_inpatient_admissions').delete().in('id', createdAdmissionIds);
      createdAdmissionIds = [];
    }

    // Teardown clinical orders
    if (createdOrderIds.length > 0) {
      await supabase.from('hc_clinical_orders').delete().in('id', createdOrderIds);
      createdOrderIds = [];
    }

    // Teardown inventory items
    if (createdInventoryItemIds.length > 0) {
      await supabase.from('inventory_items').delete().in('sku', createdInventoryItemIds);
      createdInventoryItemIds = [];
    }

    await fixtures.cleanup();
  });

  describe('ClinicalOrderReader Integration', () => {
    it('should successfully read a clinical order snapshot directly from DB', async () => {
      const snapshot = await reader.getOrderSnapshot(fixtures.tenantId, clinicalOrderId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.id).toBe(clinicalOrderId);
      expect(snapshot?.drugCode).toBe('PARACETAMOL');
      expect(snapshot?.dose).toBe(500);
    });
  });

  describe('Prescription Persistence & Metadata Mapping', () => {
    it('should successfully save and load a Prescription aggregate with metadata', async () => {
      const prescription = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs,
        isHighAlert: true,
      });
      createdPrescriptionIds.push(prescription.id);

      // Verify and set state before saving
      prescription.verify(fixtures.providerPartyId, ScreeningResult.clear());
      await repository.savePrescription(prescription);

      // Load by ID
      const loaded = await repository.findPrescriptionById(fixtures.tenantId, prescription.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(prescription.id);
      expect(loaded?.status).toBe('PENDING_VERIFICATION'); // High alert stays pending until second verify
      expect(loaded?.dualVerificationState).toBe('VERIFICATION_1');
      expect(loaded?.isHighAlert).toBe(true);
      expect(loaded?.verifications).toHaveLength(1);
    });

    it('should enforce unique clinical_order_id constraint on insert', async () => {
      const prescription1 = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs,
      });
      createdPrescriptionIds.push(prescription1.id);

      await repository.savePrescription(prescription1);

      const prescription2 = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId, // duplicate order id
        drugs,
      });
      createdPrescriptionIds.push(prescription2.id);

      await expect(repository.savePrescription(prescription2)).rejects.toThrow(UniqueConstraintViolationError);
    });

    it('should enforce optimistic locking on updates', async () => {
      const prescription = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs,
      });
      createdPrescriptionIds.push(prescription.id);

      await repository.savePrescription(prescription);

      const instance1 = await repository.findPrescriptionById(fixtures.tenantId, prescription.id);
      const instance2 = await repository.findPrescriptionById(fixtures.tenantId, prescription.id);
      expect(instance1).not.toBeNull();
      expect(instance2).not.toBeNull();

      instance1!.verify(fixtures.providerPartyId, ScreeningResult.clear());
      await repository.savePrescription(instance1!);
      expect(instance1!.version).toBe(2);

      instance2!.reject(fixtures.providerPartyId, 'Stale update');
      await expect(repository.savePrescription(instance2!)).rejects.toThrow(OptimisticLockError);
    });
  });

  describe('Inventory Stock Management', () => {
    it('should set stock and deduct stock atomically', async () => {
      const medCode = 'PARA-TEST-1';
      createdInventoryItemIds.push(medCode);

      // Set Stock
      await repository.setStock(fixtures.tenantId, medCode, 10);
      expect(await repository.getStock(fixtures.tenantId, medCode)).toBe(10);

      // Deduct Stock
      await repository.deductStock(fixtures.tenantId, medCode, 3);
      expect(await repository.getStock(fixtures.tenantId, medCode)).toBe(7);
    });

    it('should fail stock deduction if insufficient stock', async () => {
      const medCode = 'PARA-TEST-2';
      createdInventoryItemIds.push(medCode);

      await repository.setStock(fixtures.tenantId, medCode, 2);
      await expect(repository.deductStock(fixtures.tenantId, medCode, 5)).rejects.toThrow();
    });
  });

  describe('MAR Persistence', () => {
    it('should successfully save and load a MAR record with encounterId', async () => {
      const mar = MAREntry.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        prescriptionItemId: randomUUID(),
        drugName: 'Paracetamol 500mg',
        dosage: '500mg',
        route: 'PO',
        scheduledTime: new Date(),
      });
      createdMARIds.push(mar.id);

      await repository.saveMAR(mar);

      const loaded = await repository.findMARById(fixtures.tenantId, mar.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(mar.id);
      expect(loaded?.status).toBe('scheduled');
      expect(loaded?.encounterId).toBe(fixtures.encounterId);
    });
  });
});
