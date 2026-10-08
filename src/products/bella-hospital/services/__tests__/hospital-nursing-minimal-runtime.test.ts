/**
 * BELLA HOSPITAL - NURSING MINIMAL RUNTIME TESTS
 *
 * Proves Hospital records nursing vital signs through the public Healthcare
 * Nursing contract without direct Nursing persistence access.
 */

import fs from 'fs';
import path from 'path';
import type { NursingEngineContract, RecordVitalsRequest } from '../../../../platform/healthcare/contracts/nursing-engine.contract';
import type { EngineResponse, VitalSigns } from '../../../../platform/healthcare/shared-kernel/types';
import { HospitalNursingProductService } from '../hospital-nursing.service';

type NursingContractSubset = Pick<NursingEngineContract, 'recordVitalSigns' | 'getVitalSigns'>;

class CapturingNursingContract implements NursingContractSubset {
  public recordCalls: RecordVitalsRequest[] = [];
  public records: VitalSigns[] = [];

  async recordVitalSigns(request: RecordVitalsRequest): Promise<EngineResponse<VitalSigns>> {
    this.recordCalls.push(request);

    const vitalSigns: VitalSigns = {
      id: `vitals-${this.records.length + 1}`,
      tenantId: request.tenantId,
      encounterId: request.encounterId,
      patientId: request.patientId,
      recordedBy: request.recordedBy,
      recordedDateTime: '2026-10-07T01:00:00.000Z',
      temperature: request.temperature,
      bloodPressure: request.bloodPressure,
      heartRate: request.heartRate,
      respiratoryRate: request.respiratoryRate,
      oxygenSaturation: request.oxygenSaturation,
      notes: request.notes,
      createdAt: '2026-10-07T01:00:00.000Z',
    };
    this.records.push(vitalSigns);

    return {
      success: true,
      data: vitalSigns,
    };
  }

  async getVitalSigns(tenantId: string, encounterId: string, limit?: number): Promise<EngineResponse<VitalSigns[]>> {
    const matching = this.records.filter((record) => (
      record.tenantId === tenantId && record.encounterId === encounterId
    ));

    return {
      success: true,
      data: limit === undefined ? matching : matching.slice(0, limit),
    };
  }
}

describe('HospitalNursingProductService', () => {
  let nursingContract: CapturingNursingContract;
  let service: HospitalNursingProductService;

  beforeEach(() => {
    nursingContract = new CapturingNursingContract();
    service = new HospitalNursingProductService(nursingContract);
  });

  it('records vital signs through the public Nursing contract', async () => {
    const result = await service.recordVitalSigns({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      recordedBy: 'nurse-1',
      temperature: { value: 37.2, unit: 'C' },
      bloodPressure: { systolic: 118, diastolic: 76 },
      heartRate: { value: 82, unit: 'bpm' },
      respiratoryRate: { value: 18, unit: 'breaths/min' },
      oxygenSaturation: { value: 98, unit: '%' },
      notes: 'Stable',
    });

    expect(nursingContract.recordCalls).toHaveLength(1);
    expect(nursingContract.recordCalls[0]).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      recordedBy: 'nurse-1',
    });
    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      vitalSignsId: 'vitals-1',
      recordedBy: 'nurse-1',
      recordedDateTime: '2026-10-07T01:00:00.000Z',
      vitals: {
        temperature: { value: 37.2, unit: 'C' },
        bloodPressure: { systolic: 118, diastolic: 76 },
        heartRate: { value: 82, unit: 'bpm' },
        respiratoryRate: { value: 18, unit: 'breaths/min' },
        oxygenSaturation: { value: 98, unit: '%' },
      },
      downstream: {
        temporal: 'NOT_PROVEN',
        auditEvidence: 'NOT_PROVEN',
        discharge: 'NOT_PROVEN',
        billing: 'NOT_PROVEN',
      },
    });
  });

  it('preserves tenant, patient, encounter, and nurse linkage', async () => {
    const result = await service.recordVitalSigns({
      tenantId: 'tenant-2',
      patientId: 'patient-2',
      encounterId: 'encounter-2',
      recordedBy: 'nurse-2',
      temperature: { value: 36.8, unit: 'C' },
      bloodPressure: { systolic: 124, diastolic: 78 },
      heartRate: { value: 76, unit: 'bpm' },
      oxygenSaturation: { value: 97, unit: '%' },
    });

    expect(result.tenantId).toBe('tenant-2');
    expect(result.patientId).toBe('patient-2');
    expect(result.encounterId).toBe('encounter-2');
    expect(result.recordedBy).toBe('nurse-2');
    expect(nursingContract.records[0]).toMatchObject({
      tenantId: 'tenant-2',
      patientId: 'patient-2',
      encounterId: 'encounter-2',
      recordedBy: 'nurse-2',
    });
  });

  it('rejects missing tenant before calling the Nursing contract', async () => {
    await expect(service.recordVitalSigns({
      tenantId: ' ',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      recordedBy: 'nurse-1',
      temperature: { value: 37.2, unit: 'C' },
      bloodPressure: { systolic: 118, diastolic: 76 },
      heartRate: { value: 82, unit: 'bpm' },
      oxygenSaturation: { value: 98, unit: '%' },
    })).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    expect(nursingContract.recordCalls).toHaveLength(0);
  });

  it('uses public contracts and does not import Nursing repository or direct persistence in Hospital service', () => {
    const sourcePath = path.join(
      process.cwd(),
      'src/products/bella-hospital/services/hospital-nursing.service.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain("from '../../../platform/healthcare/contracts/nursing-engine.contract'");
    expect(source).not.toContain('platform/healthcare/engines/nursing-engine');
    expect(source).not.toContain('NursingEngineService');
    expect(source).not.toContain('hc_nursing_vital_signs');
    expect(source).not.toContain('hc_vital_signs');
    expect(source).not.toContain('hc_nursing_notes');
  });
});
