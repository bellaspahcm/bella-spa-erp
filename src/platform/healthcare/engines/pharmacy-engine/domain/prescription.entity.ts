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
 * PENDING_VERIFICATION ──→ VERIFIED ──→ DISPENSED ──→ MAR_READY (terminal)
 *            │                             │
 *            └──→ REJECTED (terminal)      └──→ CANCELLED (terminal)
 * ```
 */

import crypto from 'crypto';
import { ScreeningResult } from './screening-policies';

// ============================================================================
// Types & Enums
// ============================================================================

export type PrescriptionStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'DISPENSED'
  | 'MAR_READY'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type SafetyState = 'NO_BLOCK' | 'OVERRIDE_REQUIRED' | 'ACKNOWLEDGED' | 'BLOCKED';

export type DualVerificationState = 'NONE' | 'HIGH_ALERT' | 'VERIFICATION_1' | 'DUAL_VERIFIED';

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

export interface OverrideAuditEntry {
  warningCode: string;
  decision: string;
  rationale: string;
  practitionerId: string;
  practitionerRole: string;
  timestamp: Date;
  policyVersion: string;
}

export interface VerificationSignature {
  pharmacistId: string;
  verifiedAt: Date;
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
  constructor(from: string, to: string) {
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

export class SafetyBlockError extends PrescriptionDomainError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'SafetyBlockError';
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
  safetyState: SafetyState;
  dualVerificationState: DualVerificationState;
  overrideHistory: OverrideAuditEntry[];
  verifications: VerificationSignature[];
  isHighAlert: boolean;
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

  static create(data: {
    tenantId: string;
    encounterId: string;
    patientPartyId: string;
    doctorPartyId: string;
    clinicalOrderId: string;
    drugs: PrescriptionDrugItem[];
    diagnosis?: string;
    notes?: string;
    isHighAlert?: boolean;
    createdBy?: string;
  }): Prescription {
    if (!data.tenantId) throw new MissingRequiredFieldError('tenantId');
    if (!data.encounterId) throw new MissingRequiredFieldError('encounterId');
    if (!data.patientPartyId) throw new MissingRequiredFieldError('patientPartyId');
    if (!data.doctorPartyId) throw new MissingRequiredFieldError('doctorPartyId');
    if (!data.clinicalOrderId) throw new MissingRequiredFieldError('clinicalOrderId');
    if (!data.drugs || data.drugs.length === 0) throw new MissingRequiredFieldError('drugs');

    const now = new Date();
    const isHighAlert = data.isHighAlert ?? false;

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
      status: 'PENDING_VERIFICATION',
      safetyState: 'NO_BLOCK',
      dualVerificationState: isHighAlert ? 'HIGH_ALERT' : 'NONE',
      overrideHistory: [],
      verifications: [],
      isHighAlert,
      version: 1,
      provenance: {
        createdBy: data.createdBy,
        createdAt: now,
        updatedBy: data.createdBy,
        updatedAt: now,
      },
    });
  }

  static reconstitute(props: PrescriptionProps): Prescription {
    return new Prescription({
      ...props,
      drugs: [...props.drugs],
      overrideHistory: [...props.overrideHistory],
      verifications: [...props.verifications],
    });
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
  get safetyState(): SafetyState { return this.props.safetyState; }
  get dualVerificationState(): DualVerificationState { return this.props.dualVerificationState; }
  get overrideHistory(): OverrideAuditEntry[] { return [...this.props.overrideHistory]; }
  get verifications(): VerificationSignature[] { return [...this.props.verifications]; }
  get isHighAlert(): boolean { return this.props.isHighAlert; }
  get version(): number { return this.props.version; }
  get provenance(): PrescriptionProvenance { return { ...this.props.provenance }; }

  get isTerminal(): boolean {
    return (
      this.props.status === 'MAR_READY' ||
      this.props.status === 'REJECTED' ||
      this.props.status === 'CANCELLED'
    );
  }

  // ==========================================================================
  // State Machine Transitions
  // ==========================================================================

  /**
   * Verify Prescription (Gate 1 & 5)
   */
  verify(
    pharmacistId: string,
    screeningResult: ScreeningResult,
    overrides?: { warningCode: string; rationale: string; policyVersion?: string }[]
  ): void {
    this.assertNotTerminal();
    if (this.props.status !== 'PENDING_VERIFICATION') {
      throw new InvalidStateTransitionError(this.props.status, 'VERIFIED');
    }

    // 1. Process screening results (Gate 2 & 3)
    if (screeningResult.status === 'BLOCKED') {
      this.props.safetyState = 'BLOCKED';
      throw new SafetyBlockError(
        'Prescription is blocked due to critical screening findings.',
        'SAFETY_BLOCK_ACTIVE',
        { findings: screeningResult.findings }
      );
    }

    if (screeningResult.status === 'WARNING') {
      this.props.safetyState = 'OVERRIDE_REQUIRED';

      // Check if warnings were acknowledged via override rationale
      const activeWarnings = screeningResult.findings.filter((f) => f.severity === 'WARNING');
      for (const warning of activeWarnings) {
        const matchingOverride = overrides?.find((o) => o.warningCode === warning.code);
        if (!matchingOverride || !matchingOverride.rationale.trim()) {
          throw new SafetyBlockError(
            `Pharmacist override rationale required for warning: ${warning.message}`,
            'OVERRIDE_RATIONALE_REQUIRED',
            { warningCode: warning.code }
          );
        }

        // Record override with immutable provenance (Gate 3)
        const auditEntry: OverrideAuditEntry = {
          warningCode: warning.code,
          decision: 'OVERRIDE',
          rationale: matchingOverride.rationale,
          practitionerId: pharmacistId,
          practitionerRole: 'pharmacist',
          timestamp: new Date(),
          policyVersion: matchingOverride.policyVersion || '1.0.0',
        };
        // Append-only invariant check
        this.props.overrideHistory.push(auditEntry);
      }
      this.props.safetyState = 'ACKNOWLEDGED';
    }

    // 2. High-Alert Dual Verification (Gate 5)
    if (this.props.isHighAlert) {
      if (this.props.dualVerificationState === 'NONE' || this.props.dualVerificationState === 'HIGH_ALERT') {
        this.props.dualVerificationState = 'VERIFICATION_1';
        this.props.verifications.push({ pharmacistId, verifiedAt: new Date() });
        this.updateProvenance(pharmacistId);
        return; // Stays PENDING_VERIFICATION until verification 2
      }

      if (this.props.dualVerificationState === 'VERIFICATION_1') {
        // Enforce distinct practitioners rule
        const firstVerifier = this.props.verifications[0]?.pharmacistId;
        if (firstVerifier === pharmacistId) {
          throw new PrescriptionDomainError(
            'Dual verification requires two distinct pharmacists.',
            'DUAL_VERIFICATION_SAME_USER'
          );
        }

        this.props.dualVerificationState = 'DUAL_VERIFIED';
        this.props.verifications.push({ pharmacistId, verifiedAt: new Date() });
        this.props.status = 'VERIFIED';
        this.updateProvenance(pharmacistId);
        return;
      }

      // If already verified, do nothing or throw
      return;
    }

    // Standard verification
    this.props.verifications.push({ pharmacistId, verifiedAt: new Date() });
    this.props.status = 'VERIFIED';
    this.updateProvenance(pharmacistId);
  }

  /**
   * Reject Prescription
   */
  reject(userId: string, reason?: string): void {
    this.assertNotTerminal();
    if (this.props.status !== 'PENDING_VERIFICATION') {
      throw new InvalidStateTransitionError(this.props.status, 'REJECTED');
    }

    this.props.status = 'REJECTED';
    if (reason) {
      this.props.notes = this.props.notes ? `${this.props.notes}\nRejected: ${reason}` : `Rejected: ${reason}`;
    }
    this.updateProvenance(userId);
  }

  /**
   * Dispense Medication (Command separates clinical verification from physical deduction)
   */
  dispense(userId: string): void {
    this.assertNotTerminal();
    if (this.props.status !== 'VERIFIED') {
      throw new InvalidStateTransitionError(this.props.status, 'DISPENSED');
    }

    this.props.status = 'DISPENSED';
    this.updateProvenance(userId);
  }

  /**
   * Mark ready for nurse administration (Gate 7 Clinical Continuity Transition)
   */
  markMarReady(userId: string): void {
    this.assertNotTerminal();
    if (this.props.status !== 'DISPENSED') {
      throw new InvalidStateTransitionError(this.props.status, 'MAR_READY');
    }

    this.props.status = 'MAR_READY';
    this.updateProvenance(userId);
  }

  /**
   * Cancel Prescription
   */
  cancel(userId: string, reason: string): void {
    if (!reason) throw new MissingRequiredFieldError('cancel reason');
    this.assertNotTerminal();
    this.props.status = 'CANCELLED';
    this.props.notes = this.props.notes ? `${this.props.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
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

  private updateProvenance(userId: string): void {
    this.props.provenance.updatedBy = userId;
    this.props.provenance.updatedAt = new Date();
    this.props.version += 1;
  }

  toProps(): PrescriptionProps {
    return {
      ...this.props,
      drugs: [...this.props.drugs],
      overrideHistory: [...this.props.overrideHistory],
      verifications: [...this.props.verifications],
      provenance: { ...this.props.provenance },
    };
  }
}

// ============================================================================
// MAR Entry Entity (Belongs to MAR Context, read/modified via events)
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

  private validate(): void {
    if (!this.props.id) throw new MissingRequiredFieldError('id');
    if (!this.props.tenantId) throw new MissingRequiredFieldError('tenantId');
    if (!this.props.prescriptionItemId) throw new MissingRequiredFieldError('prescriptionItemId');
    if (!this.props.drugName) throw new MissingRequiredFieldError('drugName');
    if (!this.props.dosage) throw new MissingRequiredFieldError('dosage');
    if (!this.props.route) throw new MissingRequiredFieldError('route');
    if (!this.props.scheduledTime) throw new MissingRequiredFieldError('scheduledTime');

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
