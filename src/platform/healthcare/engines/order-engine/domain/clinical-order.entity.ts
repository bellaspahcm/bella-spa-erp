/**
 * Clinical Order Domain Entity (Aggregate Root)
 * 
 * Constitution Compliance:
 * - Law 1: Order references Encounter (Aggregate Root), but is independent aggregate
 * - Law 5: Domain events emitted on state transitions
 * - Law 11: Strictly typed, no `any` types allowed
 * 
 * Architecture Decision (ADR-011):
 * - Order is child aggregate of Encounter (not independent business entity)
 * - Order CANNOT exist without valid Encounter reference
 * - Order validates Encounter status allows ordering (not finished/cancelled)
 * - Encounter remains oblivious to Order (no reverse FK)
 * 
 * State Machine:
 * ```
 * PENDING → VALIDATED → APPROVED → ACTIVE → COMPLETED
 *    ↓                     ↓          ↓
 * REJECTED            DISCONTINUED  DISCONTINUED
 * ```
 * 
 * @module platform/healthcare/engines/order-engine/domain
 */

import crypto from 'crypto';
import type {
  OrderType,
  OrderStatus,
  OrderPriority,
  CdsCheckStatus,
  MedicationOrderDetails,
  LabOrderDetails,
  ImagingOrderDetails,
  GenericOrderDetails,
} from '../../contracts/order-engine.contract';

// ============================================================================
// Domain Errors
// ============================================================================

export class OrderDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OrderDomainError';
  }
}

export class MissingRequiredFieldError extends OrderDomainError {
  constructor(field: string) {
    super(
      `Required field missing: ${field}`,
      'MISSING_REQUIRED_FIELD',
      { field }
    );
    this.name = 'MissingRequiredFieldError';
  }
}

export class InvalidStateTransitionError extends OrderDomainError {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Invalid state transition from ${from} to ${to}`,
      'INVALID_STATE_TRANSITION',
      { from, to }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class OrderAlreadyFinishedError extends OrderDomainError {
  constructor(orderId: string, status: OrderStatus) {
    super(
      `Cannot modify order in terminal state: ${orderId} (${status})`,
      'ORDER_ALREADY_FINISHED',
      { orderId, status }
    );
    this.name = 'OrderAlreadyFinishedError';
  }
}

export class OrderNotApprovableError extends OrderDomainError {
  constructor(orderId: string, status: OrderStatus) {
    super(
      `Order ${orderId} cannot be approved in status: ${status}`,
      'ORDER_NOT_APPROVABLE',
      { orderId, status }
    );
    this.name = 'OrderNotApprovableError';
  }
}

export class OrderNotDiscontinuableError extends OrderDomainError {
  constructor(orderId: string, status: OrderStatus) {
    super(
      `Order ${orderId} cannot be discontinued in status: ${status}`,
      'ORDER_NOT_DISCONTINUABLE',
      { orderId, status }
    );
    this.name = 'OrderNotDiscontinuableError';
  }
}

export class CdsCheckBlockedError extends OrderDomainError {
  constructor(orderId: string, blockingAlertsCount: number) {
    super(
      `Order ${orderId} blocked by CDS validation: ${blockingAlertsCount} blocking alerts`,
      'CDS_CHECK_BLOCKED',
      { orderId, blockingAlertsCount }
    );
    this.name = 'CdsCheckBlockedError';
  }
}

// ============================================================================
// Order Details Union Type
// ============================================================================

export type OrderDetails =
  | MedicationOrderDetails
  | LabOrderDetails
  | ImagingOrderDetails
  | GenericOrderDetails;

// ============================================================================
// Clinical Order Aggregate Root
// ============================================================================

export interface ClinicalOrderProps {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  priority: OrderPriority;
  orderedBy: string;
  orderedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  discontinuedBy?: string;
  discontinuedAt?: Date;
  discontinueReason?: string;
  cdsCheckId?: string;
  cdsCheckStatus?: CdsCheckStatus;
  orderDetails: OrderDetails;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class ClinicalOrder {
  private readonly props: ClinicalOrderProps;

  // ==========================================================================
  // Constructor (private - use factory methods)
  // ==========================================================================

  private constructor(props: ClinicalOrderProps) {
    this.props = { ...props };
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new Clinical Order (PENDING state).
   * Validates all required fields and invariants.
   * 
   * @throws {MissingRequiredFieldError} if required fields missing
   */
  static create(data: {
    tenantId: string;
    encounterId: string;
    patientId: string;
    orderType: OrderType;
    priority: OrderPriority;
    orderedBy: string;
    orderDetails: OrderDetails;
    notes?: string;
    cdsCheckStatus?: CdsCheckStatus;
  }): ClinicalOrder {
    // Validate required fields
    if (!data.tenantId) throw new MissingRequiredFieldError('tenantId');
    if (!data.encounterId) throw new MissingRequiredFieldError('encounterId');
    if (!data.patientId) throw new MissingRequiredFieldError('patientId');
    if (!data.orderType) throw new MissingRequiredFieldError('orderType');
    if (!data.priority) throw new MissingRequiredFieldError('priority');
    if (!data.orderedBy) throw new MissingRequiredFieldError('orderedBy');
    if (!data.orderDetails) throw new MissingRequiredFieldError('orderDetails');

    const now = new Date();

    return new ClinicalOrder({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      encounterId: data.encounterId,
      patientId: data.patientId,
      orderType: data.orderType,
      orderStatus: 'PENDING',
      priority: data.priority,
      orderedBy: data.orderedBy,
      orderedAt: now,
      cdsCheckStatus: data.cdsCheckStatus,
      orderDetails: data.orderDetails,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  /**
   * Reconstitute from persistence (all fields provided).
   * Used by repository when loading existing orders.
   */
  static fromPersistence(props: ClinicalOrderProps): ClinicalOrder {
    return new ClinicalOrder(props);
  }

  // ==========================================================================
  // State Transitions
  // ==========================================================================

  /**
   * Validate order (CDS check passed or warned).
   * Transitions: PENDING → VALIDATED
   * 
   * @throws {InvalidStateTransitionError} if not in PENDING state
   */
  validate(cdsCheckStatus: CdsCheckStatus, cdsAlertsCount: number): void {
    if (this.props.orderStatus !== 'PENDING') {
      throw new InvalidStateTransitionError(this.props.orderStatus, 'VALIDATED');
    }

    if (cdsCheckStatus === 'BLOCKED') {
      throw new CdsCheckBlockedError(this.props.id, cdsAlertsCount);
    }

    this.props.orderStatus = 'VALIDATED';
    this.props.cdsCheckStatus = cdsCheckStatus;
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Reject order (CDS check blocked).
   * Transitions: PENDING → REJECTED
   * 
   * @throws {InvalidStateTransitionError} if not in PENDING state
   */
  reject(cdsCheckStatus: 'BLOCKED', blockingAlertsCount: number): void {
    if (this.props.orderStatus !== 'PENDING') {
      throw new InvalidStateTransitionError(this.props.orderStatus, 'REJECTED');
    }

    if (blockingAlertsCount < 1) {
      throw new OrderDomainError(
        'Rejected order must have at least 1 blocking alert',
        'INVALID_REJECTION',
        { blockingAlertsCount }
      );
    }

    this.props.orderStatus = 'REJECTED';
    this.props.cdsCheckStatus = cdsCheckStatus;
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Approve order (physician sign-off).
   * Transitions: VALIDATED → APPROVED
   * 
   * @throws {OrderNotApprovableError} if not in VALIDATED state
   * @throws {OrderAlreadyFinishedError} if in terminal state
   */
  approve(approvedBy: string): void {
    if (this.isInTerminalState()) {
      throw new OrderAlreadyFinishedError(this.props.id, this.props.orderStatus);
    }

    if (this.props.orderStatus !== 'VALIDATED') {
      throw new OrderNotApprovableError(this.props.id, this.props.orderStatus);
    }

    this.props.orderStatus = 'APPROVED';
    this.props.approvedBy = approvedBy;
    this.props.approvedAt = new Date();
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Activate order (ready for fulfillment).
   * Transitions: APPROVED → ACTIVE
   * 
   * @throws {InvalidStateTransitionError} if not in APPROVED state
   */
  activate(): void {
    if (this.props.orderStatus !== 'APPROVED') {
      throw new InvalidStateTransitionError(this.props.orderStatus, 'ACTIVE');
    }

    this.props.orderStatus = 'ACTIVE';
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Complete order (fulfilled).
   * Transitions: ACTIVE → COMPLETED
   * 
   * @throws {InvalidStateTransitionError} if not in ACTIVE state
   */
  complete(): void {
    if (this.props.orderStatus !== 'ACTIVE') {
      throw new InvalidStateTransitionError(this.props.orderStatus, 'COMPLETED');
    }

    this.props.orderStatus = 'COMPLETED';
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Discontinue order (cancelled by physician).
   * Transitions: APPROVED/ACTIVE → DISCONTINUED
   * 
   * @throws {OrderNotDiscontinuableError} if not in APPROVED/ACTIVE state
   * @throws {OrderAlreadyFinishedError} if in terminal state
   */
  discontinue(discontinuedBy: string, reason: string): void {
    if (this.isInTerminalState()) {
      throw new OrderAlreadyFinishedError(this.props.id, this.props.orderStatus);
    }

    if (this.props.orderStatus !== 'APPROVED' && this.props.orderStatus !== 'ACTIVE') {
      throw new OrderNotDiscontinuableError(this.props.id, this.props.orderStatus);
    }

    if (!reason || reason.trim() === '') {
      throw new MissingRequiredFieldError('discontinueReason');
    }

    this.props.orderStatus = 'DISCONTINUED';
    this.props.discontinuedBy = discontinuedBy;
    this.props.discontinuedAt = new Date();
    this.props.discontinueReason = reason;
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  // ==========================================================================
  // Business Logic / Guards
  // ==========================================================================

  /**
   * Check if order is in terminal state (cannot be modified).
   */
  isInTerminalState(): boolean {
    return this.props.orderStatus === 'COMPLETED' ||
           this.props.orderStatus === 'DISCONTINUED' ||
           this.props.orderStatus === 'REJECTED';
  }

  /**
   * Check if order can be approved.
   */
  canApprove(): boolean {
    return this.props.orderStatus === 'VALIDATED';
  }

  /**
   * Check if order can be discontinued.
   */
  canDiscontinue(): boolean {
    return (this.props.orderStatus === 'APPROVED' || this.props.orderStatus === 'ACTIVE') &&
           !this.isInTerminalState();
  }

  /**
   * Check if order requires CDS check (MEDICATION type only).
   */
  requiresCdsCheck(): boolean {
    return this.props.orderType === 'MEDICATION';
  }

  /**
   * Check if order is MEDICATION type.
   */
  isMedicationOrder(): boolean {
    return this.props.orderType === 'MEDICATION';
  }

  // ==========================================================================
  // Getters (immutable read access)
  // ==========================================================================

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get encounterId(): string {
    return this.props.encounterId;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get orderType(): OrderType {
    return this.props.orderType;
  }

  get orderStatus(): OrderStatus {
    return this.props.orderStatus;
  }

  get priority(): OrderPriority {
    return this.props.priority;
  }

  get orderedBy(): string {
    return this.props.orderedBy;
  }

  get orderedAt(): Date {
    return new Date(this.props.orderedAt);
  }

  get approvedBy(): string | undefined {
    return this.props.approvedBy;
  }

  get approvedAt(): Date | undefined {
    return this.props.approvedAt ? new Date(this.props.approvedAt) : undefined;
  }

  get discontinuedBy(): string | undefined {
    return this.props.discontinuedBy;
  }

  get discontinuedAt(): Date | undefined {
    return this.props.discontinuedAt ? new Date(this.props.discontinuedAt) : undefined;
  }

  get discontinueReason(): string | undefined {
    return this.props.discontinueReason;
  }

  get cdsCheckId(): string | undefined {
    return this.props.cdsCheckId;
  }

  get cdsCheckStatus(): CdsCheckStatus | undefined {
    return this.props.cdsCheckStatus;
  }

  get orderDetails(): OrderDetails {
    return this.props.orderDetails;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get version(): number {
    return this.props.version;
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object (for persistence or serialization).
   */
  toPlainObject(): ClinicalOrderProps {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      encounterId: this.props.encounterId,
      patientId: this.props.patientId,
      orderType: this.props.orderType,
      orderStatus: this.props.orderStatus,
      priority: this.props.priority,
      orderedBy: this.props.orderedBy,
      orderedAt: new Date(this.props.orderedAt),
      approvedBy: this.props.approvedBy,
      approvedAt: this.props.approvedAt ? new Date(this.props.approvedAt) : undefined,
      discontinuedBy: this.props.discontinuedBy,
      discontinuedAt: this.props.discontinuedAt ? new Date(this.props.discontinuedAt) : undefined,
      discontinueReason: this.props.discontinueReason,
      cdsCheckId: this.props.cdsCheckId,
      cdsCheckStatus: this.props.cdsCheckStatus,
      orderDetails: this.props.orderDetails,
      notes: this.props.notes,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
      version: this.props.version,
    };
  }
}
