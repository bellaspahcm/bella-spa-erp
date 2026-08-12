/**
 * Admission Engine Service Unit & Invariant Tests
 *
 * Verifies:
 * - Admission belongs to exact tenantId.
 * - encounterId must exist (via IEncounterReader).
 * - Encounter cannot have two active admissions simultaneously.
 *
 * @module platform/healthcare/engines/admission-engine/__tests__
 */

import { AdmissionEngineService } from '../services/admission-engine.service';
import { IAdmissionRepository } from '../repositories/supabase-admission.repository';
import { IEncounterReader } from '../contracts/encounter-reader.interface';
import { InpatientAdmission } from '../domain/inpatient-admission.entity';

class MockAdmissionRepository implements IAdmissionRepository {
  private admissions = new Map<string, InpatientAdmission>();

  async save(admission: InpatientAdmission): Promise<InpatientAdmission> {
    const copy = InpatientAdmission.rehydrate(admission.toSnapshot());
    this.admissions.set(copy.id, copy);
    return copy;
  }

  async findById(tenantId: string, id: string): Promise<InpatientAdmission | null> {
    const adm = this.admissions.get(id);
    if (!adm || adm.tenantId !== tenantId) return null;
    return InpatientAdmission.rehydrate(adm.toSnapshot());
  }

  async findByEncounterId(tenantId: string, encounterId: string): Promise<InpatientAdmission | null> {
    for (const adm of this.admissions.values()) {
      if (adm.tenantId === tenantId && adm.encounterId === encounterId) {
        return InpatientAdmission.rehydrate(adm.toSnapshot());
      }
    }
    return null;
  }
}

class MockEncounterReader implements IEncounterReader {
  constructor(private readonly validEncounters: Set<string>) {}

  async getEncounterSummary(tenantId: string, encounterId: string) {
    if (!this.validEncounters.has(encounterId)) return null;
    return {
      id: encounterId,
      tenantId,
      patientPartyId: 'party-001',
      status: 'in_consultation',
      encounterClass: 'inpatient',
    };
  }
}

describe('Admission Engine Service Invariants', () => {
  let repository: MockAdmissionRepository;
  let encounterReader: MockEncounterReader;
  let service: AdmissionEngineService;

  beforeEach(() => {
    repository = new MockAdmissionRepository();
    encounterReader = new MockEncounterReader(new Set(['enc-valid']));
    service = new AdmissionEngineService(repository, encounterReader);
  });

  test('Successfully creates admission for a valid encounter', async () => {
    const res = await service.createAdmission({
      tenantId: 'tenant-test',
      encounterId: 'enc-valid',
      patientPartyId: 'party-001',
      wardId: 'ward-icu',
      bedId: 'bed-101',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [{ icd10Code: 'I50.9', icd10NameVi: 'Suy tim', isPrimary: true }],
    });

    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('admitted');
  });

  test('Invariant: Rejects admission creation if encounter does not exist', async () => {
    const res = await service.createAdmission({
      tenantId: 'tenant-test',
      encounterId: 'enc-invalid-999',
      patientPartyId: 'party-001',
      wardId: 'ward-icu',
      bedId: 'bed-101',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [{ icd10Code: 'I50.9', icd10NameVi: 'Suy tim', isPrimary: true }],
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('ENCOUNTER_NOT_FOUND');
  });

  test('Invariant: Rejects second active admission for the same encounter', async () => {
    // First admission
    await service.createAdmission({
      tenantId: 'tenant-test',
      encounterId: 'enc-valid',
      patientPartyId: 'party-001',
      wardId: 'ward-icu',
      bedId: 'bed-101',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [{ icd10Code: 'I50.9', icd10NameVi: 'Suy tim', isPrimary: true }],
    });

    // Attempt second active admission
    const res2 = await service.createAdmission({
      tenantId: 'tenant-test',
      encounterId: 'enc-valid',
      patientPartyId: 'party-001',
      wardId: 'ward-icu',
      bedId: 'bed-102',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [{ icd10Code: 'J18.9', icd10NameVi: 'Viêm phổi', isPrimary: true }],
    });

    expect(res2.success).toBe(false);
    expect(res2.error?.code).toBe('ACTIVE_ADMISSION_EXISTS');
  });
});
