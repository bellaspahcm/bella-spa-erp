/**
 * BELLA HOSPITAL - PATIENT/MPI FOUNDATION RUNTIME TESTS
 *
 * Proves Hospital consumes Patient/MPI through the public contract only.
 */

import type {
  PatientMpiContract,
  PatientMpiDTO,
} from '../../../../platform/healthcare/contracts/patient-mpi.contract';
import { HospitalPatientMpiProductService } from '../hospital-patient-mpi.service';

type PatientMpiContractSubset = Pick<
  PatientMpiContract,
  'registerPatient' | 'getPatientById' | 'findPatientByIdentifier' | 'searchPatients'
>;

describe('HospitalPatientMpiProductService', () => {
  const patient: PatientMpiDTO = {
    tenantId: 'tenant-1',
    patientId: 'pat-1',
    displayName: 'Nguyen Van A',
    legalName: 'Nguyen Van A',
    dob: '1990-01-01',
    gender: 'male',
    bloodType: 'O+',
    identifiers: [
      { type: 'bhyt', value: 'BHYT-001' },
      { type: 'cccd', value: '012345678901' },
    ],
  };

  let patientMpiContract: jest.Mocked<PatientMpiContractSubset>;
  let service: HospitalPatientMpiProductService;

  beforeEach(() => {
    patientMpiContract = {
      registerPatient: jest.fn().mockResolvedValue({ success: true, data: patient }),
      getPatientById: jest.fn().mockResolvedValue({ success: true, data: patient }),
      findPatientByIdentifier: jest.fn().mockResolvedValue({ success: true, data: patient }),
      searchPatients: jest.fn().mockResolvedValue({ success: true, data: [patient] }),
    };
    service = new HospitalPatientMpiProductService(patientMpiContract);
  });

  it('registers a foundation patient through the public Patient/MPI contract', async () => {
    const result = await service.registerFoundationPatient({
      tenantId: 'tenant-1',
      displayName: 'Nguyen Van A',
      legalName: 'Nguyen Van A',
      dob: '1990-01-01',
      gender: 'male',
      bloodType: 'O+',
      bhytNumber: 'BHYT-001',
      nationalId: '012345678901',
      actor: { actorId: 'user-1', role: 'receptionist' },
    });

    expect(result).toEqual({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      displayName: 'Nguyen Van A',
      legalName: 'Nguyen Van A',
      dob: '1990-01-01',
      gender: 'male',
      bloodType: 'O+',
      identifiers: patient.identifiers,
    });
    expect(patientMpiContract.registerPatient).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      displayName: 'Nguyen Van A',
      legalName: 'Nguyen Van A',
      dob: '1990-01-01',
      gender: 'male',
      bloodType: 'O+',
      bhytNumber: 'BHYT-001',
      nationalId: '012345678901',
      actorId: 'user-1',
    });
  });

  it('gets and searches patients through the public Patient/MPI contract', async () => {
    await expect(service.getFoundationPatient({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      actor: { actorId: 'user-1', role: 'doctor' },
    })).resolves.toMatchObject({ patientId: 'pat-1' });

    await expect(service.searchFoundationPatients({
      tenantId: 'tenant-1',
      displayNameLike: 'Nguyen',
      limit: 25,
      actor: { actorId: 'user-1', role: 'nurse' },
    })).resolves.toHaveLength(1);

    expect(patientMpiContract.getPatientById).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
    });
    expect(patientMpiContract.searchPatients).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      displayNameLike: 'Nguyen',
      identifierType: undefined,
      identifierValue: undefined,
      limit: 25,
      offset: undefined,
    });
  });

  it('finds by identifier and preserves null lookup results', async () => {
    await expect(service.findFoundationPatientByIdentifier({
      tenantId: 'tenant-1',
      identifierType: 'bhyt',
      identifierValue: 'BHYT-001',
      actor: { actorId: 'user-1', role: 'admin' },
    })).resolves.toMatchObject({ patientId: 'pat-1' });

    patientMpiContract.findPatientByIdentifier.mockResolvedValueOnce({ success: true, data: null });

    await expect(service.findFoundationPatientByIdentifier({
      tenantId: 'tenant-1',
      identifierType: 'cccd',
      identifierValue: 'missing',
      actor: { actorId: 'user-1', role: 'admin' },
    })).resolves.toBeNull();
  });

  it('enforces tenant and actor boundaries before calling Patient/MPI contract', async () => {
    await expect(service.registerFoundationPatient({
      tenantId: '',
      displayName: 'Nguyen Van A',
      actor: { actorId: 'user-1', role: 'receptionist' },
    })).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    await expect(service.getFoundationPatient({
      tenantId: 'tenant-1',
      patientId: 'pat-1',
      actor: { actorId: '', role: 'doctor' },
    })).rejects.toThrow('AUTHORIZATION_VIOLATION');

    expect(patientMpiContract.registerPatient).not.toHaveBeenCalled();
    expect(patientMpiContract.getPatientById).not.toHaveBeenCalled();
  });

  it('normalizes Patient/MPI contract errors without bypass fallbacks', async () => {
    patientMpiContract.searchPatients.mockResolvedValueOnce({
      success: false,
      error: {
        code: 'PATIENT_MPI_UNAVAILABLE',
        message: 'Patient/MPI unavailable',
        timestamp: '2026-10-07T00:00:00.000Z',
      },
    });

    await expect(service.searchFoundationPatients({
      tenantId: 'tenant-1',
      actor: { actorId: 'user-1', role: 'admin' },
    })).rejects.toThrow('PATIENT_MPI_UNAVAILABLE: Patient/MPI unavailable');
  });
});
