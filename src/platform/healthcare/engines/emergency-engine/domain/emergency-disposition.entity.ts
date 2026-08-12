/**
 * EmergencyDisposition Aggregate Root
 *
 * Manages Emergency Clinical Disposition Decision (Discharge, Transfer, or Inpatient Admission).
 *
 * Architecture Invariant:
 * Emergency Engine owns the Disposition Decision (Decision Aggregate),
 * but DESTINATION ENGINE owns Destination Lifecycle execution.
 *
 * Disposition Options:
 * - DISCHARGE: Complete Emergency Encounter (orchestrates EncounterEngine.completeEncounter)
 * - TRANSFER: Transfer to external facility / department (orchestrates TransferContract.initiateTransfer)
 * - ADMIT: Transfer to Inpatient Ward (orchestrates AdmissionEngine.requestAdmission)
 *
 * Lifecycle States:
 * - PENDING: Decision under clinical evaluation
 * - DECIDED: Emergency Physician finalized disposition decision
 * - EXECUTED: Handed off & executed by Destination Engine
 *
 * @module platform/healthcare/engines/emergency-engine/domain
 */

export type DispositionType = 'DISCHARGE' | 'TRANSFER' | 'ADMIT';
export type DispositionStatus = 'PENDING' | 'DECIDED' | 'EXECUTED';

export interface DischargeMetadata {
  dischargeInstructions: string;
  prescriptionsIssued: boolean;
  followUpDays?: number;
}

export interface TransferMetadata {
  receivingFacilityName: string;
  transferReason: string;
  transportMode: string;
  receivingPhysicianName?: string;
}

export interface AdmissionMetadata {
  targetWardId: string;
  admittingSpecialty: string;
  provisionalDiagnosis: string;
  admissionPriority: 'ROUTINE' | 'URGENT' | 'EMERGENCY_IMMEDIATE';
}

export interface EmergencyDispositionProps {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  status: DispositionStatus;
  dispositionType?: DispositionType | null;
  dischargeMetadata?: DischargeMetadata | null;
  transferMetadata?: TransferMetadata | null;
  admissionMetadata?: AdmissionMetadata | null;
  decidedBy?: string | null;
  decidedAt?: Date | null;
  executedAt?: Date | null;
  executionReferenceId?: string | null; // e.g. admissionId or encounterCompletionToken
  createdAt: Date;
  updatedAt: Date;
}

export class EmergencyDisposition {
  private constructor(private readonly props: EmergencyDispositionProps) {}

  public static create(params: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
  }): EmergencyDisposition {
    if (!params.tenantId) throw new Error('EmergencyDisposition requires tenantId');
    if (!params.encounterId) throw new Error('EmergencyDisposition requires encounterId');
    if (!params.patientId) throw new Error('EmergencyDisposition requires patientId');

    const now = new Date();

    return new EmergencyDisposition({
      id: params.id,
      tenantId: params.tenantId,
      encounterId: params.encounterId,
      patientId: params.patientId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: EmergencyDispositionProps): EmergencyDisposition {
    return new EmergencyDisposition(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get patientId(): string { return this.props.patientId; }
  public get status(): DispositionStatus { return this.props.status; }
  public get dispositionType(): DispositionType | null | undefined { return this.props.dispositionType; }
  public get dischargeMetadata(): DischargeMetadata | null | undefined { return this.props.dischargeMetadata; }
  public get transferMetadata(): TransferMetadata | null | undefined { return this.props.transferMetadata; }
  public get admissionMetadata(): AdmissionMetadata | null | undefined { return this.props.admissionMetadata; }
  public get decidedBy(): string | null | undefined { return this.props.decidedBy; }
  public get decidedAt(): Date | null | undefined { return this.props.decidedAt; }
  public get executedAt(): Date | null | undefined { return this.props.executedAt; }
  public get executionReferenceId(): string | null | undefined { return this.props.executionReferenceId; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public decideDischarge(params: {
    decidedBy: string;
    metadata: DischargeMetadata;
  }): void {
    if (this.props.status === 'EXECUTED') throw new Error('Cannot change executed disposition');
    if (!params.metadata.dischargeInstructions.trim()) throw new Error('Discharge requires dischargeInstructions');

    this.props.dispositionType = 'DISCHARGE';
    this.props.dischargeMetadata = params.metadata;
    this.props.transferMetadata = null;
    this.props.admissionMetadata = null;
    this.props.decidedBy = params.decidedBy;
    this.props.decidedAt = new Date();
    this.props.status = 'DECIDED';
    this.props.updatedAt = new Date();
  }

  public decideTransfer(params: {
    decidedBy: string;
    metadata: TransferMetadata;
  }): void {
    if (this.props.status === 'EXECUTED') throw new Error('Cannot change executed disposition');
    if (!params.metadata.receivingFacilityName.trim()) throw new Error('Transfer requires receivingFacilityName');

    this.props.dispositionType = 'TRANSFER';
    this.props.transferMetadata = params.metadata;
    this.props.dischargeMetadata = null;
    this.props.admissionMetadata = null;
    this.props.decidedBy = params.decidedBy;
    this.props.decidedAt = new Date();
    this.props.status = 'DECIDED';
    this.props.updatedAt = new Date();
  }

  public decideAdmission(params: {
    decidedBy: string;
    metadata: AdmissionMetadata;
  }): void {
    if (this.props.status === 'EXECUTED') throw new Error('Cannot change executed disposition');
    if (!params.metadata.targetWardId) throw new Error('Admission requires targetWardId');

    this.props.dispositionType = 'ADMIT';
    this.props.admissionMetadata = params.metadata;
    this.props.dischargeMetadata = null;
    this.props.transferMetadata = null;
    this.props.decidedBy = params.decidedBy;
    this.props.decidedAt = new Date();
    this.props.status = 'DECIDED';
    this.props.updatedAt = new Date();
  }

  public markExecuted(executionReferenceId: string): void {
    if (this.props.status !== 'DECIDED') throw new Error('Disposition must be DECIDED before execution');
    this.props.status = 'EXECUTED';
    this.props.executionReferenceId = executionReferenceId;
    this.props.executedAt = new Date();
    this.props.updatedAt = new Date();
  }

  public toJSON(): EmergencyDispositionProps {
    return { ...this.props };
  }
}
