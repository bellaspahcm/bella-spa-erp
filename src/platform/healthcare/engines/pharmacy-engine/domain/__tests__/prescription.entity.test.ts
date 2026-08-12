import { describe, it, expect } from '@jest/globals';
import { randomUUID } from 'crypto';
import {
  Prescription,
  MAREntry,
  PrescriptionDrugItem,
  MissingRequiredFieldError,
  InvalidStateTransitionError,
  TerminalStateModifiedError,
  PrescriptionDomainError,
} from '../prescription.entity';
import { ScreeningResult, ScreeningFinding } from '../screening-policies';

describe('Prescription & MAR Domain Unit Tests (H6 Refined)', () => {
  const tenantId = randomUUID();
  const encounterId = randomUUID();
  const patientPartyId = randomUUID();
  const doctorPartyId = randomUUID();
  const clinicalOrderId = randomUUID();
  const pharmacistA = randomUUID();
  const pharmacistB = randomUUID();
  
  const drugs: PrescriptionDrugItem[] = [
    {
      code: 'PARACETAMOL',
      name: 'Paracetamol 500mg',
      dose: '500mg',
      frequency: 'QID',
      durationDays: 5,
    },
  ];

  describe('Prescription Aggregate Root', () => {
    it('should successfully create a prescription in PENDING_VERIFICATION status', () => {
      const prescription = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
        diagnosis: 'K21.9',
        notes: 'Take before breakfast',
        createdBy: doctorPartyId,
      });

      expect(prescription.id).toBeDefined();
      expect(prescription.status).toBe('PENDING_VERIFICATION');
      expect(prescription.safetyState).toBe('NO_BLOCK');
      expect(prescription.dualVerificationState).toBe('NONE');
      expect(prescription.version).toBe(1);
      expect(prescription.drugs).toHaveLength(1);
      expect(prescription.isTerminal).toBe(false);
    });

    it('should reject creation if required fields are missing', () => {
      expect(() => {
        Prescription.create({
          tenantId: '',
          encounterId,
          patientPartyId,
          doctorPartyId,
          clinicalOrderId,
          drugs,
        });
      }).toThrow(MissingRequiredFieldError);
    });

    it('should verify clear prescriptions directly', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      p.verify(pharmacistA, ScreeningResult.clear());
      expect(p.status).toBe('VERIFIED');
      expect(p.safetyState).toBe('NO_BLOCK');
      expect(p.verifications).toHaveLength(1);
      expect(p.verifications[0].pharmacistId).toBe(pharmacistA);
    });

    it('should fail verification if blocked', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      const blockedFinding: ScreeningFinding = {
        policyName: 'AllergyPolicy',
        medicationCode: 'PARACETAMOL',
        severity: 'BLOCKED',
        code: 'ALLERGY_BLOCKED',
        message: 'Severe allergy detected',
      };

      expect(() => {
        p.verify(pharmacistA, ScreeningResult.create([blockedFinding]));
      }).toThrow(PrescriptionDomainError);
      expect(p.safetyState).toBe('BLOCKED');
    });

    it('should require override for warnings', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      const warningFinding: ScreeningFinding = {
        policyName: 'DuplicateTherapyPolicy',
        medicationCode: 'PARACETAMOL',
        severity: 'WARNING',
        code: 'DUP_WARNING',
        message: 'Duplicate therapy detected',
      };

      // Fails without overrides
      expect(() => {
        p.verify(pharmacistA, ScreeningResult.create([warningFinding]));
      }).toThrow(PrescriptionDomainError);
      expect(p.safetyState).toBe('OVERRIDE_REQUIRED');

      // Succeeds with valid overrides
      p.verify(pharmacistA, ScreeningResult.create([warningFinding]), [
        { warningCode: 'DUP_WARNING', rationale: 'Clinically justified' },
      ]);
      expect(p.status).toBe('VERIFIED');
      expect(p.safetyState).toBe('ACKNOWLEDGED');
      expect(p.overrideHistory).toHaveLength(1);
      expect(p.overrideHistory[0].rationale).toBe('Clinically justified');
    });

    it('should enforce dual verification for High-Alert medications', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
        isHighAlert: true,
      });

      expect(p.dualVerificationState).toBe('HIGH_ALERT');

      // First verification
      p.verify(pharmacistA, ScreeningResult.clear());
      expect(p.status).toBe('PENDING_VERIFICATION');
      expect(p.dualVerificationState).toBe('VERIFICATION_1');

      // Cannot be verified by same pharmacist
      expect(() => {
        p.verify(pharmacistA, ScreeningResult.clear());
      }).toThrow(PrescriptionDomainError);

      // Second verification succeeds
      p.verify(pharmacistB, ScreeningResult.clear());
      expect(p.status).toBe('VERIFIED');
      expect(p.dualVerificationState).toBe('DUAL_VERIFIED');
      expect(p.verifications).toHaveLength(2);
    });

    it('should transition through verify -> dispense -> mar_ready', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      p.verify(pharmacistA, ScreeningResult.clear());
      expect(p.status).toBe('VERIFIED');

      p.dispense(doctorPartyId);
      expect(p.status).toBe('DISPENSED');

      p.markMarReady(doctorPartyId);
      expect(p.status).toBe('MAR_READY');
      expect(p.isTerminal).toBe(true);
    });

    it('should support rejection branch', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      p.reject(doctorPartyId, 'Incorrect dose');
      expect(p.status).toBe('REJECTED');
      expect(p.isTerminal).toBe(true);
    });

    it('should forbid modifications to terminal states', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      p.reject(doctorPartyId, 'Incorrect dose');

      expect(() => {
        p.verify(pharmacistA, ScreeningResult.clear());
      }).toThrow(TerminalStateModifiedError);
    });
  });

  describe('MAREntry Entity', () => {
    it('should create MAR entry successfully with encounterId context', () => {
      const mar = MAREntry.create({
        tenantId,
        encounterId,
        prescriptionItemId: 'item-001',
        drugName: 'Paracetamol 500mg',
        dosage: '500mg',
        route: 'PO',
        scheduledTime: new Date(),
      });

      expect(mar.id).toBeDefined();
      expect(mar.status).toBe('scheduled');
      expect(mar.encounterId).toBe(encounterId);
    });

    it('should administer medication successfully', () => {
      const mar = MAREntry.create({
        tenantId,
        encounterId,
        prescriptionItemId: 'item-001',
        drugName: 'Paracetamol 500mg',
        dosage: '500mg',
        route: 'PO',
        scheduledTime: new Date(),
      });

      const nurseId = randomUUID();
      const adminTime = new Date();
      mar.administer(nurseId, adminTime, 'Patient swallowed pill');

      expect(mar.status).toBe('administered');
      expect(mar.administeredByNurseId).toBe(nurseId);
      expect(mar.administeredTime).toEqual(adminTime);
      expect(mar.notes).toContain('Patient swallowed pill');
    });
  });
});
