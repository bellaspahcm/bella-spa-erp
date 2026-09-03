/**
 * Traceability Domain
 * 
 * E7 Logistics Domain Kernel - Traceability Component
 * Canonical: Database['logistics']['Tables']['traceability']
 * 
 * Traceability is an immutable audit trail for lot/serial tracking.
 * Chain of custody is append-only.
 * 
 * 6 Domain Invariants:
 * 1. Must have lot_number OR serial_number
 * 2. Received date required
 * 3. Expiry date must be after manufactured date
 * 4. Chain of custody is append-only
 * 5. Only NONE status can be recalled
 * 6. Only RECALLED items can be destroyed
 */

import { Result } from './core/result';
import type { Database } from '../../../shared/database.types';

// Canonical DB row type
type TraceabilityRow = Database['logistics']['Tables']['traceability']['Row'];

// Domain types
export type RecallStatus = 'NONE' | 'RECALLED' | 'DESTROYED';
export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
export type LocationType = 'WAREHOUSE' | 'STORE' | 'TRANSIT' | 'VENDOR' | 'CUSTOMER';

export interface CustodyEvent {
  timestamp: Date;
  locationId: string;
  locationType: LocationType | null;
  action: string;
  userId: string | null;
  notes: string | null;
}

export interface Traceability {
  id: string;
  tenantId: string;
  itemId: string;
  lotNumber: string | null;
  serialNumber: string | null;
  receivedDate: Date;
  manufacturedDate: Date | null;
  expiryDate: Date | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierLotNumber: string | null;
  recallStatus: RecallStatus;
  recallDate: Date | null;
  recallReason: string | null;
  complianceStatus: ComplianceStatus;
  custodyEvents: CustodyEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTraceabilityProps {
  tenantId: string;
  itemId: string;
  lotNumber?: string;
  serialNumber?: string;
  receivedDate: Date;
  manufacturedDate?: Date;
  expiryDate?: Date;
  supplierId?: string;
  supplierName?: string;
  supplierLotNumber?: string;
  recallStatus?: RecallStatus;
  complianceStatus?: ComplianceStatus;
}

export interface AddCustodyEventProps {
  locationId: string;
  locationType?: LocationType;
  action: string;
  userId?: string;
  notes?: string;
}

export class TraceabilityDomain {
  /**
   * Create new traceability record
   * Validates all 6 domain invariants
   */
  static create(props: CreateTraceabilityProps): Result<Traceability> {
    // Invariant 1: Must have lot OR serial
    if (!props.lotNumber && !props.serialNumber) {
      return Result.fail(
        'Either lot number or serial number is required',
        'TRACEABILITY_IDENTIFIER_REQUIRED'
      );
    }

    // Invariant 2: Received date required
    if (!props.receivedDate) {
      return Result.fail('Received date is required', 'TRACEABILITY_RECEIVED_DATE_REQUIRED');
    }

    // Invariant 3: Expiry date must be after manufactured date
    if (props.manufacturedDate && props.expiryDate) {
      if (props.expiryDate <= props.manufacturedDate) {
        return Result.fail(
          'Expiry date must be after manufactured date',
          'TRACEABILITY_EXPIRY_BEFORE_MANUFACTURE'
        );
      }
    }

    const now = new Date();
    const traceability: Traceability = {
      id: crypto.randomUUID(),
      tenantId: props.tenantId,
      itemId: props.itemId,
      lotNumber: props.lotNumber ?? null,
      serialNumber: props.serialNumber ?? null,
      receivedDate: props.receivedDate,
      manufacturedDate: props.manufacturedDate ?? null,
      expiryDate: props.expiryDate ?? null,
      supplierId: props.supplierId ?? null,
      supplierName: props.supplierName ?? null,
      supplierLotNumber: props.supplierLotNumber ?? null,
      recallStatus: props.recallStatus ?? 'NONE',
      recallDate: null,
      recallReason: null,
      complianceStatus: props.complianceStatus ?? 'COMPLIANT',
      custodyEvents: [],
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(traceability);
  }

  /**
   * Add custody event to chain
   * Invariant 4: Chain of custody is append-only
   */
  static addCustodyEvent(
    traceability: Traceability,
    props: AddCustodyEventProps
  ): Result<Traceability> {
    // Validate location ID
    if (!props.locationId || !props.locationId.trim()) {
      return Result.fail(
        'Location ID is required for custody event',
        'CUSTODY_EVENT_LOCATION_REQUIRED'
      );
    }

    // Validate action
    const trimmedAction = props.action.trim();
    if (!trimmedAction) {
      return Result.fail(
        'Action is required for custody event',
        'CUSTODY_EVENT_ACTION_REQUIRED'
      );
    }

    const event: CustodyEvent = {
      timestamp: new Date(),
      locationId: props.locationId.trim(),
      locationType: props.locationType ?? null,
      action: trimmedAction,
      userId: props.userId ?? null,
      notes: props.notes?.trim() || null,
    };

    // Append-only: preserve existing events and add new one
    const updated: Traceability = {
      ...traceability,
      custodyEvents: [...traceability.custodyEvents, event],
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Initiate recall
   * Invariant 5: Only NONE status can be recalled
   */
  static initiateRecall(traceability: Traceability, reason: string): Result<Traceability> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      return Result.fail('Recall reason is required', 'TRACEABILITY_RECALL_REASON_REQUIRED');
    }

    if (traceability.recallStatus !== 'NONE') {
      return Result.fail(
        `Cannot recall item already in status ${traceability.recallStatus}`,
        'TRACEABILITY_ALREADY_RECALLED'
      );
    }

    const now = new Date();
    const recalled: Traceability = {
      ...traceability,
      recallStatus: 'RECALLED',
      recallDate: now,
      recallReason: trimmedReason,
      complianceStatus: 'NON_COMPLIANT',
      updatedAt: now,
    };

    return Result.ok(recalled);
  }

  /**
   * Mark as destroyed
   * Invariant 6: Only RECALLED items can be destroyed
   */
  static markAsDestroyed(traceability: Traceability): Result<Traceability> {
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
    status: ComplianceStatus
  ): Result<Traceability> {
    // Cannot mark recalled/destroyed items as compliant
    if ((traceability.recallStatus === 'RECALLED' || traceability.recallStatus === 'DESTROYED') 
        && status === 'COMPLIANT') {
      return Result.fail(
        'Cannot mark recalled/destroyed item as compliant',
        'TRACEABILITY_CANNOT_MARK_RECALLED_COMPLIANT'
      );
    }

    const updated: Traceability = {
      ...traceability,
      complianceStatus: status,
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
  static hasExpired(traceability: Traceability, asOf: Date = new Date()): boolean {
    if (!traceability.expiryDate) {
      return false;
    }
    return traceability.expiryDate < asOf;
  }

  /**
   * Calculate days until expiry
   * Returns negative for expired items
   */
  static daysUntilExpiry(traceability: Traceability, asOf: Date = new Date()): number | null {
    if (!traceability.expiryDate) {
      return null;
    }

    const diffMs = traceability.expiryDate.getTime() - asOf.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Check if item is near expiry
   * Does not include already expired items
   */
  static isNearExpiry(
    traceability: Traceability,
    daysThreshold: number,
    asOf: Date = new Date()
  ): boolean {
    const days = this.daysUntilExpiry(traceability, asOf);
    if (days === null) {
      return false;
    }
    return days > 0 && days <= daysThreshold;
  }

  /**
   * Calculate shelf life remaining as percentage
   * Returns 0-100 or null if dates missing
   */
  static getShelfLifeRemaining(traceability: Traceability, asOf: Date = new Date()): number | null {
    if (!traceability.manufacturedDate || !traceability.expiryDate) {
      return null;
    }

    const totalShelfLife = traceability.expiryDate.getTime() - traceability.manufacturedDate.getTime();
    const elapsed = asOf.getTime() - traceability.manufacturedDate.getTime();
    const remaining = totalShelfLife - elapsed;

    if (remaining <= 0) {
      return 0;
    }

    const percentage = (remaining / totalShelfLife) * 100;
    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Get custody chain
   */
  static getCustodyChain(traceability: Traceability): string[] {
    return traceability.custodyEvents.map(event => {
      const parts: string[] = [];
      parts.push(event.timestamp.toISOString());
      parts.push(event.action);
      if (event.locationType) {
        parts.push(event.locationType);
      }
      if (event.notes) {
        parts.push(`"${event.notes}"`);
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
    if (traceability.custodyEvents.length === 0) {
      return null;
    }
    return traceability.custodyEvents[traceability.custodyEvents.length - 1];
  }
}
