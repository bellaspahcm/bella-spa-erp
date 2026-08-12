/**
 * Blood Crossmatch Domain Entity (Aggregate Root)
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

export type CrossmatchStatus =
  | 'REQUESTED'
  | 'SAMPLE_VERIFIED'
  | 'TESTED'
  | 'COMPATIBLE'
  | 'INCOMPATIBLE'
  | 'APPROVED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface EmergencyOverride {
  readonly authorizedBy: string;
  readonly practitionerRole: string;
  readonly reason: string;
  readonly timestamp: string;
  readonly policyVersion: string;
}

export class CrossmatchDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CrossmatchDomainError';
  }
}

export class InvalidCrossmatchStateTransitionError extends CrossmatchDomainError {
  constructor(from: CrossmatchStatus, to: CrossmatchStatus) {
    super(
      `Invalid crossmatch state transition from ${from} to ${to}`,
      'INVALID_STATE_TRANSITION'
    );
  }
}

export class CrossmatchIncompatibleError extends CrossmatchDomainError {
  constructor() {
    super(
      'Cannot approve incompatible crossmatch without authorized emergency override',
      'CROSSMATCH_INCOMPATIBLE'
    );
  }
}

export class CrossmatchAlreadyProcessedError extends CrossmatchDomainError {
  constructor(status: CrossmatchStatus) {
    super(
      `Crossmatch has already been processed: current status is ${status}`,
      'CROSSMATCH_ALREADY_PROCESSED'
    );
  }
}

export class BloodCrossmatch {
  private _status: CrossmatchStatus;
  private _crossmatchedBy: string | null = null;
  private _crossmatchedAt: string | null = null;
  private _approvedBy: string | null = null;
  private _approvedAt: string | null = null;
  private _emergencyOverride: EmergencyOverride | null = null;

  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly encounterId: string,
    public readonly bloodUnitId: string,
    initialStatus: CrossmatchStatus = 'REQUESTED',
    public readonly version: number = 1
  ) {
    this._status = initialStatus;
  }

  get status(): CrossmatchStatus {
    return this._status;
  }

  get crossmatchedBy(): string | null {
    return this._crossmatchedBy;
  }

  get crossmatchedAt(): string | null {
    return this._crossmatchedAt;
  }

  get approvedBy(): string | null {
    return this._approvedBy;
  }

  get approvedAt(): string | null {
    return this._approvedAt;
  }

  get emergencyOverride(): EmergencyOverride | null {
    return this._emergencyOverride;
  }

  setCrossmatchData(data: {
    crossmatchedBy: string | null;
    crossmatchedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    emergencyOverride: EmergencyOverride | null;
  }): void {
    this._crossmatchedBy = data.crossmatchedBy;
    this._crossmatchedAt = data.crossmatchedAt;
    this._approvedBy = data.approvedBy;
    this._approvedAt = data.approvedAt;
    this._emergencyOverride = data.emergencyOverride;
  }

  recordResult(result: 'COMPATIBLE' | 'INCOMPATIBLE', crossmatchedBy: string): void {
    if (this._status !== 'REQUESTED' && this._status !== 'SAMPLE_VERIFIED') {
      throw new CrossmatchAlreadyProcessedError(this._status);
    }

    const nextStatus: CrossmatchStatus = result === 'COMPATIBLE' ? 'TESTED' : 'INCOMPATIBLE';
    this._status = nextStatus;
    this._crossmatchedBy = crossmatchedBy;
    this._crossmatchedAt = new Date().toISOString();
  }

  approve(approvedBy: string, override?: EmergencyOverride): void {
    if (this._status === 'TESTED') {
      this._status = 'APPROVED';
      this._approvedBy = approvedBy;
      this._approvedAt = new Date().toISOString();
      return;
    }

    if (this._status === 'INCOMPATIBLE') {
      if (!override) {
        throw new CrossmatchIncompatibleError();
      }
      this._emergencyOverride = override;
      this._status = 'APPROVED';
      this._approvedBy = approvedBy;
      this._approvedAt = new Date().toISOString();
      return;
    }

    throw new InvalidCrossmatchStateTransitionError(this._status, 'APPROVED');
  }

  cancel(): void {
    if (this._status === 'APPROVED' || this._status === 'EXPIRED') {
      throw new CrossmatchAlreadyProcessedError(this._status);
    }
    this._status = 'CANCELLED';
  }
}
