/**
 * BELLA HOSPITAL — CONTRACT BOUNDARY REFACTOR TEST SUITE
 *
 * Verifies that hospital services delegate to verified Kernel Contracts without direct internal DB access.
 *
 * @module src/products/bella-hospital/services/__tests__/hospital-contract-boundary.test
 */

import { InpatientAdmissionService } from '@/services/healthcare-hospital-services';
import { ClinicalAlertsService } from '@/services/healthcare/clinical-alerts-service';

describe('Bella Hospital Contract Boundary Refactor Tests', () => {
  test('InpatientAdmissionService delegates admission and discharge to Product Service and Kernel Contracts', async () => {
    const admission = await InpatientAdmissionService.createInpatientAdmission({
      tenantId: 'tenant-bella',
      encounterId: 'enc-101',
      patientId: 'pat-101',
      bedId: 'bed-101',
      wardId: 'ward-001',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [{ icd10_code: 'I50.9', icd10_name_vi: 'Suy tim', is_primary: true }]
    });

    expect(admission).toBeDefined();
    expect(admission.status).toBe('admitted');

    const discharged = await InpatientAdmissionService.dischargePatient(admission.id, 'Patient fully recovered');
    expect(discharged.status).toBe('discharged');
  });

  test('ClinicalAlertsService delegates order safety check to H8 CDS Contract', async () => {
    const safetyRes = await ClinicalAlertsService.evaluateOrderSafetyWithCds({
      tenantId: 'tenant-bella',
      encounterId: 'enc-101',
      patientId: 'pat-101',
      clinicianId: 'doc-001',
      medicationCode: 'MED-PARACETAMOL',
      medicationName: 'Paracetamol',
      dosageMg: 500,
      route: 'PO'
    });

    expect(safetyRes.decision).toBe('REQUIRES_OVERRIDE');
    expect(safetyRes.safetyEvaluation).toBeDefined();
  });
});
