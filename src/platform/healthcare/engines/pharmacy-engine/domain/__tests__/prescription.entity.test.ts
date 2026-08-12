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

describe('Prescription & MAR Domain Unit Tests (4B.1)', () => {
  const tenantId = randomUUID();
  const encounterId = randomUUID();
  const patientPartyId = randomUUID();
  const doctorPartyId = randomUUID();
  const clinicalOrderId = randomUUID();
  
  const drugs: PrescriptionDrugItem[] = [
    {
      code: 'A02B',
      name: 'Omeprazole 20mg',
      dose: '1 capsule',
      frequency: 'QD',
      durationDays: 14,
    },
  ];

  describe('Prescription Aggregate Root', () => {
    it('should successfully create a prescription in PENDING_REVIEW status', () => {
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
      expect(prescription.status).toBe('PENDING_REVIEW');
      expect(prescription.version).toBe(1);
      expect(prescription.drugs).toHaveLength(1);
      expect(prescription.drugs[0].code).toBe('A02B');
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

      expect(() => {
        Prescription.create({
          tenantId,
          encounterId,
          patientPartyId,
          doctorPartyId,
          clinicalOrderId,
          drugs: [],
        });
      }).toThrow(MissingRequiredFieldError);
    });

    it('should transition correctly through state machine flows', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      // PENDING_REVIEW -> APPROVED
      p.approve(doctorPartyId);
      expect(p.status).toBe('APPROVED');
      expect(p.version).toBe(2);

      // APPROVED -> READY_FOR_DISPENSE
      p.markReady(doctorPartyId);
      expect(p.status).toBe('READY_FOR_DISPENSE');

      // READY_FOR_DISPENSE -> PARTIALLY_DISPENSED
      p.dispense(doctorPartyId, true);
      expect(p.status).toBe('PARTIALLY_DISPENSED');

      // PARTIALLY_DISPENSED -> DISPENSED
      p.dispense(doctorPartyId, false);
      expect(p.status).toBe('DISPENSED');
      expect(p.isTerminal).toBe(true);
    });

    it('should support rejection branches and on-hold branches', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      // PENDING_REVIEW -> REJECTED
      p.reject(doctorPartyId, 'Incorrect dosage');
      expect(p.status).toBe('REJECTED');
      expect(p.isTerminal).toBe(true);
      expect(p.notes).toContain('Rejected: Incorrect dosage');
    });

    it('should allow putting on hold and resuming or cancelling', () => {
      const p1 = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });
      p1.approve(doctorPartyId);
      
      // APPROVED -> ON_HOLD
      p1.hold(doctorPartyId, 'Patient needs clinical review');
      expect(p1.status).toBe('ON_HOLD');
      
      // ON_HOLD -> APPROVED
      p1.approve(doctorPartyId);
      expect(p1.status).toBe('APPROVED');

      const p2 = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });
      p2.approve(doctorPartyId);
      p2.hold(doctorPartyId, 'Patient unavailable');
      
      // ON_HOLD -> CANCELLED
      p2.cancel(doctorPartyId, 'Encounter cancelled');
      expect(p2.status).toBe('CANCELLED');
      expect(p2.isTerminal).toBe(true);
    });

    it('should throw error for invalid state transitions', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      // Cannot dispense directly from PENDING_REVIEW
      expect(() => {
        p.dispense(doctorPartyId, false);
      }).toThrow(InvalidStateTransitionError);
    });

    it('should forbid modifications when in terminal states', () => {
      const p = Prescription.create({
        tenantId,
        encounterId,
        patientPartyId,
        doctorPartyId,
        clinicalOrderId,
        drugs,
      });

      p.reject(doctorPartyId, 'Test reject');
      
      // Cannot approve rejected prescription
      expect(() => {
        p.approve(doctorPartyId);
      }).toThrow(TerminalStateModifiedError);
    });
  });

  describe('MAREntry Entity', () => {
    it('should create MAR entry successfully with encounterId context', () => {
      const mar = MAREntry.create({
        tenantId,
        encounterId,
        prescriptionItemId: 'item-001',
        drugName: 'Omeprazole 20mg',
        dosage: '1 capsule',
        route: 'PO',
        scheduledTime: new Date(),
      });

      expect(mar.id).toBeDefined();
      expect(mar.status).toBe('scheduled');
      expect(mar.encounterId).toBe(encounterId);
      expect(mar.inpatientAdmissionId).toBeUndefined();
    });

    it('should reject MAR creation if both inpatientAdmissionId and encounterId are missing', () => {
      expect(() => {
        MAREntry.create({
          tenantId,
          prescriptionItemId: 'item-001',
          drugName: 'Omeprazole 20mg',
          dosage: '1 capsule',
          route: 'PO',
          scheduledTime: new Date(),
        });
      }).toThrow(PrescriptionDomainError);
    });

    it('should administer medication successfully', () => {
      const mar = MAREntry.create({
        tenantId,
        encounterId,
        prescriptionItemId: 'item-001',
        drugName: 'Omeprazole 20mg',
        dosage: '1 capsule',
        route: 'PO',
        scheduledTime: new Date(),
      });

      const nurseId = randomUUID();
      const adminTime = new Date();
      mar.administer(nurseId, adminTime, 'Patient took medication with water');

      expect(mar.status).toBe('administered');
      expect(mar.administeredByNurseId).toBe(nurseId);
      expect(mar.administeredTime).toEqual(adminTime);
      expect(mar.notes).toContain('Patient took medication with water');
    });

    it('should allow changing status to refused or missed with a reason', () => {
      const mar = MAREntry.create({
        tenantId,
        encounterId,
        prescriptionItemId: 'item-001',
        drugName: 'Omeprazole 20mg',
        dosage: '1 capsule',
        route: 'PO',
        scheduledTime: new Date(),
      });

      mar.updateStatus('refused', 'Patient refuses to take oral pills');
      expect(mar.status).toBe('refused');
      expect(mar.notes).toContain('Patient refuses to take oral pills');
    });
  });
});
