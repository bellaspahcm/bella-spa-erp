/**
 * Admission Entity Unit Tests
 *
 * Verifies domain invariants for InpatientAdmission aggregate root.
 *
 * @module platform/healthcare/engines/admission-engine/domain/__tests__
 */

import { InpatientAdmission } from '../inpatient-admission.entity';

describe('InpatientAdmission Entity Unit Tests', () => {
  const validPayload = {
    id: 'adm-001',
    tenantId: 'tenant-test',
    encounterId: 'enc-001',
    patientPartyId: 'party-001',
    wardId: 'ward-icu',
    bedId: 'bed-101',
    admittingDoctorId: 'doc-001',
    attendingDoctorId: 'doc-001',
    admissionDiagnosis: [
      { icd10Code: 'I50.9', icd10NameVi: 'Suy tim, không đặc hiệu', isPrimary: true },
    ],
  };

  test('Creates a valid InpatientAdmission in admitted status', () => {
    const admission = InpatientAdmission.create(validPayload);
    expect(admission.id).toBe('adm-001');
    expect(admission.status).toBe('admitted');
    expect(admission.version).toBe(1);
    expect(admission.admissionDiagnosis.length).toBe(1);
  });

  test('Rejects creation when required tenant or encounter parameters are missing', () => {
    expect(() => InpatientAdmission.create({ ...validPayload, tenantId: '' })).toThrow('TenantId is required');
    expect(() => InpatientAdmission.create({ ...validPayload, encounterId: '' })).toThrow('EncounterId is required');
    expect(() => InpatientAdmission.create({ ...validPayload, admissionDiagnosis: [] })).toThrow('At least one primary admission diagnosis is required');
  });

  test('Allows valid bed transfer', () => {
    const admission = InpatientAdmission.create(validPayload);
    admission.transfer('ward-internal', 'bed-202');
    expect(admission.status).toBe('transferred');
    expect(admission.wardId).toBe('ward-internal');
    expect(admission.bedId).toBe('bed-202');
    expect(admission.version).toBe(2);
  });

  test('Allows valid discharge', () => {
    const admission = InpatientAdmission.create(validPayload);
    admission.discharge('Bệnh nhân ổn định, cho xuất viện.');
    expect(admission.status).toBe('discharged');
    expect(admission.dischargeSummary).toBe('Bệnh nhân ổn định, cho xuất viện.');
    expect(admission.dischargedAt).toBeDefined();
    expect(admission.version).toBe(2);
  });

  test('Invariant: Cannot transfer an already discharged admission', () => {
    const admission = InpatientAdmission.create(validPayload);
    admission.discharge('Bệnh nhân ổn định');
    expect(() => admission.transfer('ward-icu', 'bed-102')).toThrow('Cannot transfer an admission in terminal status: discharged');
  });

  test('Invariant: Cannot discharge an admission twice', () => {
    const admission = InpatientAdmission.create(validPayload);
    admission.discharge('Bệnh nhân ổn định');
    expect(() => admission.discharge('Lần 2')).toThrow('Cannot discharge an admission in terminal status: discharged');
  });
});
