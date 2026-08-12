import { EmergencyDisposition } from '../emergency-disposition.entity';

describe('EmergencyDisposition Aggregate Root Unit Tests', () => {
  it('should create pending disposition and decide DISCHARGE', () => {
    const disposition = EmergencyDisposition.create({
      id: 'disp-001',
      tenantId: 'tenant-001',
      encounterId: 'enc-001',
      patientId: 'patient-001',
    });

    expect(disposition.status).toBe('PENDING');

    disposition.decideDischarge({
      decidedBy: 'doc-001',
      metadata: {
        dischargeInstructions: 'Rest for 3 days and take prescribed oral antibiotics.',
        prescriptionsIssued: true,
        followUpDays: 7,
      },
    });

    expect(disposition.status).toBe('DECIDED');
    expect(disposition.dispositionType).toBe('DISCHARGE');
    expect(disposition.dischargeMetadata?.followUpDays).toBe(7);
  });

  it('should decide TRANSFER and transition to EXECUTED', () => {
    const disposition = EmergencyDisposition.create({
      id: 'disp-002',
      tenantId: 'tenant-001',
      encounterId: 'enc-002',
      patientId: 'patient-002',
    });

    disposition.decideTransfer({
      decidedBy: 'doc-001',
      metadata: {
        receivingFacilityName: 'City Trauma Center',
        transferReason: 'Requires specialized neurosurgery',
        transportMode: 'AMBULANCE_ICU',
      },
    });

    expect(disposition.status).toBe('DECIDED');
    expect(disposition.dispositionType).toBe('TRANSFER');

    disposition.markExecuted('transfer-ref-999');
    expect(disposition.status).toBe('EXECUTED');
    expect(disposition.executionReferenceId).toBe('transfer-ref-999');
  });

  it('should decide ADMIT for Inpatient Admission', () => {
    const disposition = EmergencyDisposition.create({
      id: 'disp-003',
      tenantId: 'tenant-001',
      encounterId: 'enc-003',
      patientId: 'patient-003',
    });

    disposition.decideAdmission({
      decidedBy: 'doc-001',
      metadata: {
        targetWardId: 'ward-icu-01',
        admittingSpecialty: 'CARDIOLOGY',
        provisionalDiagnosis: 'Acute Myocardial Infarction',
        admissionPriority: 'EMERGENCY_IMMEDIATE',
      },
    });

    expect(disposition.status).toBe('DECIDED');
    expect(disposition.dispositionType).toBe('ADMIT');
    expect(disposition.admissionMetadata?.targetWardId).toBe('ward-icu-01');
  });

  it('should prevent mutating an executed disposition', () => {
    const disposition = EmergencyDisposition.create({
      id: 'disp-004',
      tenantId: 'tenant-001',
      encounterId: 'enc-004',
      patientId: 'patient-004',
    });

    disposition.decideDischarge({
      decidedBy: 'doc-001',
      metadata: { dischargeInstructions: 'Discharged' },
    });
    disposition.markExecuted('token-123');

    expect(() => {
      disposition.decideAdmission({
        decidedBy: 'doc-002',
        metadata: {
          targetWardId: 'ward-01',
          admittingSpecialty: 'GEN',
          provisionalDiagnosis: 'Diag',
          admissionPriority: 'ROUTINE',
        },
      });
    }).toThrow('Cannot change executed disposition');
  });
});
