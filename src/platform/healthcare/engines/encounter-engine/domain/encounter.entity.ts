/**
 * Encounter Domain Entity (Aggregate Root)
 * 
 * Constitution Compliance:
 * - Law 1: Encounter is the Aggregate Root for all clinical activities
 * - Law 11: Strictly typed, no `any` types allowed
 * 
 * This entity implements the core business logic and invariants for healthcare encounters.
 * It enforces the encounter lifecycle state machine and validates all business rules.
 * 
 * @module platform/healthcare/engines/encounter-engine/domain
 */

import { Diagnosis } from '@/platform/healthcare/shared-kernel/types';

// ============================================================================
// Types & Enums
// ============================================================================

export type EncounterType = 
  | 'outpatient' 
  | 'inpatient' 
  | 'emergency' 
  | 'home-health' 
  | 'virtual';

export type EncounterClass = 
  | 'AMB'   // Ambulatory
  | 'EMER'  // Emergency
  | 'IMP'   // Inpatient
  | 'HH'    // Home Health
  | 'VR';   // Virtual

export type EncounterStatus = 
  | 'planned' 
  | 'arrived' 
  | 'triaged' 
  | 'in-progress' 
  | 'on-hold' 
  | 'finished' 
  | 'cancelled';

export interface EncounterPeriod {
  start: Date;
  end?: Date;
}

export interface EncounterProvenance {
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}

// ============================================================================
// Domain Errors
// ============================================================================

export class EncounterDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EncounterDomainError';
  }
}

export class InvalidStateTransitionError extends EncounterDomainError {
  constructor(from: EncounterStatus, to: EncounterStatus) {
    super(
      `Invalid state transition from ${from} to ${to}`,
      'INVALID_STATE_TRANSITION',
      { from, to }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class InvalidPeriodError extends EncounterDomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_PERIOD', details);
    this.name = 'InvalidPeriodError';
  }
}

export class EncounterAlreadyFinishedError extends EncounterDomainError {
  constructor(encounterId: string) {
    super(
      `Cannot modify finished encounter: ${encounterId}`,
      'ENCOUNTER_ALREADY_FINISHED',
      { encounterId }
    );
    this.name = 'EncounterAlreadyFinishedError';
  }
}

export class MissingRequiredFieldError extends EncounterDomainError {
  constructor(field: string) {
    super(
      `Required field missing: ${field}`,
      'MISSING_REQUIRED_FIELD',
      { field }
    );
    this.name = 'MissingRequiredFieldError';
  }
}

export class TenantBoundaryViolationError extends EncounterDomainError {
  constructor(message: string) {
    super(message, 'TENANT_BOUNDARY_VIOLATION');
    this.name = 'TenantBoundaryViolationError';
  }
}

// ============================================================================
// Encounter Aggregate Root
// ============================================================================

export interface CreateEncounterData {
  tenantId: string;
  patientId: string;
  encounterType: EncounterType;
  encounterClass: EncounterClass;
  startDateTime: Date;
  serviceProviderId?: string;
  departmentId?: string;
  locationId?: string;
  reasonCode?: string[];
  isEmergency?: boolean;
  parentEncounterId?: string;
  createdBy: string;
}

export interface EncounterProps {
  id: string;
  tenantId: string;
  patientId: string;
  encounterType: EncounterType;
  encounterClass: EncounterClass;
  status: EncounterStatus;
  period: EncounterPeriod;
  serviceProviderId?: string;
  departmentId?: string;
  locationId?: string;
  reasonCode: string[];
  diagnosis: Diagnosis[];
  parentEncounterId?: string;
  metadata: Record<string, unknown>;
  provenance: EncounterProvenance;
}

export class Encounter {
  private constructor(private props: EncounterProps) {
    this.validate();
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new planned encounter
   */
  static create(data: CreateEncounterData): Encounter {
    // Validate required fields
    if (!data.tenantId) {
      throw new MissingRequiredFieldError('tenantId');
    }
    if (!data.patientId) {
      throw new MissingRequiredFieldError('patientId');
    }
    if (!data.encounterType) {
      throw new MissingRequiredFieldError('encounterType');
    }
    if (!data.encounterClass) {
      throw new MissingRequiredFieldError('encounterClass');
    }
    if (!data.createdBy) {
      throw new MissingRequiredFieldError('createdBy');
    }

    const now = new Date();

    // Emergency encounters start immediately in 'arrived' status
    const initialStatus: EncounterStatus = data.isEmergency ? 'arrived' : 'planned';

    const props: EncounterProps = {
      // ✅ Generate UUID for database compatibility
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      patientId: data.patientId,
      encounterType: data.encounterType,
      encounterClass: data.encounterClass,
      status: initialStatus,
      period: {
        start: data.startDateTime,
        end: undefined,
      },
      serviceProviderId: data.serviceProviderId,
      departmentId: data.departmentId,
      locationId: data.locationId,
      reasonCode: data.reasonCode || [],
      diagnosis: [],
      parentEncounterId: data.parentEncounterId,
      metadata: {},
      provenance: {
        createdBy: data.createdBy,
        createdAt: now,
        updatedBy: data.createdBy,
        updatedAt: now,
      },
    };

    return new Encounter(props);
  }

  /**
   * Reconstitute encounter from persistence
   */
  static reconstitute(props: EncounterProps): Encounter {
    return new Encounter(props);
  }

  // ==========================================================================
  // Getters (Read-only access to aggregate state)
  // ==========================================================================

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get encounterType(): EncounterType {
    return this.props.encounterType;
  }

  get encounterClass(): EncounterClass {
    return this.props.encounterClass;
  }

  get status(): EncounterStatus {
    return this.props.status;
  }

  get period(): Readonly<EncounterPeriod> {
    return this.props.period;
  }

  get serviceProviderId(): string | undefined {
    return this.props.serviceProviderId;
  }

  get departmentId(): string | undefined {
    return this.props.departmentId;
  }

  get locationId(): string | undefined {
    return this.props.locationId;
  }

  get reasonCode(): ReadonlyArray<string> {
    return this.props.reasonCode;
  }

  get diagnosis(): ReadonlyArray<Diagnosis> {
    return this.props.diagnosis;
  }

  get parentEncounterId(): string | undefined {
    return this.props.parentEncounterId;
  }

  get metadata(): Readonly<Record<string, unknown>> {
    return this.props.metadata;
  }

  get provenance(): Readonly<EncounterProvenance> {
    return this.props.provenance;
  }

  get isFinished(): boolean {
    return this.props.status === 'finished' || this.props.status === 'cancelled';
  }

  get isEmergency(): boolean {
    return this.props.encounterClass === 'EMER';
  }

  // ==========================================================================
  // State Machine - Lifecycle Transitions
  // ==========================================================================

  /**
   * Patient arrives for encounter
   * Valid transitions: planned → arrived
   */
  arrive(userId: string): void {
    this.assertNotFinished();
    this.assertCanTransition('arrived');

    this.props.status = 'arrived';
    this.updateProvenance(userId);
  }

  /**
   * Emergency triage complete
   * Valid transitions: arrived → triaged (emergency only)
   */
  triage(userId: string): void {
    this.assertNotFinished();
    
    if (!this.isEmergency) {
      throw new EncounterDomainError(
        'Cannot triage non-emergency encounter',
        'INVALID_TRIAGE',
        { encounterClass: this.props.encounterClass }
      );
    }

    this.assertCanTransition('triaged');

    this.props.status = 'triaged';
    this.updateProvenance(userId);
  }

  /**
   * Start encounter (clinical activities begin)
   * Valid transitions: arrived → in-progress, triaged → in-progress
   */
  start(userId: string): void {
    this.assertNotFinished();
    this.assertCanTransition('in-progress');

    this.props.status = 'in-progress';
    this.updateProvenance(userId);
  }

  /**
   * Put encounter on hold (temporarily paused)
   * Valid transitions: in-progress → on-hold
   */
  hold(userId: string, reason?: string): void {
    this.assertNotFinished();
    this.assertCanTransition('on-hold');

    this.props.status = 'on-hold';
    if (reason) {
      this.props.metadata.holdReason = reason;
    }
    this.updateProvenance(userId);
  }

  /**
   * Resume encounter from hold
   * Valid transitions: on-hold → in-progress
   */
  resume(userId: string): void {
    this.assertNotFinished();
    this.assertCanTransition('in-progress');

    this.props.status = 'in-progress';
    delete this.props.metadata.holdReason;
    this.updateProvenance(userId);
  }

  /**
   * Finish encounter (clinical activities complete)
   * Valid transitions: in-progress → finished, on-hold → finished
   */
  finish(userId: string, endDateTime?: Date): void {
    this.assertNotFinished();
    this.assertCanTransition('finished');

    const end = endDateTime || new Date();

    // Validate end >= start
    if (end < this.props.period.start) {
      throw new InvalidPeriodError(
        'End time cannot be before start time',
        { start: this.props.period.start, end }
      );
    }

    this.props.status = 'finished';
    this.props.period.end = end;
    this.updateProvenance(userId);
  }

  /**
   * Cancel encounter
   * Valid transitions: planned → cancelled, arrived → cancelled, in-progress → cancelled, on-hold → cancelled
   * Cannot cancel: finished, already cancelled
   */
  cancel(userId: string, reason: string): void {
    this.assertNotFinished();
    this.assertCanTransition('cancelled');

    if (!reason || reason.trim().length === 0) {
      throw new MissingRequiredFieldError('cancellation reason');
    }

    this.props.status = 'cancelled';
    this.props.period.end = new Date();
    this.props.metadata.cancellationReason = reason;
    this.updateProvenance(userId);
  }

  // ==========================================================================
  // Business Operations
  // ==========================================================================

  /**
   * Add diagnosis to encounter
   */
  addDiagnosis(diagnosis: Diagnosis, userId: string): void {
    this.assertNotFinished();

    // Validate ICD-10 code format (basic validation)
    if (!diagnosis.code || !this.isValidICD10Code(diagnosis.code)) {
      throw new EncounterDomainError(
        'Invalid ICD-10 code format',
        'INVALID_ICD10_CODE',
        { code: diagnosis.code }
      );
    }

    // Ensure only one primary diagnosis
    if (diagnosis.type === 'primary') {
      const existingPrimary = this.props.diagnosis.find(d => d.type === 'primary');
      if (existingPrimary) {
        throw new EncounterDomainError(
          'Encounter already has a primary diagnosis',
          'DUPLICATE_PRIMARY_DIAGNOSIS',
          { existing: existingPrimary.code, new: diagnosis.code }
        );
      }
    }

    // Prevent duplicate diagnosis codes
    const duplicate = this.props.diagnosis.find(d => d.code === diagnosis.code);
    if (duplicate) {
      throw new EncounterDomainError(
        'Diagnosis code already exists',
        'DUPLICATE_DIAGNOSIS',
        { code: diagnosis.code }
      );
    }

    this.props.diagnosis.push({
      ...diagnosis,
      recordedDate: new Date().toISOString(),
    });
    this.updateProvenance(userId);
  }

  /**
   * Assign service provider (doctor/practitioner)
   */
  assignProvider(serviceProviderId: string, userId: string): void {
    this.assertNotFinished();

    if (!serviceProviderId || serviceProviderId.trim().length === 0) {
      throw new MissingRequiredFieldError('serviceProviderId');
    }

    this.props.serviceProviderId = serviceProviderId;
    this.updateProvenance(userId);
  }

  /**
   * Transfer encounter to different department/location
   */
  transfer(departmentId: string, locationId: string, userId: string): void {
    this.assertNotFinished();

    if (this.props.status !== 'in-progress') {
      throw new EncounterDomainError(
        'Can only transfer in-progress encounters',
        'INVALID_TRANSFER',
        { currentStatus: this.props.status }
      );
    }

    if (!departmentId || departmentId.trim().length === 0) {
      throw new MissingRequiredFieldError('departmentId');
    }

    if (!locationId || locationId.trim().length === 0) {
      throw new MissingRequiredFieldError('locationId');
    }

    this.props.departmentId = departmentId;
    this.props.locationId = locationId;
    this.props.metadata.transferredAt = new Date().toISOString();
    this.updateProvenance(userId);
  }

  /**
   * Validate tenant boundary (ensure no cross-tenant operations)
   */
  assertTenantMatch(tenantId: string): void {
    if (this.props.tenantId !== tenantId) {
      throw new TenantBoundaryViolationError(
        `Encounter belongs to tenant ${this.props.tenantId}, cannot access from tenant ${tenantId}`
      );
    }
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert aggregate to plain object for persistence
   */
  toProps(): EncounterProps {
    return {
      ...this.props,
      period: { ...this.props.period },
      reasonCode: [...this.props.reasonCode],
      diagnosis: [...this.props.diagnosis],
      metadata: { ...this.props.metadata },
      provenance: { ...this.props.provenance },
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private validate(): void {
    if (!this.props.id || this.props.id.trim().length === 0) {
      throw new MissingRequiredFieldError('id');
    }
    if (!this.props.tenantId || this.props.tenantId.trim().length === 0) {
      throw new MissingRequiredFieldError('tenantId');
    }
    if (!this.props.patientId || this.props.patientId.trim().length === 0) {
      throw new MissingRequiredFieldError('patientId');
    }
    if (!this.props.period.start) {
      throw new MissingRequiredFieldError('period.start');
    }
  }

  private assertNotFinished(): void {
    if (this.isFinished) {
      throw new EncounterAlreadyFinishedError(this.props.id);
    }
  }

  private assertCanTransition(to: EncounterStatus): void {
    const validTransitions = this.getValidTransitions();
    
    if (!validTransitions.includes(to)) {
      throw new InvalidStateTransitionError(this.props.status, to);
    }
  }

  private getValidTransitions(): EncounterStatus[] {
    const transitions: Record<EncounterStatus, EncounterStatus[]> = {
      'planned': ['arrived', 'cancelled'],
      'arrived': ['triaged', 'in-progress', 'cancelled'],
      'triaged': ['in-progress', 'cancelled'],
      'in-progress': ['on-hold', 'finished', 'cancelled'],
      'on-hold': ['in-progress', 'finished', 'cancelled'],
      'finished': [], // Terminal state
      'cancelled': [], // Terminal state
    };

    return transitions[this.props.status] || [];
  }

  private updateProvenance(userId: string): void {
    this.props.provenance.updatedBy = userId;
    this.props.provenance.updatedAt = new Date();
  }

  private isValidICD10Code(code: string): boolean {
    // Basic ICD-10 validation: starts with letter, followed by 2+ digits
    // Full validation would require lookup in ICD-10 database
    const icd10Pattern = /^[A-Z]\d{2}(\.\d{1,4})?$/;
    return icd10Pattern.test(code);
  }
}
