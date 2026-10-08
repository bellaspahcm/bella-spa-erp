/**
 * BELLA HOSPITAL - ENCOUNTER FOUNDATION RUNTIME TESTS
 *
 * Proves Hospital consumes Encounter through the public contract only.
 */

import type {
  EncounterDTO,
  IEncounterEngine,
} from '../../../../platform/healthcare/contracts/encounter-engine.contract';
import { HospitalEncounterProductService } from '../hospital-encounter.service';

type EncounterContractSubset = Pick<
  IEncounterEngine,
  'createEncounter' | 'getEncounter' | 'assignProvider' | 'searchEncounters'
>;

describe('HospitalEncounterProductService', () => {
  const encounter: EncounterDTO = {
    id: 'enc-1',
    tenantId: 'tenant-1',
    patientId: 'pat-1',
    status: 'planned',
    encounterClass: 'IMP',
    encounterType: 'inpatient',
    priority: 'routine',
    admittingProviderId: 'doc-1',
    admittingDepartmentId: 'dept-1',
    currentDepartmentId: 'dept-1',
    currentLocationId: 'ward-1',
    diagnoses: [],
    participants: [],
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  };

  let encounterContract: jest.Mocked<EncounterContractSubset>;
  let service: HospitalEncounterProductService;

  beforeEach(() => {
    encounterContract = {
      createEncounter: jest.fn().mockResolvedValue({ success: true, encounter }),
      getEncounter: jest.fn().mockResolvedValue({ success: true, encounter }),
      assignProvider: jest.fn().mockResolvedValue({ success: true, encounter }),
      searchEncounters: jest.fn().mockResolvedValue({ success: true, encounters: [encounter], total: 1 }),
    };
    service = new HospitalEncounterProductService(encounterContract);
  });

  it('creates a foundation encounter through the public Encounter contract', async () => {
    const result = await service.createFoundationEncounter({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      encounterClass: 'IMP',
      encounterType: 'inpatient',
      priority: 'routine',
      admittingProviderId: 'doc-1',
      admittingDepartmentId: 'dept-1',
      actor: { actorId: 'user-1', role: 'receptionist' },
    });

    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      patientId: 'pat-1',
      status: 'planned',
      encounterClass: 'IMP',
      encounterType: 'inpatient',
    });
    expect(encounterContract.createEncounter).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      encounterClass: 'IMP',
      encounterType: 'inpatient',
      priority: 'routine',
      serviceType: undefined,
      admittingProviderId: 'doc-1',
      admittingDepartmentId: 'dept-1',
      chiefComplaint: undefined,
      referralSource: undefined,
      userId: 'user-1',
    });
  });

  it('gets and searches encounters through the public Encounter contract', async () => {
    await expect(service.getFoundationEncounter({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      actor: { actorId: 'user-1', role: 'doctor' },
    })).resolves.toMatchObject({ encounterId: 'enc-1' });

    await expect(service.searchFoundationEncounters({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      limit: 25,
      actor: { actorId: 'user-1', role: 'nurse' },
    })).resolves.toHaveLength(1);

    expect(encounterContract.getEncounter).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
    });
    expect(encounterContract.searchEncounters).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      status: undefined,
      encounterClass: undefined,
      departmentId: undefined,
      providerId: undefined,
      fromDate: undefined,
      toDate: undefined,
      limit: 25,
      offset: undefined,
    });
  });

  it('assigns a provider through the public Encounter contract', async () => {
    await expect(service.assignFoundationProvider({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      providerId: 'doc-2',
      role: 'attending',
      actor: { actorId: 'user-1', role: 'doctor' },
    })).resolves.toMatchObject({ encounterId: 'enc-1' });

    expect(encounterContract.assignProvider).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      providerId: 'doc-2',
      role: 'attending',
      userId: 'user-1',
    });
  });

  it('enforces tenant and actor boundaries before calling Encounter contract', async () => {
    await expect(service.createFoundationEncounter({
      tenantId: '',
      patientId: 'pat-1',
      encounterClass: 'IMP',
      encounterType: 'inpatient',
      actor: { actorId: 'user-1', role: 'receptionist' },
    })).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    await expect(service.getFoundationEncounter({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      actor: { actorId: '', role: 'doctor' },
    })).rejects.toThrow('AUTHORIZATION_VIOLATION');

    await expect(service.assignFoundationProvider({
      tenantId: 'tenant-1',
      encounterId: 'enc-1',
      providerId: 'doc-2',
      role: 'attending',
      actor: { actorId: 'user-1', role: 'receptionist' },
    })).rejects.toThrow('AUTHORIZATION_VIOLATION');

    expect(encounterContract.createEncounter).not.toHaveBeenCalled();
    expect(encounterContract.getEncounter).not.toHaveBeenCalled();
    expect(encounterContract.assignProvider).not.toHaveBeenCalled();
  });

  it('normalizes Encounter contract errors without bypass fallbacks', async () => {
    encounterContract.searchEncounters.mockResolvedValueOnce({
      success: false,
      encounters: [],
      total: 0,
      error: 'Encounter engine unavailable',
    });

    await expect(service.searchFoundationEncounters({
      tenantId: 'tenant-1',
      actor: { actorId: 'user-1', role: 'admin' },
    })).rejects.toThrow('ENCOUNTER_SEARCH_FAILED: Encounter engine unavailable');
  });
});
