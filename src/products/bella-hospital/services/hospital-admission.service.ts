/**
 * BELLA HOSPITAL — HOSPITAL ADMISSION PRODUCT SERVICE
 *
 * Encapsulates inpatient admission, bed transfer, and discharge workflows
 * in full compliance with the Healthcare Vertical Coding Constitution:
 * - Product -> Public Contract -> Frozen Kernel H1-H12
 * - H9 Bitemporal Provenance on Bed Transfer
 * - H11 Evidence Fingerprint on Patient Discharge
 * - Strict Typing & Zero Direct `hc_*` Table Access
 *
 * @module src/products/bella-hospital/services/hospital-admission.service
 */

import type {
  AdmissionDTO,
  AdmissionEngineContract,
  CreateAdmissionRequest,
} from '../../../platform/healthcare/contracts/admission-engine.contract';
import type {
  BedEngineContract,
  BedReleaseRequest,
  BedTransferRequest,
} from '../../../platform/healthcare/contracts/bed-engine.contract';
import type {
  ITemporalContract,
} from '../../../platform/healthcare/contracts/temporal-engine.contract';
import type {
  IClinicalAuditContract,
  IClinicalEvidencePackage,
  IRecordAuditInput,
} from '../../../platform/healthcare/contracts/clinical-audit.contract';
import type { EngineResponse } from '../../../platform/healthcare/shared-kernel/types';

export interface InpatientAdmissionDTO {
  tenantId: string;
  encounterId: string;
  patientId: string;
  wardId: string;
  bedId: string;
  admittingPhysicianId: string;
  attendingPhysicianId: string;
  admissionDiagnosis: CreateAdmissionRequest['admissionDiagnosis'];
  userId?: string;
}

export interface BedTransferDTO {
  admissionId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  sourceBedId: string;
  targetBedId: string;
  transferReason: string;
  transferredBy: string;
  timestamp?: string;
}

export interface HospitalDischargeDTO {
  admissionId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  dischargingPhysicianId: string;
  dischargeDisposition: 'HOME' | 'TRANSFERRED' | 'DECEASED' | 'AGAINST_MEDICAL_ADVICE';
  dischargeSummary: string;
  timestamp: string;
}

export interface HospitalDischargeResultDTO {
  admissionId: string;
  encounterId: string;
  status: 'DISCHARGED';
  bedId: string;
  bedReleaseStatus: 'RELEASED';
  temporalEventId: string;
  evidencePackageId: string;
  sha256Fingerprint: string;
  dischargedAt: string;
}

export class HospitalAdmissionProductService {
  constructor(
    private readonly admissionContract: Pick<AdmissionEngineContract, 'createAdmission' | 'dischargeAdmission'>,
    private readonly bedContract: Pick<BedEngineContract, 'transferBed' | 'releaseBed'>,
    private readonly temporalContract: Pick<ITemporalContract, 'recordTemporalEvent'>,
    private readonly auditContract: Pick<IClinicalAuditContract, 'recordAuditEntry' | 'issueEvidencePackage'>
  ) {}

  /**
   * Admits a patient to an inpatient bed via Public Contract
   */
  async admitInpatient(dto: InpatientAdmissionDTO): Promise<AdmissionDTO> {
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    const response = await this.admissionContract.createAdmission({
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientPartyId: dto.patientId,
      wardId: dto.wardId,
      bedId: dto.bedId,
      admittingDoctorId: dto.admittingPhysicianId,
      attendingDoctorId: dto.attendingPhysicianId,
      admissionDiagnosis: dto.admissionDiagnosis,
      userId: dto.userId,
    });

    return unwrapEngineResponse(response, 'ADMISSION_CREATE_FAILED');
  }

  /**
   * Transfers a patient bed and records a H9 Bitemporal Timeline Event
   */
  async transferBed(dto: BedTransferDTO): Promise<{ admissionId: string; status: 'transferred'; transferId: string }> {
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    // 1. Execute bed transfer via Kernel Public Contract
    const transferResponse = await this.bedContract.transferBed({
      tenantId: dto.tenantId,
      fromBedId: dto.sourceBedId,
      toBedId: dto.targetBedId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      admissionId: dto.admissionId,
      reason: dto.transferReason,
      transferredBy: dto.transferredBy,
      scheduledTime: dto.timestamp,
    });
    const transferResult = unwrapEngineResponse(transferResponse, 'BED_TRANSFER_FAILED');

    // 2. Record Bitemporal Event in H9 Temporal Engine
    await this.temporalContract.recordTemporalEvent({
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      aggregateType: 'Admission',
      aggregateId: dto.admissionId,
      eventType: 'BED_TRANSFERRED',
      validTime: dto.timestamp || new Date().toISOString(),
      deltaPayload: {
        admissionId: dto.admissionId,
        sourceBedId: dto.sourceBedId,
        targetBedId: dto.targetBedId,
        transferReason: dto.transferReason,
        transferredBy: dto.transferredBy,
        transferId: transferResult.transferId,
      }
    });

    return {
      admissionId: dto.admissionId,
      status: 'transferred',
      transferId: transferResult.transferId,
    };
  }

  /**
   * Discharges a patient and issues a H11 Evidence Fingerprint
   */
  async dischargeInpatient(dto: HospitalDischargeDTO): Promise<HospitalDischargeResultDTO> {
    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.encounterId) throw new Error('ENCOUNTER_BOUNDARY_VIOLATION: encounterId is required');

    const timestamp = dto.timestamp || new Date().toISOString();

    // 1. Execute discharge via Kernel Public Contract
    const dischargeResponse = await this.admissionContract.dischargeAdmission({
      admissionId: dto.admissionId,
      tenantId: dto.tenantId,
      dischargeSummary: dto.dischargeSummary,
      userId: dto.dischargingPhysicianId,
    });
    const dischargedAdmission = unwrapEngineResponse(dischargeResponse, 'ADMISSION_DISCHARGE_FAILED');

    assertSame('tenantId', dto.tenantId, dischargedAdmission.tenantId);
    assertSame('encounterId', dto.encounterId, dischargedAdmission.encounterId);
    assertSame('patientId', dto.patientId, dischargedAdmission.patientPartyId);

    const releaseResponse = await this.bedContract.releaseBed({
      tenantId: dto.tenantId,
      bedId: dischargedAdmission.bedId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      admissionId: dto.admissionId,
      reason: dischargeDispositionToBedReleaseReason(dto.dischargeDisposition),
      releasedBy: dto.dischargingPhysicianId,
      notes: dto.dischargeSummary,
    });
    unwrapEngineResponse(releaseResponse, 'BED_RELEASE_FAILED');

    const temporalEvent = unwrapEngineResponse(
      await this.temporalContract.recordTemporalEvent({
        tenantId: dto.tenantId,
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        aggregateType: 'Admission',
        aggregateId: dto.admissionId,
        eventType: 'INPATIENT_DISCHARGED',
        validTime: timestamp,
        deltaPayload: {
          admissionId: dto.admissionId,
          bedId: dischargedAdmission.bedId,
          dischargeDisposition: dto.dischargeDisposition,
          dischargeSummary: dto.dischargeSummary,
          dischargingPhysicianId: dto.dischargingPhysicianId,
        },
      }),
      'TEMPORAL_DISCHARGE_EVENT_FAILED'
    );

    // 2. Issue H11 Legal Audit Evidence Package
    const auditInput: IRecordAuditInput = {
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      actionType: 'INPATIENT_DISCHARGE_EXECUTE',
      performerId: dto.dischargingPhysicianId,
      performerRole: 'PHYSICIAN',
      h10RuleCode: 'HOSPITAL_DISCHARGE_RULE',
      h10RuleVersion: '1.0.0',
      h10RuleChecksum: 'SHA256:HOSPITAL_DISCHARGE_RULE_V1.0',
      metadata: {
        admissionId: dto.admissionId,
        dischargeDisposition: dto.dischargeDisposition,
        dischargeSummary: dto.dischargeSummary,
      },
    };

    const auditRecord = unwrapEngineResponse(
      await this.auditContract.recordAuditEntry(auditInput),
      'AUDIT_RECORD_FAILED'
    );
    const evidencePackage = unwrapEngineResponse(
      await this.auditContract.issueEvidencePackage(dto.tenantId, auditRecord.id),
      'EVIDENCE_PACKAGE_FAILED'
    );

    return {
      admissionId: dto.admissionId,
      encounterId: dto.encounterId,
      status: 'DISCHARGED',
      bedId: dischargedAdmission.bedId,
      bedReleaseStatus: 'RELEASED',
      temporalEventId: temporalEvent.id,
      evidencePackageId: evidencePackage.id,
      sha256Fingerprint: evidencePackage.fingerprint,
      dischargedAt: timestamp
    };
  }
}

function unwrapEngineResponse<T>(response: EngineResponse<T>, fallbackCode: string): T {
  if (response.success && response.data) {
    return response.data;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}

function assertSame(field: string, expected: string, actual: string): void {
  if (expected !== actual) {
    throw new Error(`DISCHARGE_RUNTIME_LINKAGE_MISMATCH: ${field}`);
  }
}

function dischargeDispositionToBedReleaseReason(
  disposition: HospitalDischargeDTO['dischargeDisposition']
): BedReleaseRequest['reason'] {
  return disposition === 'DECEASED' ? 'death' : 'discharge';
}
