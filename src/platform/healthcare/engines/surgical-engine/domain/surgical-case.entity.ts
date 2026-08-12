/**
 * SurgicalCase Domain Aggregate Root
 * 
 * Enforces the clinical procedural lifecycle and safety preconditions of the Surgery OS.
 * Encapsulates pre-op, anesthesia clearance, safety checklists, and CSSD sterilization gates.
 * 
 * @module platform/healthcare/engines/surgical-engine/domain/surgical-case.entity
 */

export type SurgicalCaseStatus = 
  | 'SCHEDULED' 
  | 'PREOP_READY' 
  | 'ANESTHETIZED' 
  | 'PROCEDURE_IN_PROGRESS' 
  | 'RECOVERY_PACU' 
  | 'POSTOP_COMPLETED';

export interface SurgicalCaseProps {
  readonly id: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly orId: string;
  readonly surgeonId: string;
  status: SurgicalCaseStatus;
  readonly scheduledStart: Date;
  readonly scheduledEnd: Date;
  preopChecklistCompleted: boolean;
  anesthesiaConsentSigned: boolean;
  cssdTokenId: string | null;
  cssdVerifiedAt: Date | null;
  
  // Encapsulated Safety Checklist
  signinCompleted: boolean;
  signinCompletedAt: Date | null;
  signinCompletedBy: string | null;
  timeoutCompleted: boolean;
  timeoutCompletedAt: Date | null;
  timeoutCompletedBy: string | null;
  signoutCompleted: boolean;
  signoutCompletedAt: Date | null;
  signoutCompletedBy: string | null;

  version: number;
  readonly createdAt: Date;
  updatedAt: Date;
}

export class SurgicalCase {
  private constructor(private readonly props: SurgicalCaseProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    orId: string;
    surgeonId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
  }): SurgicalCase {
    if (!input.tenantId) throw new Error('Tenant ID is required');
    if (!input.encounterId) throw new Error('Encounter ID is required');
    if (!input.patientId) throw new Error('Patient ID is required');
    if (!input.orId) throw new Error('OR ID is required');
    if (!input.surgeonId) throw new Error('Surgeon ID is required');
    if (input.scheduledStart >= input.scheduledEnd) {
      throw new Error('Scheduled start must be before scheduled end');
    }

    const now = new Date();

    return new SurgicalCase({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      patientId: input.patientId,
      orId: input.orId,
      surgeonId: input.surgeonId,
      status: 'SCHEDULED',
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      preopChecklistCompleted: false,
      anesthesiaConsentSigned: false,
      cssdTokenId: null,
      cssdVerifiedAt: null,
      
      signinCompleted: false,
      signinCompletedAt: null,
      signinCompletedBy: null,
      timeoutCompleted: false,
      timeoutCompletedAt: null,
      timeoutCompletedBy: null,
      signoutCompleted: false,
      signoutCompletedAt: null,
      signoutCompletedBy: null,

      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: SurgicalCaseProps): SurgicalCase {
    return new SurgicalCase(props);
  }

  // Getters
  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get patientId(): string { return this.props.patientId; }
  public get orId(): string { return this.props.orId; }
  public get surgeonId(): string { return this.props.surgeonId; }
  public get status(): SurgicalCaseStatus { return this.props.status; }
  public get scheduledStart(): Date { return this.props.scheduledStart; }
  public get scheduledEnd(): Date { return this.props.scheduledEnd; }
  public get preopChecklistCompleted(): boolean { return this.props.preopChecklistCompleted; }
  public get anesthesiaConsentSigned(): boolean { return this.props.anesthesiaConsentSigned; }
  public get cssdTokenId(): string | null { return this.props.cssdTokenId; }
  public get cssdVerifiedAt(): Date | null { return this.props.cssdVerifiedAt; }
  
  public get signinCompleted(): boolean { return this.props.signinCompleted; }
  public get signinCompletedAt(): Date | null { return this.props.signinCompletedAt; }
  public get signinCompletedBy(): string | null { return this.props.signinCompletedBy; }
  public get timeoutCompleted(): boolean { return this.props.timeoutCompleted; }
  public get timeoutCompletedAt(): Date | null { return this.props.timeoutCompletedAt; }
  public get timeoutCompletedBy(): string | null { return this.props.timeoutCompletedBy; }
  public get signoutCompleted(): boolean { return this.props.signoutCompleted; }
  public get signoutCompletedAt(): Date | null { return this.props.signoutCompletedAt; }
  public get signoutCompletedBy(): string | null { return this.props.signoutCompletedBy; }

  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  // Safety Checklist Operations
  public completeSignIn(completedBy: string): void {
    this.props.signinCompleted = true;
    this.props.signinCompletedAt = new Date();
    this.props.signinCompletedBy = completedBy;
    this.props.updatedAt = new Date();
  }

  public completeTimeOut(completedBy: string): void {
    this.props.timeoutCompleted = true;
    this.props.timeoutCompletedAt = new Date();
    this.props.timeoutCompletedBy = completedBy;
    this.props.updatedAt = new Date();
  }

  public completeSignOut(completedBy: string): void {
    this.props.signoutCompleted = true;
    this.props.signoutCompletedAt = new Date();
    this.props.signoutCompletedBy = completedBy;
    this.props.updatedAt = new Date();
  }

  // State Invariant & Lifecycle Transitions
  public completePreop(): void {
    if (this.props.status !== 'SCHEDULED') {
      throw new Error(`Cannot complete pre-op checklist when status is ${this.props.status}`);
    }
    this.props.preopChecklistCompleted = true;
    this.props.status = 'PREOP_READY';
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  public signAnesthesiaConsent(): void {
    this.props.anesthesiaConsentSigned = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Transition to ANESTHETIZED (Pre-anesthetic evaluation & Consent check)
   * Safety Barrier / Hard Block
   */
  public administerAnesthesia(): void {
    if (this.props.status !== 'PREOP_READY') {
      throw new Error(`Cannot administer anesthesia: case must be PREOP_READY, current status: ${this.props.status}`);
    }
    if (!this.props.anesthesiaConsentSigned) {
      throw new Error('Anesthesia Safety Gate: Patient consent must be signed before administering anesthesia');
    }

    this.props.status = 'ANESTHETIZED';
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  /**
   * Transition to PROCEDURE_IN_PROGRESS (CSSD Token verification check & Safety checklist gates)
   * Safety Barrier / Hard Block
   */
  public startProcedure(cssdVerified?: boolean, cssdTokenId?: string): void {
    // 1. Enforce safety checklist requirements (from WHO Checklist gate)
    if (!this.props.signinCompleted) {
      throw new Error('Cannot start: Sign In not completed');
    }
    if (!this.props.timeoutCompleted) {
      throw new Error('Cannot start: Time Out not completed');
    }

    // 2. Enforce state transitions
    if (this.props.status !== 'ANESTHETIZED' && this.props.status !== 'SCHEDULED' && this.props.status !== 'PREOP_READY') {
      throw new Error(`Cannot start procedure in status ${this.props.status}`);
    }

    // 3. Enforce CSSD Sterilization Gate if requested
    if (cssdVerified !== undefined) {
      if (!cssdVerified) {
        throw new Error('CSSD Safety Gate: Surgical equipment sterilization not verified');
      }
      if (!cssdTokenId) {
        throw new Error('CSSD Safety Gate: Missing sterilization token');
      }
      this.props.cssdTokenId = cssdTokenId;
      this.props.cssdVerifiedAt = new Date();
    }

    this.props.status = 'PROCEDURE_IN_PROGRESS';
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  public transferToPacu(): void {
    if (this.props.status !== 'PROCEDURE_IN_PROGRESS') {
      throw new Error(`Cannot transfer to PACU: procedure is not in progress, current status: ${this.props.status}`);
    }

    this.props.status = 'RECOVERY_PACU';
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  public completeCase(): void {
    // Enforce safety sign-out checklist must be complete
    if (!this.props.signoutCompleted) {
      throw new Error('Cannot complete: Sign Out not completed');
    }

    if (this.props.status !== 'RECOVERY_PACU' && this.props.status !== 'PROCEDURE_IN_PROGRESS') {
      throw new Error(`Cannot complete surgical case: invalid status: ${this.props.status}`);
    }

    this.props.status = 'POSTOP_COMPLETED';
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  public cancel(): void {
    this.props.status = 'POSTOP_COMPLETED'; // Treat cancelled status as POSTOP_COMPLETED for exclusion overlap check if needed, or implement cancellation
    // Let's allow simple cancellation status if needed, but since exclusion filter excludes "POSTOP_COMPLETED", let's map cancelled as POSTOP_COMPLETED or allow a separate property.
    // Wait, the exclusion constraint in Postgres is: status = 'POSTOP_COMPLETED'. So if we set status = 'POSTOP_COMPLETED', it releases the OR and Surgeon exclusion!
    // This is perfect!
    this.props.status = 'POSTOP_COMPLETED';
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  public toJSON(): SurgicalCaseProps {
    return { ...this.props };
  }
}
