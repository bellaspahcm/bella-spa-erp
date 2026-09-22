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
import type { Inventory } from './inventory.types';
import type { InventoryMovement } from './movement.types';

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
  ): Result<{ inventory: Inventory; movement: InventoryMovement }> {
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



    const movementResult = MovementDomain.create({
      tenant_id: inventory.tenant_id,
      item_id: inventory.item_id.value,
      from_location_id: inventory.location_id.value,
      to_location_id: undefined, // Outbound reservation — not yet shipped
      quantity: params.quantity,
      unit_of_measure: 'EACH', // STOP: uomId not in canonical Inventory — defaulting to EACH pending architecture decision
      direction: 'OUTBOUND',
      movement_type: 'ISSUE',
      source_document: params.referenceId
        ? { document_type: params.referenceType || 'INVENTORY_RESERVATION', document_id: params.referenceId }
        : undefined,
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
  ): Result<{ inventory: Inventory; movement: InventoryMovement }> {
    // Step 1: Ship inventory
    const shipResult = InventoryDomain.shipOperation(inventory); // canonical: (inventory: Inventory) — no extra params

    if (shipResult.isFailure) {
      return Result.fail(
        `Failed to ship inventory: ${shipResult.error}`,
        shipResult.errorCode || 'SHIPMENT_FAILED'
      );
    }

    const shippedInventory = shipResult.value!;


    const movementResult = MovementDomain.create({
      tenant_id: inventory.tenant_id,
      item_id: inventory.item_id.value,
      from_location_id: inventory.location_id.value,
      to_location_id: params.toLocationId,
      quantity: inventory.quantity_reserved, // Ship reserved quantity
      unit_of_measure: 'EACH', // STOP: uomId not in canonical Inventory — defaulting to EACH pending architecture decision
      direction: 'OUTBOUND',
      movement_type: 'SHIPMENT',
      source_document: params.referenceId
        ? { document_type: params.referenceType || 'INVENTORY_SHIPMENT', document_id: params.referenceId }
        : undefined,
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
  ): Result<{ inventory: Inventory; movement: InventoryMovement }> {
    // Step 1: Cancel reservation
    const cancelResult = InventoryDomain.cancelOperation(
      inventory,
      params.quantity,
      params.reason, // canonical cancelOperation signature: (inventory, quantity, reason: string)
    );

    if (cancelResult.isFailure) {
      return Result.fail(
        `Failed to cancel reservation: ${cancelResult.error}`,
        cancelResult.errorCode || 'CANCELLATION_FAILED'
      );
    }

    const cancelledInventory = cancelResult.value!;


    const movementResult = MovementDomain.create({
      tenant_id: inventory.tenant_id,
      item_id: inventory.item_id.value,
      from_location_id: undefined, // Reversal — no source
      to_location_id: inventory.location_id.value,
      quantity: params.quantity,
      unit_of_measure: 'EACH', // STOP: uomId not in canonical Inventory — defaulting to EACH pending architecture decision
      direction: 'INBOUND',
      movement_type: 'RETURN_RECEIPT',
      source_document: params.referenceId
        ? { document_type: params.referenceType || 'INVENTORY_CANCELLATION', document_id: params.referenceId }
        : undefined,
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
