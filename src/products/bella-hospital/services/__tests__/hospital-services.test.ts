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
    admitInpatient: jest.fn().mockResolvedValue({ admissionId: 'adm-101', status: 'ADMITTED' }),
    transferBed: jest.fn().mockResolvedValue({ admissionId: 'adm-101', status: 'TRANSFERRED' }),
    dischargeInpatient: jest.fn().mockResolvedValue({ admissionId: 'adm-101', status: 'DISCHARGED' })
  };

  const mockTemporalContract = {
    recordTemporalEvent: jest.fn().mockResolvedValue({ id: 'temp-1', sequenceNumber: 1 }),
    reconstructStateAt: jest.fn(),
    getDecisionTemporalContext: jest.fn(),
    queryHistoricalState: jest.fn()
  };

  const mockAuditContract = {
    recordAuditEntry: jest.fn().mockResolvedValue({
      id: 'aud-101',
      sha256Fingerprint: 'SHA256:MOCK_DISCHARGE_FINGERPRINT_12345'
    }),
    evaluateActionCompliance: jest.fn(),
    issueEvidencePackage: jest.fn(),
    investigateClinicalAction: jest.fn(),
    getComplianceReportSummary: jest.fn()
  };

  const mockCdsContract = {
    evaluateOrderSafety: jest.fn().mockResolvedValue({
      hasAbsoluteBlock: false,
      contraindications: [],
      warnings: [{ severity: 'WARNING', message: 'Dose warning' }]
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    admissionService = new HospitalAdmissionProductService(
      mockAdmissionContract as any,
      mockTemporalContract as any,
      mockAuditContract as any
    );
    alertService = new HospitalClinicalAlertProductService(mockCdsContract as any);
  });

  test('admitInpatient delegates to IAdmissionContract via Public Contract', async () => {
    const res = await admissionService.admitInpatient({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      bedId: 'bed-1',
      admittingPhysicianId: 'dr-1'
    });

    expect(res.status).toBe('ADMITTED');
    expect(mockAdmissionContract.admitInpatient).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', encounterId: 'enc-1' })
    );
  });

  test('transferBed records Bitemporal Event in H9 Temporal Engine', async () => {
    const res = await admissionService.transferBed({
      admissionId: 'adm-101',
      tenantId: 'tenant-1',
      targetBedId: 'bed-2',
      transferReason: 'ICU Upgrade',
      transferredBy: 'dr-1'
    });

    expect(res.status).toBe('TRANSFERRED');
    expect(mockTemporalContract.recordTemporalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        entityId: 'adm-101',
        eventType: 'BED_TRANSFERRED'
      })
    );
  });

  test('dischargeInpatient generates H11 Legal Audit Evidence Package', async () => {
    const res = await admissionService.dischargeInpatient({
      admissionId: 'adm-101',
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      dischargingPhysicianId: 'dr-1',
      dischargeDisposition: 'HOME',
      dischargeSummary: 'Recovered completely',
      timestamp: '2026-08-13T10:00:00Z'
    });

    expect(res.status).toBe('DISCHARGED');
    expect(res.sha256Fingerprint).toBe('SHA256:MOCK_DISCHARGE_FINGERPRINT_12345');
    expect(mockAuditContract.recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        action: 'INPATIENT_DISCHARGE_EXECUTE'
      })
    );
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
    expect(mockCdsContract.evaluateOrderSafety).toHaveBeenCalled();
  });
});
