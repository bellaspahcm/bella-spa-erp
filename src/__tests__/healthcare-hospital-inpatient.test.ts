import { BedEngineService, InpatientAdmissionService, BreakGlassSecurityService } from '@/services/healthcare-hospital-services';

describe('Bella Healthcare Hospital Inpatient HIS & Bed Engine Governance Tests', () => {
  const tenantId = 'bella_healthcare';

  it('should fetch hospital wards and beds with correct data structures', async () => {
    const wards = await BedEngineService.getHospitalWards(tenantId);
    expect(wards).toBeDefined();
    expect(wards.length).toBeGreaterThan(0);
    expect(wards[0]).toHaveProperty('code');
    expect(wards[0]).toHaveProperty('name');

    const beds = await BedEngineService.getHospitalBeds(tenantId);
    expect(beds).toBeDefined();
    expect(beds.length).toBeGreaterThan(0);
    expect(beds[0]).toHaveProperty('bed_code');
    expect(beds[0]).toHaveProperty('status');
  });

  it('should update bed status atomically via BedEngineService', async () => {
    const beds = await BedEngineService.getHospitalBeds(tenantId);
    const targetBed = beds[0];

    const updatedBed = await BedEngineService.updateBedStatus(targetBed.id, 'cleaning');
    expect(updatedBed.status).toBe('cleaning');

    // Reset back
    await BedEngineService.updateBedStatus(targetBed.id, targetBed.status);
  });

  it('should create inpatient admission and transition bed status to occupied', async () => {
    const admission = await InpatientAdmissionService.createInpatientAdmission({
      tenantId,
      encounterId: 'enc-test-01',
      patientId: 'pat-test-01',
      bedId: 'bed-102',
      wardId: 'ward-001',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [
        { icd10_code: 'I10', icd10_name_vi: 'Tăng huyết áp vô căn', is_primary: true },
      ],
    });

    expect(admission).toBeDefined();
    expect(admission.status).toBe('admitted');
    expect(admission.patient_id).toBe('pat-test-01');

    const beds = await BedEngineService.getHospitalBeds(tenantId);
    const occupiedBed = beds.find((b) => b.id === 'bed-102');
    expect(occupiedBed?.status).toBe('occupied');
  });

  it('should activate emergency Break-Glass access and log audit trail', async () => {
    const log = await BreakGlassSecurityService.activateBreakGlassAccess({
      tenantId,
      userId: 'doc-test-01',
      userEmail: 'doctor@bella.vn',
      userName: 'BS. Test Doctor',
      patientId: 'pat-emergency-01',
      reason: 'Cấp cứu bệnh nhân suy hô hấp nặng tại ICU',
    });

    expect(log).toBeDefined();
    expect(log.reason).toContain('suy hô hấp');

    const logs = await BreakGlassSecurityService.getBreakGlassLogs(tenantId);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].patient_id).toBe('pat-emergency-01');
  });
});
