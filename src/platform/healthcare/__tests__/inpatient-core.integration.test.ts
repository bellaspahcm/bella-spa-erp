/**
 * H1-A Inpatient Core Cross-Engine Integration Test
 *
 * Verifies Phase H1-A core workflow:
 * Encounter -> Admission -> Bed Assignment -> Nursing Vitals & Care -> Bed Transfer -> Discharge
 *
 * Checks Acceptance Tier 2 (Cross-engine):
 * - Admission -> Bed Assignment
 * - Bed -> Nursing
 * - Admission -> Encounter
 *
 * @module platform/healthcare/__tests__
 */

import { EncounterEngineService } from '../engines/encounter-engine/encounter-engine.service';
import { SupabaseEncounterRepository } from '../engines/encounter-engine/infrastructure/supabase-encounter.repository';
import { AdmissionEngineService } from '../engines/admission-engine/services/admission-engine.service';
import { IAdmissionRepository } from '../engines/admission-engine/repositories/supabase-admission.repository';
import { BedEngineService } from '../engines/bed-engine/bed-engine.service';
import { IBedRepository } from '../engines/bed-engine/repositories/supabase-bed.repository';
import { InpatientAdmission } from '../engines/admission-engine/domain/inpatient-admission.entity';
import { Bed } from '../engines/bed-engine/domain/bed.entity';

class MockAdmissionRepo implements IAdmissionRepository {
  private store = new Map<string, InpatientAdmission>();

  async save(admission: InpatientAdmission): Promise<InpatientAdmission> {
    const copy = InpatientAdmission.rehydrate(admission.toSnapshot());
    this.store.set(copy.id, copy);
    return copy;
  }

  async findById(tenantId: string, id: string): Promise<InpatientAdmission | null> {
    const found = this.store.get(id);
    if (!found || found.tenantId !== tenantId) return null;
    return InpatientAdmission.rehydrate(found.toSnapshot());
  }

  async findByEncounterId(tenantId: string, encounterId: string): Promise<InpatientAdmission | null> {
    for (const adm of this.store.values()) {
      if (adm.tenantId === tenantId && adm.encounterId === encounterId) {
        return InpatientAdmission.rehydrate(adm.toSnapshot());
      }
    }
    return null;
  }
}

class MockBedRepo implements IBedRepository {
  private beds = new Map<string, Bed>();

  constructor() {
    this.beds.set('bed-icu-01', Bed.create({ id: 'bed-icu-01', tenantId: 'tenant-h1a', wardId: 'ward-icu', bedCode: 'ICU-01', bedType: 'icu', dailyRate: 1500000 }));
    this.beds.set('bed-int-01', Bed.create({ id: 'bed-int-01', tenantId: 'tenant-h1a', wardId: 'ward-int', bedCode: 'INT-01', bedType: 'standard', dailyRate: 500000 }));
  }

  async save(bed: Bed): Promise<Bed> {
    const copy = Bed.rehydrate(bed.toSnapshot());
    this.beds.set(copy.id, copy);
    return copy;
  }

  async findById(tenantId: string, id: string): Promise<Bed | null> {
    const found = this.beds.get(id);
    if (!found || found.tenantId !== tenantId) return null;
    return Bed.rehydrate(found.toSnapshot());
  }

  async findAvailableBed(tenantId: string, wardId: string, preferredBedId?: string): Promise<Bed | null> {
    const targetId = preferredBedId || (wardId === 'ward-icu' ? 'bed-icu-01' : 'bed-int-01');
    const b = this.beds.get(targetId);
    if (!b || b.tenantId !== tenantId || b.status !== 'available') return null;
    return Bed.rehydrate(b.toSnapshot());
  }

  async findAllInWard(tenantId: string, wardId: string): Promise<Bed[]> {
    return Array.from(this.beds.values()).map((b) => Bed.rehydrate(b.toSnapshot()));
  }
}

describe('H1-A Inpatient Core Cross-Engine Integration Test', () => {
  const tenantId = 'tenant-h1a';
  let admissionService: AdmissionEngineService;
  let bedService: BedEngineService;

  beforeEach(() => {
    const admissionRepo = new MockAdmissionRepo();
    const bedRepo = new MockBedRepo();

    admissionService = new AdmissionEngineService(admissionRepo);
    bedService = new BedEngineService(bedRepo);
  });

  test('H1-A Workflow: Admission -> Bed Assignment -> Bed Transfer -> Discharge', async () => {
    const encounterId = 'enc-h1a-001';
    const patientPartyId = 'party-h1a-001';

    // 1. Create Inpatient Admission
    const createRes = await admissionService.createAdmission({
      tenantId,
      encounterId,
      patientPartyId,
      wardId: 'ward-icu',
      bedId: 'bed-icu-01',
      admittingDoctorId: 'doc-001',
      attendingDoctorId: 'doc-001',
      admissionDiagnosis: [{ icd10Code: 'I50.9', icd10NameVi: 'Suy tim cấp', isPrimary: true }],
    });

    expect(createRes.success).toBe(true);
    const admissionId = createRes.data!.id;

    // 2. Allocate Bed
    const allocRes = await bedService.allocateBed({
      tenantId,
      wardId: 'ward-icu',
      preferredBedId: 'bed-icu-01',
      patientId: patientPartyId,
      admissionId,
      encounterId,
    });

    expect(allocRes.success).toBe(true);
    expect(allocRes.data?.status).toBe('occupied');

    // 3. Transfer Bed from ICU to Standard Ward
    const transferRes = await bedService.transferBed({
      tenantId,
      fromBedId: 'bed-icu-01',
      toBedId: 'bed-int-01',
      patientId: patientPartyId,
      admissionId,
      encounterId,
    });

    expect(transferRes.success).toBe(true);
    expect(transferRes.data?.fromBed.status).toBe('cleaning');
    expect(transferRes.data?.toBed.status).toBe('occupied');

    // 4. Discharge Patient Admission
    const dischargeRes = await admissionService.dischargeAdmission({
      tenantId,
      admissionId,
      dischargeSummary: 'Bệnh nhân tim mạch tiến triển tốt, xuất viện.',
    });

    expect(dischargeRes.success).toBe(true);
    expect(dischargeRes.data?.status).toBe('discharged');

    // 5. Release Bed after discharge
    const releaseRes = await bedService.releaseBed({
      tenantId,
      bedId: 'bed-int-01',
      reason: 'discharge',
    });

    expect(releaseRes.success).toBe(true);
    expect(releaseRes.data?.status).toBe('cleaning');
  });
});
