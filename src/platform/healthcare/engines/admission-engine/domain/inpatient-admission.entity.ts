/**
 * Inpatient Admission Aggregate Root
 *
 * Domain Entity representing an Inpatient Admission in the Healthcare Platform.
 * Lifecycle: requested -> admitted -> transferred -> discharged (or cancelled).
 *
 * Invariants:
 * - Admission MUST reference a valid tenantId, encounterId, patientPartyId, wardId, and bedId.
 * - Admission state transitions MUST follow the strict lifecycle state machine.
 * - Discharged or Cancelled admissions are terminal and cannot be modified.
 *
 * @module platform/healthcare/engines/admission-engine/domain
 */

export type AdmissionStatus = 'requested' | 'admitted' | 'transferred' | 'discharged' | 'cancelled';

export interface AdmissionStateProps {
  id: string;
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  wardId: string;
  bedId: string;
  admittingDoctorId: string;
  attendingDoctorId: string;
  status: AdmissionStatus;
  admissionDiagnosis: Array<{
    icd10Code: string;
    icd10NameVi: string;
    isPrimary: boolean;
  }>;
  dischargeSummary?: string;
  admittedAt: string;
  dischargedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class InpatientAdmission {
  private constructor(private readonly props: AdmissionStateProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientPartyId: string;
    wardId: string;
    bedId: string;
    admittingDoctorId: string;
    attendingDoctorId: string;
    admissionDiagnosis: Array<{
      icd10Code: string;
      icd10NameVi: string;
      isPrimary: boolean;
    }>;
    now?: string;
  }): InpatientAdmission {
    if (!input.tenantId) throw new Error('TenantId is required for Admission');
    if (!input.encounterId) throw new Error('EncounterId is required for Admission');
    if (!input.patientPartyId) throw new Error('PatientPartyId is required for Admission');
    if (!input.wardId) throw new Error('WardId is required for Admission');
    if (!input.bedId) throw new Error('BedId is required for Admission');
    if (!input.admissionDiagnosis || input.admissionDiagnosis.length === 0) {
      throw new Error('At least one primary admission diagnosis is required');
    }

    const timestamp = input.now || new Date().toISOString();

    return new InpatientAdmission({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      patientPartyId: input.patientPartyId,
      wardId: input.wardId,
      bedId: input.bedId,
      admittingDoctorId: input.admittingDoctorId,
      attendingDoctorId: input.attendingDoctorId,
      status: 'admitted',
      admissionDiagnosis: input.admissionDiagnosis,
      admittedAt: timestamp,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  public static rehydrate(props: AdmissionStateProps): InpatientAdmission {
    return new InpatientAdmission(props);
  }

  // Getters
  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get patientPartyId(): string { return this.props.patientPartyId; }
  public get wardId(): string { return this.props.wardId; }
  public get bedId(): string { return this.props.bedId; }
  public get admittingDoctorId(): string { return this.props.admittingDoctorId; }
  public get attendingDoctorId(): string { return this.props.attendingDoctorId; }
  public get status(): AdmissionStatus { return this.props.status; }
  public get admissionDiagnosis() { return [...this.props.admissionDiagnosis]; }
  public get dischargeSummary(): string | undefined { return this.props.dischargeSummary; }
  public get admittedAt(): string { return this.props.admittedAt; }
  public get dischargedAt(): string | undefined { return this.props.dischargedAt; }
  public get version(): number { return this.props.version; }
  public get createdAt(): string { return this.props.createdAt; }
  public get updatedAt(): string { return this.props.updatedAt; }

  // State Transitions
  public transfer(newWardId: string, newBedId: string, now?: string): void {
    if (this.props.status === 'discharged' || this.props.status === 'cancelled') {
      throw new Error(`Cannot transfer an admission in terminal status: ${this.props.status}`);
    }
    if (!newWardId || !newBedId) {
      throw new Error('New WardId and BedId are required for transfer');
    }

    this.props.wardId = newWardId;
    this.props.bedId = newBedId;
    this.props.status = 'transferred';
    this.props.version += 1;
    this.props.updatedAt = now || new Date().toISOString();
  }

  public discharge(summary: string, now?: string): void {
    if (this.props.status === 'discharged' || this.props.status === 'cancelled') {
      throw new Error(`Cannot discharge an admission in terminal status: ${this.props.status}`);
    }
    if (!summary || summary.trim().length === 0) {
      throw new Error('Discharge summary is required');
    }

    const timestamp = now || new Date().toISOString();
    this.props.status = 'discharged';
    this.props.dischargeSummary = summary.trim();
    this.props.dischargedAt = timestamp;
    this.props.version += 1;
    this.props.updatedAt = timestamp;
  }

  public toSnapshot(): AdmissionStateProps {
    return { ...this.props, admissionDiagnosis: [...this.props.admissionDiagnosis] };
  }
}
