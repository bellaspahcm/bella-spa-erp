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
    if (!props.lotNumber && !props.serialNumber) {
      return Result.fail(
        'Either lot number or serial number is required',
        'TRACEABILITY_IDENTIFIER_REQUIRED'
      );
    }

    // Received date required
    if (!props.receivedDate) {
      return Result.fail(
        'Received date is required',
        'TRACEABILITY_RECEIVED_DATE_REQUIRED'
      );
    }

    // Date validation: expiry after manufacture
    if (props.expiryDate && props.manufacturedDate) {
      const expiry = new Date(props.expiryDate);
      const manufactured = new Date(props.manufacturedDate);

      if (expiry <= manufactured) {
        return Result.fail(
          'Expiry date must be after manufactured date',
          'TRACEABILITY_EXPIRY_BEFORE_MANUFACTURE'
        );
      }
    }

    const now = new Date();

    const traceability: Traceability = {
      id: props.id || crypto.randomUUID(),
      tenantId: props.tenantId,
      itemId: props.itemId,
      
      lotNumber: props.lotNumber || null,
      serialNumber: props.serialNumber || null,
      
      manufacturedDate: props.manufacturedDate || null,
      expiryDate: props.expiryDate || null,
      receivedDate: props.receivedDate,
      
      supplierId: props.supplierId || null,
      supplierName: props.supplierName || null,
      supplierLotNumber: props.supplierLotNumber || null,
      
      custodyEvents: props.custodyEvents || [],
      
      complianceStatus: props.complianceStatus || 'COMPLIANT',
      recallStatus: props.recallStatus || 'NONE',
      recallReason: null,
      recallDate: null,
      
      createdAt: now,
      updatedAt: now,
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
    if (!props.locationId) {
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
      locationId: props.locationId,
      locationType: props.locationType || null,
      action: props.action.trim(),
      userId: props.userId || null,
      notes: props.notes?.trim() || null,
    };

    const updatedEvents = [...traceability.custodyEvents, custodyEvent];

    const updated: Traceability = {
      ...traceability,
      custodyEvents: updatedEvents,
      updatedAt: new Date(),
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
    if (traceability.recallStatus !== 'NONE') {
      return Result.fail(
        `Cannot recall item already in status ${traceability.recallStatus}`,
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
      recallStatus: 'RECALLED',
      recallReason: recallReason.trim(),
      recallDate: now,
      complianceStatus: 'NON_COMPLIANT',
      updatedAt: now,
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
    if (traceability.recallStatus !== 'RECALLED') {
      return Result.fail(
        'Only recalled items can be marked as destroyed',
        'TRACEABILITY_NOT_RECALLED'
      );
    }

    const destroyed: Traceability = {
      ...traceability,
      recallStatus: 'DESTROYED',
      updatedAt: new Date(),
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
    if (newStatus === 'COMPLIANT' && traceability.recallStatus !== 'NONE') {
      return Result.fail(
        'Cannot mark recalled/destroyed item as compliant',
        'TRACEABILITY_CANNOT_MARK_RECALLED_COMPLIANT'
      );
    }

    const updated: Traceability = {
      ...traceability,
      complianceStatus: newStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Check if item is recalled
   */
  static isRecalled(traceability: Traceability): boolean {
    return traceability.recallStatus === 'RECALLED' || traceability.recallStatus === 'DESTROYED';
  }

  /**
   * Check if item is destroyed
   */
  static isDestroyed(traceability: Traceability): boolean {
    return traceability.recallStatus === 'DESTROYED';
  }

  /**
   * Check if item is compliant
   */
  static isCompliant(traceability: Traceability): boolean {
    return traceability.complianceStatus === 'COMPLIANT';
  }

  /**
   * Check if item has expired
   */
  static hasExpired(traceability: Traceability, referenceDate: Date = new Date()): boolean {
    if (!traceability.expiryDate) return false;

    const expiryDate = new Date(traceability.expiryDate);
    return expiryDate < referenceDate;
  }

  /**
   * Calculate days until expiry
   */
  static daysUntilExpiry(traceability: Traceability, referenceDate: Date = new Date()): number | null {
    if (!traceability.expiryDate) return null;

    const expiryDate = new Date(traceability.expiryDate);
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
    return traceability.custodyEvents.map(event => {
      const parts: string[] = [
        event.timestamp.toISOString(),
        event.action,
        event.locationType || 'location',
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
    return traceability.custodyEvents.length;
  }

  /**
   * Get last custody event
   */
  static getLastCustodyEvent(traceability: Traceability): CustodyEvent | null {
    if (traceability.custodyEvents.length === 0) return null;
    return traceability.custodyEvents[traceability.custodyEvents.length - 1];
  }

  /**
   * Calculate shelf life remaining (percentage)
   */
  static getShelfLifeRemaining(traceability: Traceability, referenceDate: Date = new Date()): number | null {
    if (!traceability.manufacturedDate || !traceability.expiryDate) return null;

    const manufactured = new Date(traceability.manufacturedDate).getTime();
    const expiry = new Date(traceability.expiryDate).getTime();
    const current = referenceDate.getTime();

    const totalShelfLife = expiry - manufactured;
    const timeElapsed = current - manufactured;

    if (totalShelfLife <= 0) return 0;

    const remaining = 100 - (timeElapsed / totalShelfLife * 100);
    return Math.max(0, Math.min(100, remaining));
  }
}
