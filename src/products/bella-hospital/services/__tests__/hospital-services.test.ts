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
    createAdmission: jest.fn().mockResolvedValue({ success: true, data: { admissionId: 'adm-101', status: 'ADMITTED' } }),
    dischargeAdmission: jest.fn().mockResolvedValue({ success: true }),
    getAdmissionById: jest.fn()
  };

  const mockAuditContract = {
    recordAuditEntry: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'aud-101',
        sha256Fingerprint: 'SHA256:MOCK_DISCHARGE_FINGERPRINT_12345'
      }
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

    expect(res.admissionId).toBe('adm-101');
    expect(mockAdmissionContract.createAdmission).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', encounterId: 'enc-1' })
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
    expect(res.fingerprint).toBe('SHA256:aud-101');
    expect(mockAuditContract.recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        encounterId: 'enc-1',
        actionType: 'INPATIENT_DISCHARGE_EXECUTE'
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
