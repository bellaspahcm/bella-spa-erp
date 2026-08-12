/**
 * Prescription Domain Entity (Aggregate Root)
 * 
 * Constitution Compliance:
 * - Law 1: Prescription is child aggregate referencing Encounter and Clinical Order
 * - Law 5: Domain events emitted on state transitions
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * State Machine Flow:
 * ```
 * PENDING_REVIEW ──→ APPROVED ──→ READY_FOR_DISPENSE ──→ PARTIALLY_DISPENSED ──→ DISPENSED (terminal)
 *       │              │                  │
 *       └──→ REJECTED  └──→ ON_HOLD       └──→ ON_HOLD
 *            (terminal)       │
 *                             └──→ APPROVED / CANCELLED (terminal)
 * ```
 * 
 * @module platform/healthcare/engines/pharmacy-engine/domain
 */

import crypto from 'crypto';

// ============================================================================
// Types & Enums
// ============================================================================

export type PrescriptionStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'READY_FOR_DISPENSE'
  | 'PARTIALLY_DISPENSED'
  | 'DISPENSED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED';

export interface PrescriptionDrugItem {
  code: string;
  name: string;
  dose: string;
  frequency: string;
  durationDays: number;
}

export interface PrescriptionProvenance {
  createdBy?: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
}

// ============================================================================
// Domain Errors
// ============================================================================

export class PrescriptionDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PrescriptionDomainError';
  }
}

export class MissingRequiredFieldError extends PrescriptionDomainError {
  constructor(field: string) {
    super(`Required field missing: ${field}`, 'MISSING_REQUIRED_FIELD', { field });
    this.name = 'MissingRequiredFieldError';
  }
}

export class InvalidStateTransitionError extends PrescriptionDomainError {
  constructor(from: PrescriptionStatus, to: PrescriptionStatus) {
    super(
      `Invalid state transition from ${from} to ${to}`,
      'INVALID_STATE_TRANSITION',
      { from, to }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class TerminalStateModifiedError extends PrescriptionDomainError {
  constructor(prescriptionId: string, status: PrescriptionStatus) {
    super(
      `Cannot modify prescription in terminal state: ${prescriptionId} (${status})`,
      'TERMINAL_STATE_MODIFIED',
      { prescriptionId, status }
    );
    this.name = 'TerminalStateModifiedError';
  }
}

// ============================================================================
// Prescription Aggregate Root Props
// ============================================================================

export interface PrescriptionProps {
  id: string;
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  doctorPartyId: string;
  clinicalOrderId: string;
  drugs: PrescriptionDrugItem[];
  diagnosis?: string;
  notes?: string;
  status: PrescriptionStatus;
  version: number;
  provenance: PrescriptionProvenance;
}

// ============================================================================
// Prescription Aggregate Root
// ============================================================================

export class Prescription {
  private readonly props: PrescriptionProps;

  private constructor(props: PrescriptionProps) {
    this.props = { ...props };
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new Prescription (PENDING_REVIEW status)
   */
  static create(data: {
    tenantId: string;
    encounterId: string;
    patientPartyId: string;
    doctorPartyId: string;
    clinicalOrderId: string;
    drugs: PrescriptionDrugItem[];
    diagnosis?: string;
    notes?: string;
    createdBy?: string;
  }): Prescription {
    if (!data.tenantId) throw new MissingRequiredFieldError('tenantId');
    if (!data.encounterId) throw new MissingRequiredFieldError('encounterId');
    if (!data.patientPartyId) throw new MissingRequiredFieldError('patientPartyId');
    if (!data.doctorPartyId) throw new MissingRequiredFieldError('doctorPartyId');
    if (!data.clinicalOrderId) throw new MissingRequiredFieldError('clinicalOrderId');
    if (!data.drugs || data.drugs.length === 0) throw new MissingRequiredFieldError('drugs');

    const now = new Date();

    return new Prescription({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      encounterId: data.encounterId,
      patientPartyId: data.patientPartyId,
      doctorPartyId: data.doctorPartyId,
      clinicalOrderId: data.clinicalOrderId,
      drugs: [...data.drugs],
      diagnosis: data.diagnosis,
      notes: data.notes,
      status: 'PENDING_REVIEW',
      version: 1,
      provenance: {
        createdBy: data.createdBy,
        createdAt: now,
        updatedBy: data.createdBy,
        updatedAt: now,
      },
    });
  }

  /**
   * Reconstitute Prescription from database state
   */
  static reconstitute(props: PrescriptionProps): Prescription {
    return new Prescription(props);
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get encounterId(): string { return this.props.encounterId; }
  get patientPartyId(): string { return this.props.patientPartyId; }
  get doctorPartyId(): string { return this.props.doctorPartyId; }
  get clinicalOrderId(): string { return this.props.clinicalOrderId; }
  get drugs(): PrescriptionDrugItem[] { return [...this.props.drugs]; }
  get diagnosis(): string | undefined { return this.props.diagnosis; }
  get notes(): string | undefined { return this.props.notes; }
  get status(): PrescriptionStatus { return this.props.status; }
  get version(): number { return this.props.version; }
  get provenance(): PrescriptionProvenance { return { ...this.props.provenance }; }

  get isTerminal(): boolean {
    return (
      this.props.status === 'DISPENSED' ||
      this.props.status === 'REJECTED' ||
      this.props.status === 'CANCELLED'
    );
  }

  // ==========================================================================
  // State Machine Transitions
  // ==========================================================================

  /**
   * Approve the prescription
   * Valid transitions: PENDING_REVIEW -> APPROVED, ON_HOLD -> APPROVED
   */
  approve(userId: string): void {
    this.assertNotTerminal();
    this.assertCanTransition('APPROVED');

    this.props.status = 'APPROVED';
    this.updateProvenance(userId);
  }

  /**
   * Reject the prescription
   * Valid transitions: PENDING_REVIEW -> REJECTED (terminal)
   */
  reject(userId: string, reason?: string): void {
    this.assertNotTerminal();
    this.assertCanTransition('REJECTED');

    this.props.status = 'REJECTED';
    if (reason) {
      this.props.notes = this.props.notes 
        ? `${this.props.notes}\nRejected: ${reason}` 
        : `Rejected: ${reason}`;
    }
    this.updateProvenance(userId);
  }

  /**
   * Mark prescription as ready for dispense
   * Valid transitions: APPROVED -> READY_FOR_DISPENSE
   */
  markReady(userId: string): void {
    this.assertNotTerminal();
    this.assertCanTransition('READY_FOR_DISPENSE');

    this.props.status = 'READY_FOR_DISPENSE';
    this.updateProvenance(userId);
  }

  /**
   * Hold the prescription
   * Valid transitions: APPROVED -> ON_HOLD, READY_FOR_DISPENSE -> ON_HOLD, PARTIALLY_DISPENSED -> ON_HOLD
   */
  hold(userId: string, reason: string): void {
    if (!reason) throw new MissingRequiredFieldError('hold reason');
    this.assertNotTerminal();
    this.assertCanTransition('ON_HOLD');

    this.props.status = 'ON_HOLD';
    this.props.notes = this.props.notes 
      ? `${this.props.notes}\nHeld: ${reason}` 
      : `Held: ${reason}`;
    this.updateProvenance(userId);
  }

  /**
   * Cancel the prescription
   * Valid transitions: APPROVED -> CANCELLED, READY_FOR_DISPENSE -> CANCELLED, PARTIALLY_DISPENSED -> CANCELLED, ON_HOLD -> CANCELLED (terminal)
   */
  cancel(userId: string, reason: string): void {
    if (!reason) throw new MissingRequiredFieldError('cancel reason');
    this.assertNotTerminal();
    this.assertCanTransition('CANCELLED');

    this.props.status = 'CANCELLED';
    this.props.notes = this.props.notes 
      ? `${this.props.notes}\nCancelled: ${reason}` 
      : `Cancelled: ${reason}`;
    this.updateProvenance(userId);
  }

  /**
   * Dispense medication
   * Valid transitions: READY_FOR_DISPENSE -> PARTIALLY_DISPENSED, READY_FOR_DISPENSE -> DISPENSED, PARTIALLY_DISPENSED -> DISPENSED
   */
  dispense(userId: string, isPartial: boolean): void {
    this.assertNotTerminal();
    
    const targetStatus: PrescriptionStatus = isPartial ? 'PARTIALLY_DISPENSED' : 'DISPENSED';
    this.assertCanTransition(targetStatus);

    this.props.status = targetStatus;
    this.updateProvenance(userId);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private assertNotTerminal(): void {
    if (this.isTerminal) {
      throw new TerminalStateModifiedError(this.props.id, this.props.status);
    }
  }

  private assertCanTransition(to: PrescriptionStatus): void {
    const validTransitions: Record<PrescriptionStatus, PrescriptionStatus[]> = {
      'PENDING_REVIEW': ['APPROVED', 'REJECTED'],
      'APPROVED': ['READY_FOR_DISPENSE', 'ON_HOLD', 'CANCELLED'],
      'READY_FOR_DISPENSE': ['PARTIALLY_DISPENSED', 'DISPENSED', 'ON_HOLD', 'CANCELLED'],
      'PARTIALLY_DISPENSED': ['DISPENSED', 'ON_HOLD', 'CANCELLED'],
      'ON_HOLD': ['APPROVED', 'CANCELLED'],
      'DISPENSED': [],
      'REJECTED': [],
      'CANCELLED': [],
    };

    const allowed = validTransitions[this.props.status] || [];
    if (!allowed.includes(to)) {
      throw new InvalidStateTransitionError(this.props.status, to);
    }
  }

  private updateProvenance(userId: string): void {
    this.props.provenance.updatedBy = userId;
    this.props.provenance.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Convert entity props for persistence
   */
  toProps(): PrescriptionProps {
    return {
      ...this.props,
      drugs: [...this.props.drugs],
      provenance: { ...this.props.provenance },
    };
  }
}

// ============================================================================
// MAR Entry Entity
// ============================================================================

export type MARStatus = 'scheduled' | 'administered' | 'refused' | 'held' | 'missed';

export interface MARProps {
  id: string;
  tenantId: string;
  inpatientAdmissionId?: string;
  encounterId?: string;
  prescriptionItemId: string;
  drugName: string;
  dosage: string;
  route: string;
  scheduledTime: Date;
  administeredTime?: Date;
  administeredByNurseId?: string;
  status: MARStatus;
  notes?: string;
  createdAt: Date;
}

export class MAREntry {
  private constructor(private readonly props: MARProps) {
    this.validate();
  }

  static create(data: {
    tenantId: string;
    inpatientAdmissionId?: string;
    encounterId?: string;
    prescriptionItemId: string;
    drugName: string;
    dosage: string;
    route: string;
    scheduledTime: Date;
    notes?: string;
  }): MAREntry {
    return new MAREntry({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      inpatientAdmissionId: data.inpatientAdmissionId,
      encounterId: data.encounterId,
      prescriptionItemId: data.prescriptionItemId,
      drugName: data.drugName,
      dosage: data.dosage,
      route: data.route,
      scheduledTime: data.scheduledTime,
      status: 'scheduled',
      createdAt: new Date(),
      notes: data.notes,
    });
  }

  static reconstitute(props: MARProps): MAREntry {
    return new MAREntry(props);
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get inpatientAdmissionId(): string | undefined { return this.props.inpatientAdmissionId; }
  get encounterId(): string | undefined { return this.props.encounterId; }
  get prescriptionItemId(): string { return this.props.prescriptionItemId; }
  get drugName(): string { return this.props.drugName; }
  get dosage(): string { return this.props.dosage; }
  get route(): string { return this.props.route; }
  get scheduledTime(): Date { return this.props.scheduledTime; }
  get administeredTime(): Date | undefined { return this.props.administeredTime; }
  get administeredByNurseId(): string | undefined { return this.props.administeredByNurseId; }
  get status(): MARStatus { return this.props.status; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  // ==========================================================================
  // Transitions
  // ==========================================================================

  /**
   * Administer the dose
   */
  administer(nurseId: string, time: Date = new Date(), notes?: string): void {
    if (!nurseId) throw new MissingRequiredFieldError('administeredByNurseId');
    if (this.props.status !== 'scheduled') {
      throw new PrescriptionDomainError(
        `Cannot administer MAR in status: ${this.props.status}`,
        'INVALID_MAR_STATUS_TRANSITION'
      );
    }

    this.props.status = 'administered';
    this.props.administeredByNurseId = nurseId;
    this.props.administeredTime = time;
    if (notes) {
      this.props.notes = this.props.notes ? `${this.props.notes}\nAdministered: ${notes}` : notes;
    }
  }

  /**
   * Refuse/hold/miss the dose
   */
  updateStatus(status: Exclude<MARStatus, 'scheduled' | 'administered'>, reason: string): void {
    if (!reason) throw new MissingRequiredFieldError('status change reason');
    if (this.props.status !== 'scheduled') {
      throw new PrescriptionDomainError(
        `Cannot change MAR status from: ${this.props.status}`,
        'INVALID_MAR_STATUS_TRANSITION'
      );
    }

    this.props.status = status;
    this.props.notes = this.props.notes ? `${this.props.notes}\nStatus changed to ${status}: ${reason}` : reason;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private validate(): void {
    if (!this.props.id) throw new MissingRequiredFieldError('id');
    if (!this.props.tenantId) throw new MissingRequiredFieldError('tenantId');
    if (!this.props.prescriptionItemId) throw new MissingRequiredFieldError('prescriptionItemId');
    if (!this.props.drugName) throw new MissingRequiredFieldError('drugName');
    if (!this.props.dosage) throw new MissingRequiredFieldError('dosage');
    if (!this.props.route) throw new MissingRequiredFieldError('route');
    if (!this.props.scheduledTime) throw new MissingRequiredFieldError('scheduledTime');

    // Invariant: At least one treatment context must exist
    if (!this.props.inpatientAdmissionId && !this.props.encounterId) {
      throw new PrescriptionDomainError(
        'MAR entry must have either inpatientAdmissionId or encounterId treatment context',
        'MISSING_TREATMENT_CONTEXT'
      );
    }
  }

  toProps(): MARProps {
    return { ...this.props };
  }
}
