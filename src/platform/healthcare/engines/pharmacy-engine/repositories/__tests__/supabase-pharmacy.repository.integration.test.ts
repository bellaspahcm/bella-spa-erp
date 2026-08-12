import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { Prescription, MAREntry, PrescriptionDrugItem } from '../../domain/prescription.entity';
import { SupabasePharmacyRepository } from '../supabase-pharmacy.repository';
import { SupabaseClinicalOrderReader } from '../supabase-clinical-order-reader';
import { OptimisticLockError, UniqueConstraintViolationError } from '../pharmacy-repository.interface';

describe('SupabasePharmacyRepository & Reader Integration Tests (4B.2)', () => {
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

  const drugs: PrescriptionDrugItem[] = [
    {
      code: 'A02B',
      name: 'Omeprazole 20mg',
      dose: '1 capsule',
      frequency: 'QD',
      durationDays: 14,
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
          drugCode: 'A02B',
          drugName: 'Omeprazole 20mg',
          dose: 20,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'QD',
          durationDays: 14,
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
          drugCode: 'A02B',
          drugName: 'Omeprazole 20mg',
          dose: 20,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'QD',
          durationDays: 14,
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

    await fixtures.cleanup();
  });

  describe('ClinicalOrderReader Integration', () => {
    it('should successfully read a clinical order snapshot directly from DB', async () => {
      const snapshot = await reader.getOrderSnapshot(fixtures.tenantId, clinicalOrderId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.id).toBe(clinicalOrderId);
      expect(snapshot?.drugCode).toBe('A02B');
      expect(snapshot?.dose).toBe(20);
    });

    it('should return null for non-existent clinical order', async () => {
      const snapshot = await reader.getOrderSnapshot(fixtures.tenantId, randomUUID());
      expect(snapshot).toBeNull();
    });
  });

  describe('Prescription Persistence', () => {
    it('should successfully save and load a Prescription aggregate', async () => {
      const prescription = Prescription.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientPartyId: fixtures.patientPartyId,
        doctorPartyId: fixtures.providerPartyId,
        clinicalOrderId,
        drugs,
      });
      createdPrescriptionIds.push(prescription.id);

      // Save
      await repository.savePrescription(prescription);

      // Load by ID
      const loaded = await repository.findPrescriptionById(fixtures.tenantId, prescription.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(prescription.id);
      expect(loaded?.status).toBe('PENDING_REVIEW');
      expect(loaded?.clinicalOrderId).toBe(clinicalOrderId);
      expect(loaded?.drugs).toHaveLength(1);
      expect(loaded?.drugs[0].code).toBe('A02B');

      // Load by Clinical Order ID
      const loadedByOrder = await repository.findPrescriptionByClinicalOrderId(fixtures.tenantId, clinicalOrderId);
      expect(loadedByOrder).not.toBeNull();
      expect(loadedByOrder?.id).toBe(prescription.id);
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

      // Try to create second prescription referencing same clinical order
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

      // Load two instances representing two separate concurrent updates
      const instance1 = await repository.findPrescriptionById(fixtures.tenantId, prescription.id);
      const instance2 = await repository.findPrescriptionById(fixtures.tenantId, prescription.id);
      expect(instance1).not.toBeNull();
      expect(instance2).not.toBeNull();

      // Instance 1 transitions and saves
      instance1!.approve(fixtures.providerPartyId);
      await repository.savePrescription(instance1!);
      expect(instance1!.version).toBe(2);

      // Instance 2 (stale version 1) tries to transition and save
      instance2!.reject(fixtures.providerPartyId, 'Stale update');
      await expect(repository.savePrescription(instance2!)).rejects.toThrow(OptimisticLockError);
    });
  });

  describe('MAR Persistence & Consistency Trigger', () => {
    it('should successfully save and load a MAR record with encounterId', async () => {
      const mar = MAREntry.create({
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        prescriptionItemId: randomUUID(),
        drugName: 'Omeprazole 20mg',
        dosage: '1 capsule',
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
      expect(loaded?.inpatientAdmissionId).toBeUndefined();
    });

    it('should fail insertion when cross-table encounter consistency trigger is violated', async () => {
      // 1. Create a real inpatient admission linked to encounter A
      const admissionId = randomUUID();
      await supabase.from('hc_inpatient_admissions').insert({
        id: admissionId,
        tenant_id: fixtures.tenantId,
        patient_party_id: fixtures.patientPartyId,
        encounter_id: fixtures.encounterId, // encounter A
        status: 'admitted',
        admitted_at: new Date().toISOString(),
      });
      createdAdmissionIds.push(admissionId);

      // 2. Generate a separate encounter B ID (non-existent/different encounter context)
      const separateEncounterId = randomUUID();

      // 3. Save a MAR entry referencing the admission, but encounter B
      const inconsistentMAR = MAREntry.reconstitute({
        id: randomUUID(),
        tenantId: fixtures.tenantId,
        inpatientAdmissionId: admissionId,
        encounterId: separateEncounterId, // mismatch encounter
        prescriptionItemId: randomUUID(),
        drugName: 'Omeprazole 20mg',
        dosage: '1 capsule',
        route: 'PO',
        scheduledTime: new Date(),
        status: 'scheduled',
        createdAt: new Date(),
      });
      createdMARIds.push(inconsistentMAR.id);

      // DB Trigger verify_mar_encounter_consistency must raise an exception aborting transaction
      await expect(repository.saveMAR(inconsistentMAR)).rejects.toThrow();
    });
  });
});
