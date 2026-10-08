/**
 * BELLA HOSPITAL — PRODUCT SERVICES UNIT TEST SUITE
 *
 * Verifies business behavior preservation for Hospital Admission & Clinical Alert Product Services.
 *
 * @module src/products/bella-hospital/services/__tests__/hospital-services.test
 */

import { HospitalAdmissionProductService } from '../hospital-admission.service';
import { HospitalClinicalAlertProductService } from '../hospital-clinical-alert.service';

describe('Bella Hospital Product Services Unit Tests', () => {
  let admissionService: HospitalAdmissionProductService;
  let alertService: HospitalClinicalAlertProductService;

  const mockAdmissionContract = {
    createAdmission: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'adm-101',
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        patientPartyId: 'pat-1',
        wardId: 'ward-1',
        bedId: 'bed-1',
        admittingDoctorId: 'dr-1',
        attendingDoctorId: 'dr-1',
        status: 'admitted',
        admissionDiagnosis: [{ icd10Code: 'Z00.0', icd10NameVi: 'Khám tổng quát', isPrimary: true }],
        admittedAt: '2026-08-13T10:00:00Z',
        version: 1,
      },
    }),
    dischargeAdmission: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'adm-101',
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        patientPartyId: 'pat-1',
        wardId: 'ward-1',
        bedId: 'bed-1',
        admittingDoctorId: 'dr-1',
        attendingDoctorId: 'dr-1',
        status: 'discharged',
        admissionDiagnosis: [{ icd10Code: 'Z00.0', icd10NameVi: 'Khám tổng quát', isPrimary: true }],
        admittedAt: '2026-08-13T10:00:00Z',
        dischargedAt: '2026-08-13T10:00:00Z',
        version: 2,
      },
    }),
  };

  const mockBedContract = {
    transferBed: jest.fn().mockResolvedValue({
      success: true,
      data: {
        fromBed: { id: 'bed-1' },
        toBed: { id: 'bed-2' },
        transferId: 'trf-101',
      },
    }),
    releaseBed: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'bed-1',
        status: 'cleaning',
      },
    }),
  };

  const mockTemporalContract = {
    recordTemporalEvent: jest.fn().mockResolvedValue({ success: true, data: { id: 'temp-1', sequenceNumber: 1 } }),
    reconstructStateAt: jest.fn(),
    getDecisionTemporalContext: jest.fn(),
    queryHistoricalState: jest.fn()
  };

  const mockAuditContract = {
    recordAuditEntry: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'aud-101',
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        patientId: 'pat-1',
        actionType: 'INPATIENT_DISCHARGE_EXECUTE',
        performerId: 'dr-1',
        performerRole: 'PHYSICIAN',
        complianceStatus: 'COMPLIANT',
        evidenceIntegrity: 'COMPLETE',
        createdAt: '2026-08-13T10:00:00Z',
      },
    }),
    issueEvidencePackage: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'evidence-101',
        tenantId: 'tenant-1',
        auditId: 'aud-101',
        schemaVersion: '1.0.0',
        sourceReferences: { encounterId: 'enc-1' },
        canonicalPayload: {
          actionType: 'INPATIENT_DISCHARGE_EXECUTE',
          timestamp: '2026-08-13T10:00:00Z',
          performer: { id: 'dr-1', role: 'PHYSICIAN' },
          complianceStatus: 'COMPLIANT',
          evidenceIntegrity: 'COMPLETE',
        },
        fingerprint: 'SHA256:MOCK_DISCHARGE_FINGERPRINT_12345',
        createdAt: '2026-08-13T10:00:00Z',
      },
    }),
    evaluateActionCompliance: jest.fn(),
    investigateClinicalAction: jest.fn(),
    getComplianceReportSummary: jest.fn()
  };

  const mockCdsContract = {
    generateCdsSummary: jest.fn().mockResolvedValue({
      success: true,
      data: {
        passed: true,
        hardBlocked: false,
        alerts: [
          {
            alertId: 'alert-1',
            alertType: 'PROTOCOL',
            severity: 'WARNING',
            enforcement: 'ACKNOWLEDGE',
            canOverride: true,
            message: 'Dose warning',
          },
        ],
        calculationId: 'calc-1',
        knowledgeBaseVersion: 'kb-v1',
        policyVersion: 'policy-v1',
        evaluatedAt: '2026-08-13T10:00:00Z',
      },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    admissionService = new HospitalAdmissionProductService(
      mockAdmissionContract,
      mockBedContract,
      mockTemporalContract,
      mockAuditContract
    );
    alertService = new HospitalClinicalAlertProductService(mockCdsContract);
  });

  test('admitInpatient delegates to IAdmissionContract via Public Contract', async () => {
    const res = await admissionService.admitInpatient({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      wardId: 'ward-1',
      bedId: 'bed-1',
      admittingPhysicianId: 'dr-1',
      attendingPhysicianId: 'dr-1',
      admissionDiagnosis: [{ icd10Code: 'Z00.0', icd10NameVi: 'Khám tổng quát', isPrimary: true }],
    });

    expect(res.status).toBe('admitted');
    expect(mockAdmissionContract.createAdmission).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', encounterId: 'enc-1' })
    );
  });

  test('transferBed records Bitemporal Event in H9 Temporal Engine', async () => {
    const res = await admissionService.transferBed({
      admissionId: 'adm-101',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      sourceBedId: 'bed-1',
      targetBedId: 'bed-2',
      transferReason: 'ICU Upgrade',
      transferredBy: 'dr-1'
    });

    expect(res.status).toBe('transferred');
    expect(mockTemporalContract.recordTemporalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        aggregateId: 'adm-101',
        eventType: 'BED_TRANSFERRED'
      })
    );
  });

  test('dischargeInpatient generates H11 Legal Audit Evidence Package', async () => {
    const res = await admissionService.dischargeInpatient({
      admissionId: 'adm-101',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      dischargingPhysicianId: 'dr-1',
      dischargeDisposition: 'HOME',
      dischargeSummary: 'Recovered completely',
      timestamp: '2026-08-13T10:00:00Z'
    });

    expect(res.status).toBe('DISCHARGED');
    expect(res.bedReleaseStatus).toBe('RELEASED');
    expect(res.sha256Fingerprint).toBe('SHA256:MOCK_DISCHARGE_FINGERPRINT_12345');
    expect(mockBedContract.releaseBed).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        bedId: 'bed-1',
        encounterId: 'enc-1',
        patientId: 'pat-1',
        admissionId: 'adm-101',
        reason: 'discharge',
        releasedBy: 'dr-1'
      })
    );
    expect(mockTemporalContract.recordTemporalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        patientId: 'pat-1',
        aggregateId: 'adm-101',
        eventType: 'INPATIENT_DISCHARGED'
      })
    );
    expect(mockAuditContract.recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        actionType: 'INPATIENT_DISCHARGE_EXECUTE'
      })
    );
    expect(mockAuditContract.issueEvidencePackage).toHaveBeenCalledWith('tenant-1', 'aud-101');
  });

  test('evaluateOrderSafety routes through H8 CDS Contract and detects warnings', async () => {
    const res = await alertService.evaluateOrderSafety({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      clinicianId: 'dr-1',
      medicationCode: 'MED-PARACETAMOL',
      medicationName: 'Paracetamol',
      dosageMg: 500,
      route: 'PO'
    });

    expect(res.decision).toBe('REQUIRES_OVERRIDE');
    expect(mockCdsContract.generateCdsSummary).toHaveBeenCalled();
  });
});
