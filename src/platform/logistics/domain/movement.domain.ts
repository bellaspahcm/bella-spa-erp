/**
 * Movement Domain
 * 
 * E7 Logistics Domain Kernel - Movement Component
 * Canonical: Database['logistics']['Tables']['inventory_movements']
 * 
 * Movement is an immutable fact record of inventory transactions.
 * It does NOT mutate Inventory state - that's a repository/service concern.
 * 
 * 12 Domain Invariants:
 * 1. Movement number required
 * 2. Quantity must be positive
 * 3. Direction must match movement type
 * 4. INBOUND requires to_location
 * 5. OUTBOUND requires from_location
 * 6. NEUTRAL requires both locations
 * 7. Cannot transfer to same location
 * 8. Unit cost cannot be negative
 * 9. Total cost cannot be negative
 * 10. Currency must be ISO 4217
 * 11. Serial requires lot
 * 12. Only PENDING can be approved/cancelled
 */

import { Result } from './core/result';
import type { Database } from '../../../shared/database.types';

// Canonical DB row type
type MovementRow = Database['logistics']['Tables']['inventory_movements']['Row'];

// Domain types
export type MovementType =
  | 'RECEIPT' | 'SHIPMENT' | 'RELOCATION'
  | 'TRANSFER_IN' | 'TRANSFER_OUT'
  | 'PRODUCTION_OUTPUT' | 'PRODUCTION_CONSUMPTION'
  | 'ADJUSTMENT_INCREASE' | 'ADJUSTMENT_DECREASE'
  | 'ISSUE' | 'RETURN' | 'DAMAGE' | 'STATUS_CHANGE' | 'CYCLE_COUNT';

export type MovementDirection = 'INBOUND' | 'OUTBOUND' | 'NEUTRAL';
export type MovementStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type LocationType = 'WAREHOUSE' | 'STORE' | 'TRANSIT' | 'VENDOR' | 'CUSTOMER';

export interface InventoryMovement {
  id: string;
  movementNumber: string;
  tenantId: string;
  movementType: MovementType;
  direction: MovementDirection;
  itemId: string;
  quantity: number;
  unitOfMeasure: string;
  fromLocationId: string | null;
  fromLocationType: LocationType | null;
  toLocationId: string | null;
  toLocationType: LocationType | null;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDate: Date | null;
  unitCost: number | null;
  totalCost: number | null;
  currency: string | null;
  status: MovementStatus;
  movementDate: Date;
  reason: string | null;
  notes: string | null;
  sourceDocumentType: string | null;
  sourceDocumentNumber: string | null;
  sourceDocumentId: string | null;
  sourceLineItemId: string | null;
  batchId: string | null;
  createdBy: string | null;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
}

export interface CreateMovementProps {
  movementNumber: string;
  tenantId: string;
  movementType: MovementType;
  direction: MovementDirection;
  itemId: string;
  quantity: number;
  unitOfMeasure: string;
  fromLocationId?: string;
  fromLocationType?: LocationType;
  toLocationId?: string;
  toLocationType?: LocationType;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  unitCost?: number;
  totalCost?: number;
  currency?: string;
  status?: MovementStatus;
  movementDate?: Date;
  reason?: string;
  notes?: string;
  sourceDocumentType?: string;
  sourceDocumentNumber?: string;
  sourceDocumentId?: string;
  sourceLineItemId?: string;
  batchId?: string;
  createdBy?: string;
}

export interface ItemTraceabilityRequirements {
  lotTracked: boolean;
  serialTracked: boolean;
  expiryTracked: boolean;
}

export class MovementDomain {
  /**
   * Create new movement record
   * Validates all 12 domain invariants
   */
  static create(props: CreateMovementProps): Result<InventoryMovement> {
    // Invariant 1: Movement number required
    const trimmedNumber = props.movementNumber.trim();
    if (!trimmedNumber) {
      return Result.fail('Movement number is required', 'MOVEMENT_NUMBER_REQUIRED');
    }

    // Invariant 2: Quantity must be positive
    if (props.quantity <= 0) {
      return Result.fail('Movement quantity must be positive', 'MOVEMENT_QUANTITY_MUST_BE_POSITIVE');
    }

    // Invariant 3: Direction must match movement type
    const directionValid = this.validateDirectionForType(props.movementType, props.direction);
    if (!directionValid) {
      return Result.fail(
        `Movement type ${props.movementType} incompatible with direction ${props.direction}`,
        'MOVEMENT_DIRECTION_TYPE_MISMATCH'
      );
    }

    // Invariant 4: INBOUND requires to_location
    if (props.direction === 'INBOUND' && !props.toLocationId) {
      return Result.fail('INBOUND movement requires to_location', 'MOVEMENT_INBOUND_REQUIRES_TO_LOCATION');
    }

    // Invariant 5: OUTBOUND requires from_location
    if (props.direction === 'OUTBOUND' && !props.fromLocationId) {
      return Result.fail('OUTBOUND movement requires from_location', 'MOVEMENT_OUTBOUND_REQUIRES_FROM_LOCATION');
    }

    // Invariant 6: NEUTRAL requires both locations
    if (props.direction === 'NEUTRAL') {
      if (!props.fromLocationId || !props.toLocationId) {
        return Result.fail(
          'NEUTRAL movement requires both from_location and to_location',
          'MOVEMENT_NEUTRAL_REQUIRES_BOTH_LOCATIONS'
        );
      }

      // Invariant 7: Cannot transfer to same location
      if (props.fromLocationId === props.toLocationId) {
        return Result.fail('Cannot transfer to same location', 'MOVEMENT_SAME_LOCATION_TRANSFER');
      }
    }

    // Invariant 8: Unit cost cannot be negative
    if (props.unitCost !== undefined && props.unitCost < 0) {
      return Result.fail('Unit cost cannot be negative', 'MOVEMENT_UNIT_COST_NEGATIVE');
    }

    // Invariant 9: Total cost cannot be negative
    if (props.totalCost !== undefined && props.totalCost < 0) {
      return Result.fail('Total cost cannot be negative', 'MOVEMENT_TOTAL_COST_NEGATIVE');
    }

    // Invariant 10: Currency must be ISO 4217
    if (props.currency !== undefined) {
      const currencyValid = /^[A-Z]{3}$/.test(props.currency);
      if (!currencyValid) {
        return Result.fail('Currency must be 3-letter ISO 4217 code', 'MOVEMENT_CURRENCY_INVALID');
      }
    }

    // Invariant 11: Serial requires lot
    if (props.serialNumber && !props.lotNumber) {
      return Result.fail('Serial number requires lot number', 'MOVEMENT_SERIAL_REQUIRES_LOT');
    }

    const now = new Date();
    const status = props.status ?? 'COMPLETED';
    
    const movement: InventoryMovement = {
      id: crypto.randomUUID(),
      movementNumber: trimmedNumber,
      tenantId: props.tenantId,
      movementType: props.movementType,
      direction: props.direction,
      itemId: props.itemId,
      quantity: props.quantity,
      unitOfMeasure: props.unitOfMeasure,
      fromLocationId: props.fromLocationId ?? null,
      fromLocationType: props.fromLocationType ?? null,
      toLocationId: props.toLocationId ?? null,
      toLocationType: props.toLocationType ?? null,
      lotNumber: props.lotNumber ?? null,
      serialNumber: props.serialNumber ?? null,
      expiryDate: props.expiryDate ?? null,
      unitCost: props.unitCost ?? null,
      totalCost: props.totalCost ?? null,
      currency: props.currency ?? null,
      status,
      movementDate: props.movementDate ?? now,
      reason: props.reason ?? null,
      notes: props.notes ?? null,
      sourceDocumentType: props.sourceDocumentType ?? null,
      sourceDocumentNumber: props.sourceDocumentNumber ?? null,
      sourceDocumentId: props.sourceDocumentId ?? null,
      sourceLineItemId: props.sourceLineItemId ?? null,
      batchId: props.batchId ?? null,
      createdBy: props.createdBy ?? null,
      createdAt: now,
      approvedBy: null,
      approvedAt: null,
      completedAt: status === 'COMPLETED' ? now : null,
      cancellationReason: null,
      cancelledAt: null,
    };

    return Result.ok(movement);
  }

  /**
   * Approve pending movement
   * Invariant 12: Only PENDING can be approved
   */
  static approve(movement: InventoryMovement, approvedBy: string): Result<InventoryMovement> {
    if (movement.status !== 'PENDING') {
      return Result.fail(
        `Cannot approve movement with status ${movement.status}. Only PENDING movements can be approved`,
        'MOVEMENT_CANNOT_APPROVE_NON_PENDING'
      );
    }

    const now = new Date();
    const approved: InventoryMovement = {
      ...movement,
      status: 'COMPLETED',
      approvedBy,
      approvedAt: now,
      completedAt: now,
    };

    return Result.ok(approved);
  }

  /**
   * Cancel pending movement
   * Invariant 12: Only PENDING can be cancelled
   */
  static cancel(movement: InventoryMovement, reason: string): Result<InventoryMovement> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      return Result.fail('Cancellation reason is required', 'MOVEMENT_CANCELLATION_REASON_REQUIRED');
    }

    if (movement.status !== 'PENDING') {
      return Result.fail(
        `Cannot cancel movement with status ${movement.status}. Only PENDING movements can be cancelled`,
        'MOVEMENT_CANNOT_CANCEL_NON_PENDING'
      );
    }

    const now = new Date();
    const cancelled: InventoryMovement = {
      ...movement,
      status: 'CANCELLED',
      cancellationReason: trimmedReason,
      cancelledAt: now,
    };

    return Result.ok(cancelled);
  }

  /**
   * Validate movement traceability against item requirements
   */
  static validateTraceability(
    movement: InventoryMovement,
    requirements: ItemTraceabilityRequirements
  ): Result<true> {
    if (requirements.lotTracked && !movement.lotNumber) {
      return Result.fail(
        'Item requires lot tracking, but movement has no lot number',
        'MOVEMENT_LOT_NUMBER_REQUIRED'
      );
    }

    if (requirements.serialTracked && !movement.serialNumber) {
      return Result.fail(
        'Item requires serial tracking, but movement has no serial number',
        'MOVEMENT_SERIAL_NUMBER_REQUIRED'
      );
    }

    if (requirements.expiryTracked && !movement.expiryDate) {
      return Result.fail(
        'Item requires expiry tracking, but movement has no expiry date',
        'MOVEMENT_EXPIRY_DATE_REQUIRED'
      );
    }

    return Result.ok(true);
  }

  /**
   * Calculate total cost from unit cost and quantity
   */
  static calculateTotalCost(movement: InventoryMovement): number | null {
    if (movement.unitCost === null) {
      return null;
    }
    return movement.quantity * movement.unitCost;
  }

  /**
   * Status queries
   */
  static isCompleted(movement: InventoryMovement): boolean {
    return movement.status === 'COMPLETED';
  }

  static isPending(movement: InventoryMovement): boolean {
    return movement.status === 'PENDING';
  }

  static isCancelled(movement: InventoryMovement): boolean {
    return movement.status === 'CANCELLED';
  }

  /**
   * Check if movement can be modified (only PENDING)
   */
  static canModify(movement: InventoryMovement): boolean {
    return movement.status === 'PENDING';
  }

  /**
   * Direction queries
   */
  static increasesInventory(movement: InventoryMovement): boolean {
    return movement.direction === 'INBOUND';
  }

  static decreasesInventory(movement: InventoryMovement): boolean {
    return movement.direction === 'OUTBOUND';
  }

  static isNeutral(movement: InventoryMovement): boolean {
    return movement.direction === 'NEUTRAL';
  }

  /**
   * Generate human-readable description of movement
   */
  static getDescription(movement: InventoryMovement): string {
    const parts: string[] = [];

    // Movement type
    parts.push(movement.movementType);

    // Quantity + UOM
    parts.push(`${movement.quantity} ${movement.unitOfMeasure}`);

    // Direction with locations
    if (movement.direction === 'INBOUND') {
      const location = movement.toLocationType ?? 'LOCATION';
      parts.push(`→ ${location}`);
    } else if (movement.direction === 'OUTBOUND') {
      const location = movement.fromLocationType ?? 'LOCATION';
      parts.push(`← ${location}`);
    } else if (movement.direction === 'NEUTRAL') {
      const from = movement.fromLocationType ?? 'LOCATION';
      const to = movement.toLocationType ?? 'LOCATION';
      parts.push(`${from} → ${to}`);
    }

    let description = parts.join(' | ');

    // Add lot/serial if present
    const tracking: string[] = [];
    if (movement.lotNumber) {
      tracking.push(`Lot: ${movement.lotNumber}`);
    }
    if (movement.serialNumber) {
      tracking.push(`S/N: ${movement.serialNumber}`);
    }
    if (tracking.length > 0) {
      description += ` [${tracking.join(', ')}]`;
    }

    return description;
  }

  /**
   * Validate direction matches movement type
   * Invariant 3 logic
   */
  private static validateDirectionForType(type: MovementType, direction: MovementDirection): boolean {
    const inboundTypes: MovementType[] = [
      'RECEIPT',
      'TRANSFER_IN',
      'PRODUCTION_OUTPUT',
      'ADJUSTMENT_INCREASE',
      'RETURN',
    ];

    const outboundTypes: MovementType[] = [
      'SHIPMENT',
      'TRANSFER_OUT',
      'ISSUE',
      'PRODUCTION_CONSUMPTION',
      'ADJUSTMENT_DECREASE',
      'DAMAGE',
    ];

    const neutralTypes: MovementType[] = [
      'RELOCATION',
      'STATUS_CHANGE',
      'CYCLE_COUNT',
    ];

    if (direction === 'INBOUND') {
      return inboundTypes.includes(type);
    }

    if (direction === 'OUTBOUND') {
      return outboundTypes.includes(type);
    }

    if (direction === 'NEUTRAL') {
      return neutralTypes.includes(type);
    }

    return false;
  }
}
