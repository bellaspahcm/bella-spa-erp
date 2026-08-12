/**
 * SurgicalCase Domain Unit Tests
 */

import { SurgicalCase } from '../surgical-case.entity';

describe('SurgicalCase Aggregate Root - Domain Tests', () => {
  const TENANT_ID = 'tenant-surg-1';
  const ENCOUNTER_ID = 'enc-surg-1';
  const PATIENT_ID = 'patient-surg-1';
  const OR_ID = 'or-room-A';
  const SURGEON_ID = 'surgeon-user-1';

  const scheduledStart = new Date(Date.now() + 3600 * 1000);
  const scheduledEnd = new Date(Date.now() + 7200 * 1000);

  it('should initialize a surgical case with status SCHEDULED', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    expect(sCase.status).toBe('SCHEDULED');
    expect(sCase.preopChecklistCompleted).toBe(false);
    expect(sCase.anesthesiaConsentSigned).toBe(false);
  });

  it('should transition to PREOP_READY when pre-op checklist is completed', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    sCase.completePreop();
    expect(sCase.status).toBe('PREOP_READY');
    expect(sCase.preopChecklistCompleted).toBe(true);
  });

  it('should enforce Anesthesia Safety Gate and block transition to ANESTHETIZED if consent is unsigned', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    sCase.completePreop();

    expect(() => {
      sCase.administerAnesthesia();
    }).toThrow('Anesthesia Safety Gate');
    expect(sCase.status).toBe('PREOP_READY');
  });

  it('should transition to ANESTHETIZED if anesthesia consent is signed', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    sCase.completePreop();
    sCase.signAnesthesiaConsent();
    sCase.administerAnesthesia();

    expect(sCase.status).toBe('ANESTHETIZED');
  });

  it('should enforce CSSD Safety Gate and block procedure incision if equipment is not sterile', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    sCase.completePreop();
    sCase.signAnesthesiaConsent();
    sCase.administerAnesthesia();
    sCase.completeSignIn('doc-1');
    sCase.completeTimeOut('doc-1');

    expect(() => {
      sCase.startProcedure(false, 'token-123');
    }).toThrow('CSSD Safety Gate');
    expect(sCase.status).toBe('ANESTHETIZED');
  });

  it('should transition to PROCEDURE_IN_PROGRESS if equipment is sterile with token', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    sCase.completePreop();
    sCase.signAnesthesiaConsent();
    sCase.administerAnesthesia();
    sCase.completeSignIn('doc-1');
    sCase.completeTimeOut('doc-1');
    sCase.startProcedure(true, 'sterile-token-abc');

    expect(sCase.status).toBe('PROCEDURE_IN_PROGRESS');
    expect(sCase.cssdTokenId).toBe('sterile-token-abc');
    expect(sCase.cssdVerifiedAt).toBeInstanceOf(Date);
  });

  it('should transition sequentially to PACU recovery and complete case', () => {
    const sCase = SurgicalCase.create({
      id: 'case-100',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      orId: OR_ID,
      surgeonId: SURGEON_ID,
      scheduledStart,
      scheduledEnd,
    });

    sCase.completePreop();
    sCase.signAnesthesiaConsent();
    sCase.administerAnesthesia();
    sCase.completeSignIn('doc-1');
    sCase.completeTimeOut('doc-1');
    sCase.startProcedure(true, 'token-999');
    sCase.transferToPacu();
    expect(sCase.status).toBe('RECOVERY_PACU');

    sCase.completeSignOut('doc-1');
    sCase.completeCase();
    expect(sCase.status).toBe('POSTOP_COMPLETED');
  });
});
