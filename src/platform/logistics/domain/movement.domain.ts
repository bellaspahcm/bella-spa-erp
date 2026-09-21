/**
 * Inventory Movement Domain Kernel
 * 
 * Pure business logic for inventory movements (transactions).
 * Zero dependencies on infrastructure.
 * 
 * Responsibilities:
 * - Movement creation with validation
 * - Direction/type compatibility validation
 * - Quantity validation
 * - Immutability enforcement
 * - Movement approval logic
 */

import { Result } from './core/result';
import type {
  InventoryMovement,
  CreateMovementProps,
  MovementType,
  MovementDirection,
  MovementStatus,
  LocationType,
} from './movement.types';

export class MovementDomain {
  /**
   * Create new inventory movement
   * 
   * Invariants:
   * - Quantity must be positive (direction indicates increase/decrease)
   * - Direction must match movement type
   * - INBOUND requires to_location
   * - OUTBOUND requires from_location
   * - NEUTRAL requires both locations
   * - Movement number must be unique (enforced at repository layer)
   */
  static create(props: CreateMovementProps): Result<InventoryMovement> {
    // Movement number required
    if (!props.movementNumber || props.movementNumber.trim() === '') {
      return Result.fail(
        'Movement number is required',
        'MOVEMENT_NUMBER_REQUIRED'
      );
    }

    // Quantity validation
    if (props.quantity <= 0) {
      return Result.fail(
        'Movement quantity must be positive',
        'MOVEMENT_QUANTITY_MUST_BE_POSITIVE'
      );
    }

    // Direction validation
    const directionResult = this.validateDirection(
      props.movementType,
      props.direction,
      props.fromLocationId,
      props.toLocationId
    );
    if (directionResult.isFailure) {
      return directionResult as Result<InventoryMovement>;
    }

    // Unit cost validation
    if (props.unitCost !== undefined && props.unitCost < 0) {
      return Result.fail(
        'Unit cost cannot be negative',
        'MOVEMENT_UNIT_COST_NEGATIVE'
      );
    }

    // Total cost validation
    if (props.totalCost !== undefined && props.totalCost < 0) {
      return Result.fail(
        'Total cost cannot be negative',
        'MOVEMENT_TOTAL_COST_NEGATIVE'
      );
    }

    // Currency validation
    if (props.currency && !/^[A-Z]{3}$/.test(props.currency)) {
      return Result.fail(
        'Currency must be 3-letter ISO 4217 code',
        'MOVEMENT_CURRENCY_INVALID'
      );
    }

    // Traceability validation
    if (props.serialNumber && !props.lotNumber) {
      return Result.fail(
        'Serial number requires lot number',
        'MOVEMENT_SERIAL_REQUIRES_LOT'
      );
    }

    const now = new Date();

    const movement: InventoryMovement = {
      id: props.id || crypto.randomUUID(),
      movementNumber: props.movementNumber.trim(),
      tenantId: props.tenantId,
      
      movementDate: props.movementDate || now,
      createdAt: now,
      createdBy: props.createdBy || null,
      
      movementType: props.movementType,
      direction: props.direction,
      
      itemId: props.itemId,
      
      fromLocationId: props.fromLocationId || null,
      fromLocationType: props.fromLocationType || null,
      toLocationId: props.toLocationId || null,
      toLocationType: props.toLocationType || null,
      
      quantity: props.quantity,
      unitOfMeasure: props.unitOfMeasure,
      
      lotNumber: props.lotNumber || null,
      serialNumber: props.serialNumber || null,
      expiryDate: props.expiryDate || null,
      
      unitCost: props.unitCost !== undefined ? props.unitCost : null,
      totalCost: props.totalCost !== undefined ? props.totalCost : null,
      currency: props.currency || null,
      
      sourceDocumentType: props.sourceDocumentType || null,
      sourceDocumentId: props.sourceDocumentId || null,
      sourceDocumentNumber: props.sourceDocumentNumber || null,
      sourceLineItemId: props.sourceLineItemId || null,
      
      reason: props.reason || null,
      notes: props.notes || null,
      
      batchId: props.batchId || null,
      
      approvedBy: null,
      approvedAt: null,
      
      status: props.status || 'COMPLETED',
      completedAt: props.status === 'COMPLETED' ? now : null,
      cancelledAt: null,
      cancellationReason: null,
    };

    return Result.ok(movement);
  }

  /**
   * Validate direction matches movement type and locations
   */
  private static validateDirection(
    movementType: MovementType,
    direction: MovementDirection,
    fromLocationId: string | null | undefined,
    toLocationId: string | null | undefined
  ): Result<void> {
    // Get expected direction for movement type
    const expectedDirection = this.getExpectedDirection(movementType);

    if (direction !== expectedDirection) {
      return Result.fail(
        `Movement type ${movementType} requires direction ${expectedDirection}, got ${direction}`,
        'MOVEMENT_DIRECTION_TYPE_MISMATCH'
      );
    }

    // Validate locations based on direction
    if (direction === 'INBOUND' && !toLocationId) {
      return Result.fail(
        'INBOUND movement requires to_location',
        'MOVEMENT_INBOUND_REQUIRES_TO_LOCATION'
      );
    }

    if (direction === 'OUTBOUND' && !fromLocationId) {
      return Result.fail(
        'OUTBOUND movement requires from_location',
        'MOVEMENT_OUTBOUND_REQUIRES_FROM_LOCATION'
      );
    }

    if (direction === 'NEUTRAL' && (!fromLocationId || !toLocationId)) {
      return Result.fail(
        'NEUTRAL movement requires both from_location and to_location',
        'MOVEMENT_NEUTRAL_REQUIRES_BOTH_LOCATIONS'
      );
    }

    // Prevent same location transfer
    if (direction === 'NEUTRAL' && fromLocationId === toLocationId) {
      return Result.fail(
        'Cannot transfer to same location',
        'MOVEMENT_SAME_LOCATION_TRANSFER'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Get expected direction for movement type
   */
  private static getExpectedDirection(movementType: MovementType): MovementDirection {
    const inboundTypes: MovementType[] = [
      'RECEIPT',
      'RETURN_RECEIPT',
      'TRANSFER_IN',
      'PRODUCTION_OUTPUT',
      'ADJUSTMENT_INCREASE',
    ];

    const outboundTypes: MovementType[] = [
      'ISSUE',
      'SHIPMENT',
      'TRANSFER_OUT',
      'PRODUCTION_CONSUMPTION',
      'ADJUSTMENT_DECREASE',
      'DAMAGE',
      'OBSOLESCENCE',
      'THEFT',
    ];

    const neutralTypes: MovementType[] = [
      'RELOCATION',
      'STATUS_CHANGE',
      'CYCLE_COUNT',
    ];

    if (inboundTypes.includes(movementType)) return 'INBOUND';
    if (outboundTypes.includes(movementType)) return 'OUTBOUND';
    if (neutralTypes.includes(movementType)) return 'NEUTRAL';

    // Default (should not happen with proper types)
    return 'NEUTRAL';
  }

  /**
   * Approve movement
   * 
   * Only PENDING movements can be approved.
   */
  static approve(
    movement: InventoryMovement,
    approvedBy: string
  ): Result<InventoryMovement> {
    if (movement.status !== 'PENDING') {
      return Result.fail(
        `Cannot approve movement with status ${movement.status}`,
        'MOVEMENT_CANNOT_APPROVE_NON_PENDING'
      );
    }

    const now = new Date();

    const approved: InventoryMovement = {
      ...movement,
      approvedBy,
      approvedAt: now,
      status: 'COMPLETED',
      completedAt: now,
    };

    return Result.ok(approved);
  }

  /**
   * Cancel movement
   * 
   * Only PENDING movements can be cancelled.
   * COMPLETED movements are immutable.
   */
  static cancel(
    movement: InventoryMovement,
    cancellationReason: string
  ): Result<InventoryMovement> {
    if (movement.status !== 'PENDING') {
      return Result.fail(
        `Cannot cancel movement with status ${movement.status}`,
        'MOVEMENT_CANNOT_CANCEL_NON_PENDING'
      );
    }

    if (!cancellationReason || cancellationReason.trim() === '') {
      return Result.fail(
        'Cancellation reason is required',
        'MOVEMENT_CANCELLATION_REASON_REQUIRED'
      );
    }

    const now = new Date();

    const cancelled: InventoryMovement = {
      ...movement,
      status: 'CANCELLED',
      cancelledAt: now,
      cancellationReason: cancellationReason.trim(),
    };

    return Result.ok(cancelled);
  }

  /**
   * Check if movement is completed
   */
  static isCompleted(movement: InventoryMovement): boolean {
    return movement.status === 'COMPLETED';
  }

  /**
   * Check if movement is pending approval
   */
  static isPending(movement: InventoryMovement): boolean {
    return movement.status === 'PENDING';
  }

  /**
   * Check if movement is cancelled
   */
  static isCancelled(movement: InventoryMovement): boolean {
    return movement.status === 'CANCELLED';
  }

  /**
   * Check if movement can be modified (only PENDING can be modified)
   */
  static canModify(movement: InventoryMovement): boolean {
    return movement.status === 'PENDING';
  }

  /**
   * Check if movement increases inventory
   */
  static increasesInventory(movement: InventoryMovement): boolean {
    return movement.direction === 'INBOUND';
  }

  /**
   * Check if movement decreases inventory
   */
  static decreasesInventory(movement: InventoryMovement): boolean {
    return movement.direction === 'OUTBOUND';
  }

  /**
   * Check if movement is neutral (relocation, no net change)
   */
  static isNeutral(movement: InventoryMovement): boolean {
    return movement.direction === 'NEUTRAL';
  }

  /**
   * Calculate total cost if unit cost provided
   */
  static calculateTotalCost(movement: InventoryMovement): number | null {
    if (movement.unitCost === null) return null;
    return movement.unitCost * movement.quantity;
  }

  /**
   * Validate movement against item traceability requirements
   * 
   * Note: Item entity not available in pure domain (no dependency).
   * This is a helper for repository layer validation.
   */
  static validateTraceability(
    movement: InventoryMovement,
    itemRequirements: {
      lotTracked: boolean;
      serialTracked: boolean;
      expiryTracked: boolean;
    }
  ): Result<void> {
    if (itemRequirements.lotTracked && !movement.lotNumber) {
      return Result.fail(
        'Item requires lot tracking, but movement has no lot number',
        'MOVEMENT_LOT_NUMBER_REQUIRED'
      );
    }

    if (itemRequirements.serialTracked && !movement.serialNumber) {
      return Result.fail(
        'Item requires serial tracking, but movement has no serial number',
        'MOVEMENT_SERIAL_NUMBER_REQUIRED'
      );
    }

    if (itemRequirements.expiryTracked && !movement.expiryDate) {
      return Result.fail(
        'Item requires expiry tracking, but movement has no expiry date',
        'MOVEMENT_EXPIRY_DATE_REQUIRED'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Get human-readable movement description
   * 
   * NOTE: Presentation helper.
   * May move to API/presentation layer if tests show no domain-level need.
   * Do not treat this as a Logistics OS primitive.
   */
  static getDescription(movement: InventoryMovement): string {
    const parts: string[] = [
      movement.movementType.replace(/_/g, ' '),
      `${movement.quantity} ${movement.unitOfMeasure}`,
    ];

    if (movement.direction === 'INBOUND') {
      parts.push(`→ ${movement.toLocationType || 'location'}`);
    } else if (movement.direction === 'OUTBOUND') {
      parts.push(`← ${movement.fromLocationType || 'location'}`);
    } else if (movement.direction === 'NEUTRAL') {
      parts.push(
        `${movement.fromLocationType || 'location'} → ${movement.toLocationType || 'location'}`
      );
    }

    if (movement.lotNumber) {
      parts.push(`Lot: ${movement.lotNumber}`);
    }

    if (movement.serialNumber) {
      parts.push(`S/N: ${movement.serialNumber}`);
    }

    return parts.join(' | ');
  }
}
