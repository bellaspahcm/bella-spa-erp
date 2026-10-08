/**
 * BELLA HOSPITAL - NURSING GO-LIVE PRODUCT SERVICE
 *
 * Minimal Hospital runtime orchestration for nursing vital signs through the
 * public Healthcare Nursing contract. This service does not access Nursing
 * internals, repositories, direct DB tables, H9 Temporal, H11 Audit,
 * Discharge, Billing, Finance, Real DB, or Browser E2E surfaces.
 *
 * @module src/products/bella-hospital/services/hospital-nursing.service
 */

import type {
  NursingEngineContract,
  RecordVitalsRequest,
} from '../../../platform/healthcare/contracts/nursing-engine.contract';
import type { EngineResponse, VitalSigns } from '../../../platform/healthcare/shared-kernel/types';

type HospitalNursingContract = Pick<NursingEngineContract, 'recordVitalSigns' | 'getVitalSigns'>;

export interface HospitalRecordVitalSignsDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  recordedBy: string;
  temperature: { value: number; unit: string };
  bloodPressure: { systolic: number; diastolic: number };
  heartRate: { value: number; unit: string };
  respiratoryRate?: { value: number; unit: string };
  oxygenSaturation: { value: number; unit: string };
  notes?: string;
}

export interface HospitalNursingRuntimeDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  vitalSignsId: string;
  recordedBy: string;
  recordedDateTime: string;
  vitals: {
    temperature?: VitalSigns['temperature'];
    bloodPressure?: VitalSigns['bloodPressure'];
    heartRate?: VitalSigns['heartRate'];
    respiratoryRate?: VitalSigns['respiratoryRate'];
    oxygenSaturation?: VitalSigns['oxygenSaturation'];
  };
  downstream: {
    temporal: 'NOT_PROVEN';
    auditEvidence: 'NOT_PROVEN';
    discharge: 'NOT_PROVEN';
    billing: 'NOT_PROVEN';
  };
}

export class HospitalNursingProductService {
  constructor(private readonly nursingContract: HospitalNursingContract) {}

  async recordVitalSigns(dto: HospitalRecordVitalSignsDTO): Promise<HospitalNursingRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.recordedBy, 'recordedBy');

    const request: RecordVitalsRequest = {
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      recordedBy: dto.recordedBy,
      temperature: dto.temperature,
      bloodPressure: dto.bloodPressure,
      heartRate: dto.heartRate,
      respiratoryRate: dto.respiratoryRate,
      oxygenSaturation: dto.oxygenSaturation,
      notes: dto.notes,
    };

    const vitalSigns = unwrapRequiredEngineResponse(
      await this.nursingContract.recordVitalSigns(request),
      'NURSING_VITALS_RECORD_FAILED'
    );

    assertSame('tenantId', dto.tenantId, vitalSigns.tenantId);
    assertSame('patientId', dto.patientId, vitalSigns.patientId);
    assertSame('encounterId', dto.encounterId, vitalSigns.encounterId);
    assertSame('recordedBy', dto.recordedBy, vitalSigns.recordedBy);

    return {
      tenantId: vitalSigns.tenantId,
      patientId: vitalSigns.patientId,
      encounterId: vitalSigns.encounterId,
      vitalSignsId: vitalSigns.id,
      recordedBy: vitalSigns.recordedBy,
      recordedDateTime: vitalSigns.recordedDateTime,
      vitals: {
        temperature: vitalSigns.temperature,
        bloodPressure: vitalSigns.bloodPressure,
        heartRate: vitalSigns.heartRate,
        respiratoryRate: vitalSigns.respiratoryRate,
        oxygenSaturation: vitalSigns.oxygenSaturation,
      },
      downstream: {
        temporal: 'NOT_PROVEN',
        auditEvidence: 'NOT_PROVEN',
        discharge: 'NOT_PROVEN',
        billing: 'NOT_PROVEN',
      },
    };
  }
}

function assertTenant(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
  }
}

function assertRequired(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`NURSING_RUNTIME_VALIDATION_FAILED: ${field} is required`);
  }
}

function assertSame(field: string, expected: string, actual: string): void {
  if (expected !== actual) {
    throw new Error(`NURSING_RUNTIME_LINKAGE_MISMATCH: ${field}`);
  }
}

function unwrapRequiredEngineResponse<T>(response: EngineResponse<T>, fallbackCode: string): T {
  if (response.success && response.data !== undefined) {
    return response.data;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}
