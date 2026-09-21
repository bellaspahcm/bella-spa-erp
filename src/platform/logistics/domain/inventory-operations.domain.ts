/**
 * E7.2 Inventory Operations Domain Service
 * 
 * Coordinates multi-entity operations involving Inventory + Movement.
 * 
 * Design Principles:
 * - Pure functions (no infrastructure dependencies)
 * - Returns entity tuples (no persistence)
 * - Products orchestrate transaction boundaries
 * - NO Product workflow logic (Warehouse, Finance, etc.)
 * 
 * Responsibilities:
 * - Coordinate Inventory + Movement creation
 * - Validate cross-entity constraints
 * - Ensure both entities valid before returning
 * 
 * NOT Responsibilities:
 * - Transaction management (Product layer)
 * - Persistence orchestration (Product layer)
 * - Warehouse workflows (bin selection, putaway, QA)
 * - Finance workflows (invoicing, accounting)
 */

import { Result } from './core/result';
import { InventoryDomain } from './inventory.domain';
import { MovementDomain } from './movement.domain';
import type { Inventory, Movement } from './inventory.types';

export class InventoryOperationsDomain {
  /**
   * Reserve inventory with corresponding movement record
   * 
   * Coordinates:
   * 1. Reserve inventory (AVAILABLE → RESERVED)
   * 2. Create outbound movement record
   * 
   * Both entities must be valid. Products responsible for:
   * - Transaction boundary
   * - Persistence orchestration
   * - Rollback on failure
   * 
   * Use case: Sales order allocation, production requisition
   * 
   * NOT for: Warehouse-specific putaway, bin selection
   */
  static reserveWithMovement(
    inventory: Inventory,
    params: {
      quantity: number;
      reason: string;
      requestedBy: string;
      referenceType?: string;
      referenceId?: string;
    }
  ): Result<{ inventory: Inventory; movement: Movement }> {
    // Step 1: Reserve inventory
    const reserveResult = InventoryDomain.reserveOperation(inventory, params.quantity, {
      reason: params.reason,
      requestedBy: params.requestedBy,
    });

    if (reserveResult.isFailure) {
      return Result.fail(
        `Failed to reserve inventory: ${reserveResult.error}`,
        reserveResult.errorCode || 'RESERVATION_FAILED'
      );
    }

    const reservedInventory = reserveResult.value!;

    // Step 2: Create outbound movement
    // Generate movement number (E7.1 frozen contract requires this)
    const movementNumber = `MV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const movementResult = MovementDomain.create({
      movementNumber,
      tenantId: inventory.tenantId,
      itemId: inventory.itemId,
      fromLocationId: inventory.locationId,
      toLocationId: null, // Outbound reservation (not yet shipped)
      quantity: params.quantity,
      unitOfMeasure: inventory.uomId,
      direction: 'OUTBOUND',
      movementType: 'ISSUE', // E7.1 frozen enum - use ISSUE for reservation
      sourceDocumentType: params.referenceType || 'INVENTORY_RESERVATION',
      sourceDocumentId: params.referenceId || reservedInventory.id,
      notes: params.reason,
    });

    if (movementResult.isFailure) {
      return Result.fail(
        `Failed to create movement: ${movementResult.error}`,
        movementResult.errorCode || 'MOVEMENT_CREATION_FAILED'
      );
    }

    return Result.ok({
      inventory: reservedInventory,
      movement: movementResult.value!,
    });
  }

  /**
   * Ship inventory with corresponding movement record
   * 
   * Coordinates:
   * 1. Ship inventory (RESERVED → IN_TRANSIT)
   * 2. Create transfer movement record
   * 
   * Use case: Fulfillment, inter-location transfer
   */
  static shipWithMovement(
    inventory: Inventory,
    params: {
      toLocationId: string;
      shippedBy: string;
      shippedAt: Date;
      referenceType?: string;
      referenceId?: string;
    }
  ): Result<{ inventory: Inventory; movement: Movement }> {
    // Step 1: Ship inventory
    const shipResult = InventoryDomain.shipOperation(inventory, {
      shippedBy: params.shippedBy,
      shippedAt: params.shippedAt,
    });

    if (shipResult.isFailure) {
      return Result.fail(
        `Failed to ship inventory: ${shipResult.error}`,
        shipResult.errorCode || 'SHIPMENT_FAILED'
      );
    }

    const shippedInventory = shipResult.value!;

    // Step 2: Create transfer movement
    // Generate movement number (E7.1 frozen contract requires this)
    const movementNumber = `MV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const movementResult = MovementDomain.create({
      movementNumber,
      tenantId: inventory.tenantId,
      itemId: inventory.itemId,
      fromLocationId: inventory.locationId,
      toLocationId: params.toLocationId,
      quantity: inventory.quantityReserved, // Ship reserved quantity
      unitOfMeasure: inventory.uomId,
      direction: 'OUTBOUND',
      movementType: 'SHIPMENT', // E7.1 frozen enum
      sourceDocumentType: params.referenceType || 'INVENTORY_SHIPMENT',
      sourceDocumentId: params.referenceId || shippedInventory.id,
      notes: `Shipped by ${params.shippedBy}`,
    });

    if (movementResult.isFailure) {
      return Result.fail(
        `Failed to create movement: ${movementResult.error}`,
        movementResult.errorCode || 'MOVEMENT_CREATION_FAILED'
      );
    }

    return Result.ok({
      inventory: shippedInventory,
      movement: movementResult.value!,
    });
  }

  /**
   * Cancel reservation with corresponding reversal movement
   * 
   * Coordinates:
   * 1. Cancel inventory reservation (RESERVED → AVAILABLE)
   * 2. Create reversal movement record
   * 
   * Use case: Order cancellation, reservation expiration
   */
  static cancelWithMovement(
    inventory: Inventory,
    params: {
      quantity: number;
      reason: string;
      cancelledBy: string;
      referenceType?: string;
      referenceId?: string;
    }
  ): Result<{ inventory: Inventory; movement: Movement }> {
    // Step 1: Cancel reservation
    const cancelResult = InventoryDomain.cancelOperation(inventory, params.quantity, {
      reason: params.reason,
      cancelledBy: params.cancelledBy,
    });

    if (cancelResult.isFailure) {
      return Result.fail(
        `Failed to cancel reservation: ${cancelResult.error}`,
        cancelResult.errorCode || 'CANCELLATION_FAILED'
      );
    }

    const cancelledInventory = cancelResult.value!;

    // Step 2: Create reversal movement
    // Generate movement number (E7.1 frozen contract requires this)
    const movementNumber = `MV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const movementResult = MovementDomain.create({
      movementNumber,
      tenantId: inventory.tenantId,
      itemId: inventory.itemId,
      fromLocationId: null, // Reversal (no source)
      toLocationId: inventory.locationId,
      quantity: params.quantity,
      unitOfMeasure: inventory.uomId,
      direction: 'INBOUND',
      movementType: 'RETURN_RECEIPT', // E7.1 frozen enum - use RETURN_RECEIPT for reversal
      sourceDocumentType: params.referenceType || 'INVENTORY_CANCELLATION',
      sourceDocumentId: params.referenceId || cancelledInventory.id,
      notes: params.reason,
    });

    if (movementResult.isFailure) {
      return Result.fail(
        `Failed to create movement: ${movementResult.error}`,
        movementResult.errorCode || 'MOVEMENT_CREATION_FAILED'
      );
    }

    return Result.ok({
      inventory: cancelledInventory,
      movement: movementResult.value!,
    });
  }
}
