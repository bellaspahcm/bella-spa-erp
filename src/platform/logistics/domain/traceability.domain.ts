/**
 * Traceability Domain Kernel
 * 
 * Pure business logic for lot/serial tracking, chain of custody.
 * Zero dependencies on infrastructure.
 * 
 * Responsibilities:
 * - Lot/serial creation and validation
 * - Chain of custody management
 * - Recall management
 * - Compliance tracking
 */

import { Result } from './core/result';
import type {
  Traceability,
  CreateTraceabilityProps,
  CustodyEvent,
  AddCustodyEventProps,
  RecallStatus,
  ComplianceStatus,
} from './traceability.types';

export class TraceabilityDomain {
  /**
   * Create new traceability record
   * 
   * Invariants:
   * - Must have lot_number OR serial_number (at least one)
   * - Expiry date must be after manufactured date
   * - Received date required
   */
  static create(props: CreateTraceabilityProps): Result<Traceability> {
    // At least one identifier required
    if (!props.lot_number && !props.serial_number) {
      return Result.fail(
        'Either lot number or serial number is required',
        'TRACEABILITY_IDENTIFIER_REQUIRED'
      );
    }

    // Received date required
    if (!props.received_date) {
      return Result.fail(
        'Received date is required',
        'TRACEABILITY_RECEIVED_DATE_REQUIRED'
      );
    }

    // Date validation: expiry after manufacture
    if (props.expiry_date && props.manufactured_date) {
      const expiry = new Date(props.expiry_date);
      const manufactured = new Date(props.manufactured_date);

      if (expiry <= manufactured) {
        return Result.fail(
          'Expiry date must be after manufactured date',
          'TRACEABILITY_EXPIRY_BEFORE_MANUFACTURE'
        );
      }
    }

    const now = new Date();

    const traceability: Traceability = {
      id: { value: crypto.randomUUID() },
      tenant_id: props.tenant_id,
      item_id: { value: props.item_id },
      
      lot_number: props.lot_number ? { value: props.lot_number } : undefined,
      serial_number: props.serial_number ? { value: props.serial_number } : undefined,
      
      manufactured_date: props.manufactured_date,
      expiry_date: props.expiry_date,
      received_date: props.received_date,
      
      supplier: props.supplier,
      
      custody_events: [],
      
      compliance_status: 'COMPLIANT',
      recall_status: 'NONE',
      recall_reason: undefined,
      recall_date: undefined,
      
      created_at: now,
      updated_at: now,
    };

    return Result.ok(traceability);
  }

  /**
   * Add custody event to chain of custody
   * 
   * Chain of custody is append-only (immutable).
   */
  static addCustodyEvent(
    traceability: Traceability,
    props: AddCustodyEventProps
  ): Result<Traceability> {
    // Validation
    if (!props.location_id) {
      return Result.fail(
        'Location ID is required for custody event',
        'CUSTODY_EVENT_LOCATION_REQUIRED'
      );
    }

    if (!props.action || props.action.trim() === '') {
      return Result.fail(
        'Action is required for custody event',
        'CUSTODY_EVENT_ACTION_REQUIRED'
      );
    }

    const custodyEvent: CustodyEvent = {
      timestamp: props.timestamp || new Date(),
      location_id: props.location_id,
      location_type: props.location_type || 'WAREHOUSE',
      action: props.action.trim() as CustodyEvent['action'],
      user_id: props.user_id,
      notes: props.notes?.trim(),
    };

    const updatedEvents = [...traceability.custody_events, custodyEvent];

    const updated: Traceability = {
      ...traceability,
      custody_events: updatedEvents,
      updated_at: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Initiate recall
   * 
   * Only NONE or COMPLIANT records can be recalled.
   */
  static initiateRecall(
    traceability: Traceability,
    recallReason: string
  ): Result<Traceability> {
    if (traceability.recall_status !== 'NONE') {
      return Result.fail(
        `Cannot recall item already in status ${traceability.recall_status}`,
        'TRACEABILITY_ALREADY_RECALLED'
      );
    }

    if (!recallReason || recallReason.trim() === '') {
      return Result.fail(
        'Recall reason is required',
        'TRACEABILITY_RECALL_REASON_REQUIRED'
      );
    }

    const now = new Date();

    const recalled: Traceability = {
      ...traceability,
      recall_status: 'RECALLED',
      recall_reason: recallReason.trim(),
      recall_date: now,
      compliance_status: 'NON_COMPLIANT',
      updated_at: now,
    };

    return Result.ok(recalled);
  }

  /**
   * Mark recalled item as destroyed
   * 
   * Only RECALLED items can be destroyed.
   */
  static markAsDestroyed(
    traceability: Traceability
  ): Result<Traceability> {
    if (traceability.recall_status !== 'RECALLED') {
      return Result.fail(
        'Only recalled items can be marked as destroyed',
        'TRACEABILITY_NOT_RECALLED'
      );
    }

    const destroyed: Traceability = {
      ...traceability,
      recall_status: 'DESTROYED',
      updated_at: new Date(),
    };

    return Result.ok(destroyed);
  }

  /**
   * Change compliance status
   */
  static changeComplianceStatus(
    traceability: Traceability,
    newStatus: ComplianceStatus,
    reason?: string
  ): Result<Traceability> {
    // Cannot mark as COMPLIANT if recalled/destroyed
    if (newStatus === 'COMPLIANT' && traceability.recall_status !== 'NONE') {
      return Result.fail(
        'Cannot mark recalled/destroyed item as compliant',
        'TRACEABILITY_CANNOT_MARK_RECALLED_COMPLIANT'
      );
    }

    const updated: Traceability = {
      ...traceability,
      compliance_status: newStatus,
      updated_at: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Check if item is recalled
   */
  static isRecalled(traceability: Traceability): boolean {
    return traceability.recall_status === 'RECALLED' || traceability.recall_status === 'DESTROYED';
  }

  /**
   * Check if item is destroyed
   */
  static isDestroyed(traceability: Traceability): boolean {
    return traceability.recall_status === 'DESTROYED';
  }

  /**
   * Check if item is compliant
   */
  static isCompliant(traceability: Traceability): boolean {
    return traceability.compliance_status === 'COMPLIANT';
  }

  /**
   * Check if item has expired
   */
  static hasExpired(traceability: Traceability, referenceDate: Date = new Date()): boolean {
    if (!traceability.expiry_date) return false;

    const expiryDate = new Date(traceability.expiry_date);
    return expiryDate < referenceDate;
  }

  /**
   * Calculate days until expiry
   */
  static daysUntilExpiry(traceability: Traceability, referenceDate: Date = new Date()): number | null {
    if (!traceability.expiry_date) return null;

    const expiryDate = new Date(traceability.expiry_date);
    const diffMs = expiryDate.getTime() - referenceDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if item is near expiry (within threshold days)
   */
  static isNearExpiry(
    traceability: Traceability,
    thresholdDays: number = 30,
    referenceDate: Date = new Date()
  ): boolean {
    const daysUntil = this.daysUntilExpiry(traceability, referenceDate);
    if (daysUntil === null) return false;

    return daysUntil > 0 && daysUntil <= thresholdDays;
  }

  /**
   * Get chain of custody summary
   * 
   * NOTE: Query/read-model helper.
   * May belong in repository query layer or API/presentation layer.
   * Consider whether this is a domain primitive or a reporting concern.
   */
  static getCustodyChain(traceability: Traceability): string[] {
    return traceability.custody_events.map(event => {
      const parts: string[] = [
        event.timestamp.toISOString(),
        event.action,
        event.location_type || 'location',
      ];

      if (event.notes) {
        parts.push(`(${event.notes})`);
      }

      return parts.join(' | ');
    });
  }

  /**
   * Get custody event count
   */
  static getCustodyEventCount(traceability: Traceability): number {
    return traceability.custody_events.length;
  }

  /**
   * Get last custody event
   */
  static getLastCustodyEvent(traceability: Traceability): CustodyEvent | null {
    if (traceability.custody_events.length === 0) return null;
    return traceability.custody_events[traceability.custody_events.length - 1];
  }

  /**
   * Calculate shelf life remaining (percentage)
   */
  static getShelfLifeRemaining(traceability: Traceability, referenceDate: Date = new Date()): number | null {
    if (!traceability.manufactured_date || !traceability.expiry_date) return null;

    const manufactured = new Date(traceability.manufactured_date).getTime();
    const expiry = new Date(traceability.expiry_date).getTime();
    const current = referenceDate.getTime();

    const totalShelfLife = expiry - manufactured;
    const timeElapsed = current - manufactured;

    if (totalShelfLife <= 0) return 0;

    const remaining = 100 - (timeElapsed / totalShelfLife * 100);
    return Math.max(0, Math.min(100, remaining));
  }
}
