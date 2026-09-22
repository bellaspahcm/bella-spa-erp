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
} from './movement.types';
import type { LocationType } from './inventory.types';

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
    // Quantity validation
    if (props.quantity <= 0) {
      return Result.fail(
        'Movement quantity must be positive',
        'MOVEMENT_QUANTITY_MUST_BE_POSITIVE'
      );
    }

    // Direction validation
    const directionResult = this.validateDirection(
      props.movement_type,
      props.direction,
      props.from_location_id,
      props.to_location_id
    );
    if (directionResult.isFailure) {
      return directionResult as Result<InventoryMovement>;
    }

    // Unit cost validation
    if (props.unit_cost !== undefined && props.unit_cost < 0) {
      return Result.fail(
        'Unit cost cannot be negative',
        'MOVEMENT_UNIT_COST_NEGATIVE'
      );
    }

    // Total cost validation
    if (props.total_cost !== undefined && props.total_cost < 0) {
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
    if (props.serial_number && !props.lot_number) {
      return Result.fail(
        'Serial number requires lot number',
        'MOVEMENT_SERIAL_REQUIRES_LOT'
      );
    }

    const now = new Date();

    // Generate movement number internally (not in CreateMovementProps)
    const movementNumber = `MOV-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const movement: InventoryMovement = {
      id: { value: crypto.randomUUID() },
      movement_number: { value: movementNumber },
      tenant_id: props.tenant_id,

      movement_date: props.movement_date || now,
      created_at: now,
      created_by: props.created_by,

      movement_type: props.movement_type,
      direction: props.direction,

      item_id: { value: props.item_id },

      from_location_id: props.from_location_id ? { value: props.from_location_id } : undefined,
      from_location_type: props.from_location_type,
      to_location_id: props.to_location_id ? { value: props.to_location_id } : undefined,
      to_location_type: props.to_location_type,

      quantity: props.quantity,
      unit_of_measure: props.unit_of_measure,

      lot_number: props.lot_number ? { value: props.lot_number } : undefined,
      serial_number: props.serial_number ? { value: props.serial_number } : undefined,
      expiry_date: props.expiry_date,

      unit_cost: props.unit_cost,
      total_cost: props.total_cost,
      currency: props.currency,

      source_document: props.source_document,

      reason: props.reason,
      notes: props.notes,

      batch_id: props.batch_id,

      approved_by: props.approved_by,
      approved_at: undefined,

      status: 'COMPLETED',
      completed_at: now,
      cancelled_at: undefined,
      cancellation_reason: undefined,
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
      approved_by: approvedBy,
      approved_at: now,
      status: 'COMPLETED',
      completed_at: now,
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
      cancelled_at: now,
      cancellation_reason: cancellationReason.trim(),
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
    if (movement.unit_cost === undefined) return null;
    return movement.unit_cost * movement.quantity;
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
    if (itemRequirements.lotTracked && !movement.lot_number) {
      return Result.fail(
        'Item requires lot tracking, but movement has no lot number',
        'MOVEMENT_LOT_NUMBER_REQUIRED'
      );
    }

    if (itemRequirements.serialTracked && !movement.serial_number) {
      return Result.fail(
        'Item requires serial tracking, but movement has no serial number',
        'MOVEMENT_SERIAL_NUMBER_REQUIRED'
      );
    }

    if (itemRequirements.expiryTracked && !movement.expiry_date) {
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
      movement.movement_type.replace(/_/g, ' '),
      `${movement.quantity} ${movement.unit_of_measure}`,
    ];

    if (movement.direction === 'INBOUND') {
      parts.push(`→ ${movement.to_location_type || 'location'}`);
    } else if (movement.direction === 'OUTBOUND') {
      parts.push(`← ${movement.from_location_type || 'location'}`);
    } else if (movement.direction === 'NEUTRAL') {
      parts.push(
        `${movement.from_location_type || 'location'} → ${movement.to_location_type || 'location'}`
      );
    }

    if (movement.lot_number) {
      parts.push(`Lot: ${movement.lot_number.value}`);
    }

    if (movement.serial_number) {
      parts.push(`S/N: ${movement.serial_number.value}`);
    }

    return parts.join(' | ');
  }
}
