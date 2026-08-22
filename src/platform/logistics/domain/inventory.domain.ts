/**
 * Inventory Domain Kernel
 * 
 * Pure business logic for inventory balance management.
 * Zero dependencies on infrastructure.
 * 
 * Responsibilities:
 * - Inventory balance calculations
 * - Reservation/allocation logic
 * - Availability computations
 * - Status transitions
 */

import { Result } from './core/result';
import type {
  Inventory,
  CreateInventoryProps,
  UpdateInventoryQuantityProps,
  ReserveInventoryProps,
  ReleaseReservationProps,
  InventoryStatus,
  LocationType,
} from './inventory.types';

export class InventoryDomain {
  /**
   * Create new inventory record
   * 
   * Invariants:
   * - Quantity on hand >= 0
   * - Quantity reserved >= 0
   * - Quantity reserved <= quantity on hand
   * - Available = on hand - reserved
   */
  static create(props: CreateInventoryProps): Result<Inventory> {
    // Quantity validations
    if (props.quantityOnHand < 0) {
      return Result.fail(
        'Quantity on hand cannot be negative',
        'INVENTORY_QUANTITY_ON_HAND_NEGATIVE'
      );
    }

    const quantityReserved = props.quantityReserved || 0;
    
    if (quantityReserved < 0) {
      return Result.fail(
        'Quantity reserved cannot be negative',
        'INVENTORY_QUANTITY_RESERVED_NEGATIVE'
      );
    }

    if (quantityReserved > props.quantityOnHand) {
      return Result.fail(
        'Quantity reserved cannot exceed quantity on hand',
        'INVENTORY_RESERVED_EXCEEDS_ON_HAND'
      );
    }

    // Traceability validation
    if (props.serialNumber && !props.lotNumber) {
      return Result.fail(
        'Serial number requires lot number',
        'INVENTORY_SERIAL_REQUIRES_LOT'
      );
    }

    const now = new Date();

    const inventory: Inventory = {
      id: props.id || crypto.randomUUID(),
      tenantId: props.tenantId,
      itemId: props.itemId,
      locationId: props.locationId,
      locationType: props.locationType,
      
      quantityOnHand: props.quantityOnHand,
      quantityReserved,
      quantityAvailable: props.quantityOnHand - quantityReserved,
      
      lotNumber: props.lotNumber || null,
      serialNumber: props.serialNumber || null,
      expiryDate: props.expiryDate || null,
      
      status: props.status || 'AVAILABLE',
      
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(inventory);
  }

  /**
   * Update inventory quantity (typically from movement)
   * 
   * Maintains invariant: reserved <= on_hand
   */
  static updateQuantity(
    inventory: Inventory,
    props: UpdateInventoryQuantityProps
  ): Result<Inventory> {
    const newQuantityOnHand = props.quantityOnHand;
    const newQuantityReserved = props.quantityReserved !== undefined 
      ? props.quantityReserved 
      : inventory.quantityReserved;

    // Validations
    if (newQuantityOnHand < 0) {
      return Result.fail(
        'Quantity on hand cannot be negative',
        'INVENTORY_QUANTITY_ON_HAND_NEGATIVE'
      );
    }

    if (newQuantityReserved < 0) {
      return Result.fail(
        'Quantity reserved cannot be negative',
        'INVENTORY_QUANTITY_RESERVED_NEGATIVE'
      );
    }

    if (newQuantityReserved > newQuantityOnHand) {
      return Result.fail(
        `Quantity reserved (${newQuantityReserved}) cannot exceed quantity on hand (${newQuantityOnHand})`,
        'INVENTORY_RESERVED_EXCEEDS_ON_HAND'
      );
    }

    const updated: Inventory = {
      ...inventory,
      quantityOnHand: newQuantityOnHand,
      quantityReserved: newQuantityReserved,
      quantityAvailable: newQuantityOnHand - newQuantityReserved,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Reserve inventory (soft allocation)
   * 
   * Reduces available quantity without physical movement.
   * Used when order is placed but not yet picked/shipped.
   * 
   * E7.1 implementation - basic reservation logic
   */
  static reserveQuantity(
    inventory: Inventory,
    props: ReserveInventoryProps
  ): Result<Inventory> {
    if (props.quantity <= 0) {
      return Result.fail(
        'Reservation quantity must be positive',
        'INVENTORY_RESERVE_QUANTITY_INVALID'
      );
    }

    const newQuantityReserved = inventory.quantityReserved + props.quantity;

    if (newQuantityReserved > inventory.quantityOnHand) {
      return Result.fail(
        `Insufficient inventory to reserve ${props.quantity} (available: ${inventory.quantityAvailable})`,
        'INVENTORY_INSUFFICIENT_FOR_RESERVATION'
      );
    }

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newQuantityReserved,
      quantityAvailable: inventory.quantityOnHand - newQuantityReserved,
      status: newQuantityReserved === inventory.quantityOnHand ? 'RESERVED' : inventory.status,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Reserve inventory (E7.1 basic primitive)
   * 
   * Basic reservation logic without operational constraints.
   * For operational semantics with state machine, use reserveOperation().
   * 
   * Reduces available quantity without physical movement.
   * Used when order is placed but not yet picked/shipped.
   */
  static reserve(
    inventory: Inventory,
    props: ReserveInventoryProps
  ): Result<Inventory> {
    if (props.quantity <= 0) {
      return Result.fail(
        'Reservation quantity must be positive',
        'INVENTORY_RESERVE_QUANTITY_INVALID'
      );
    }

    const newQuantityReserved = inventory.quantityReserved + props.quantity;

    if (newQuantityReserved > inventory.quantityOnHand) {
      return Result.fail(
        `Insufficient inventory to reserve ${props.quantity} (available: ${inventory.quantityAvailable})`,
        'INVENTORY_INSUFFICIENT_FOR_RESERVATION'
      );
    }

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newQuantityReserved,
      quantityAvailable: inventory.quantityOnHand - newQuantityReserved,
      status: newQuantityReserved === inventory.quantityOnHand ? 'RESERVED' : inventory.status,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Reserve inventory with operational semantics (E7.2 operational method)
   * 
   * Full operational semantics with state machine integration.
   * For basic reservation without operational constraints, use reserve().
   * 
   * Preconditions:
   * - Inventory must be in AVAILABLE status
   * - Quantity must be positive
   * - Sufficient available quantity
   * 
   * Postconditions:
   * - Inventory status transitions to RESERVED (if fully reserved) or stays AVAILABLE
   * - Quantity reserved increases
   * - Quantity available decreases
   * 
   * Invariants preserved:
   * - reserved + available = on_hand
   * - reserved <= on_hand
   */
  static reserveOperation(
    inventory: Inventory,
    quantity: number,
    context: { reason: string; requestedBy: string }
  ): Result<Inventory> {
    // Operational invariant: quantity must be positive
    if (quantity <= 0) {
      return Result.fail(
        'Reservation quantity must be positive',
        'INVENTORY_RESERVE_QUANTITY_INVALID'
      );
    }

    // Operational invariant: can only reserve AVAILABLE inventory
    if (inventory.status !== 'AVAILABLE') {
      return Result.fail(
        `Cannot reserve inventory in ${inventory.status} status (must be AVAILABLE)`,
        'INVENTORY_INVALID_STATUS_FOR_RESERVE'
      );
    }

    // Operational invariant: sufficient quantity available
    if (quantity > inventory.quantityAvailable) {
      return Result.fail(
        `Insufficient inventory to reserve ${quantity} (available: ${inventory.quantityAvailable})`,
        'INVENTORY_INSUFFICIENT_QUANTITY'
      );
    }

    // Calculate new quantities
    const newQuantityReserved = inventory.quantityReserved + quantity;
    const newQuantityAvailable = inventory.quantityOnHand - newQuantityReserved;

    // Determine new status
    const newStatus: InventoryStatus = newQuantityAvailable === 0 ? 'RESERVED' : 'AVAILABLE';

    // Check state transition is valid
    if (newStatus !== inventory.status) {
      const transitionCheck = this.canTransitionTo(inventory, newStatus);
      if (transitionCheck.isFailure) {
        return Result.fail(
          `State transition not allowed: ${transitionCheck.error}`,
          transitionCheck.errorCode || 'INVENTORY_INVALID_TRANSITION'
        );
      }
    }

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newQuantityReserved,
      quantityAvailable: newQuantityAvailable,
      status: newStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Ship inventory (E7.2 operational method)
   * 
   * Transitions inventory from RESERVED to IN_TRANSIT.
   * Represents physical movement initiation.
   * 
   * Preconditions:
   * - Inventory must be in RESERVED status
   * - Must have reserved quantity
   * 
   * Postconditions:
   * - Status transitions to TRANSIT (IN_TRANSIT)
   * - Reserved quantity moves to in-transit tracking
   */
  static shipOperation(inventory: Inventory): Result<Inventory> {
    // Operational invariant: can only ship RESERVED inventory
    if (inventory.status !== 'RESERVED') {
      return Result.fail(
        `Cannot ship inventory in ${inventory.status} status (must be RESERVED)`,
        'INVENTORY_INVALID_STATUS_FOR_SHIP'
      );
    }

    // Operational invariant: must have reserved quantity to ship
    if (inventory.quantityReserved === 0) {
      return Result.fail(
        'Cannot ship inventory with no reserved quantity',
        'INVENTORY_NO_RESERVED_QUANTITY'
      );
    }

    // Check state transition is valid
    const transitionCheck = this.canTransitionTo(inventory, 'TRANSIT');
    if (transitionCheck.isFailure) {
      return Result.fail(
        `State transition not allowed: ${transitionCheck.error}`,
        transitionCheck.errorCode || 'INVENTORY_INVALID_TRANSITION'
      );
    }

    const updated: Inventory = {
      ...inventory,
      status: 'TRANSIT',
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Cancel reservation (E7.2 operational method)
   * 
   * Releases reserved quantity back to available.
   * Represents order cancellation or reservation expiry.
   * 
   * Preconditions:
   * - Must have reserved quantity
   * - Quantity to cancel must not exceed reserved
   * 
   * Postconditions:
   * - Reserved quantity decreases
   * - Available quantity increases
   * - Status may transition from RESERVED to AVAILABLE (if fully released)
   */
  static cancelOperation(
    inventory: Inventory,
    quantity: number,
    reason: string
  ): Result<Inventory> {
    // Operational invariant: quantity must be positive
    if (quantity <= 0) {
      return Result.fail(
        'Cancel quantity must be positive',
        'INVENTORY_CANCEL_QUANTITY_INVALID'
      );
    }

    // Operational invariant: cannot cancel more than reserved
    if (quantity > inventory.quantityReserved) {
      return Result.fail(
        `Cannot cancel ${quantity} units (only ${inventory.quantityReserved} reserved)`,
        'INVENTORY_CANCEL_EXCEEDS_RESERVED'
      );
    }

    // Operational invariant: can only cancel RESERVED or AVAILABLE inventory
    if (inventory.status !== 'RESERVED' && inventory.status !== 'AVAILABLE') {
      return Result.fail(
        `Cannot cancel reservation for inventory in ${inventory.status} status`,
        'INVENTORY_INVALID_STATUS_FOR_CANCEL'
      );
    }

    // Calculate new quantities
    const newQuantityReserved = inventory.quantityReserved - quantity;
    const newQuantityAvailable = inventory.quantityOnHand - newQuantityReserved;

    // Determine new status (transition to AVAILABLE if no reservations left)
    const newStatus: InventoryStatus = newQuantityReserved === 0 && inventory.status === 'RESERVED'
      ? 'AVAILABLE'
      : inventory.status;

    // Check state transition if status changes
    if (newStatus !== inventory.status) {
      const transitionCheck = this.canTransitionTo(inventory, newStatus);
      if (transitionCheck.isFailure) {
        return Result.fail(
          `State transition not allowed: ${transitionCheck.error}`,
          transitionCheck.errorCode || 'INVENTORY_INVALID_TRANSITION'
        );
      }
    }

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newQuantityReserved,
      quantityAvailable: newQuantityAvailable,
      status: newStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Expire inventory (E7.2 operational method)
   * 
   * Marks inventory as EXPIRED. Must go through QUARANTINE first.
   * Terminal state - cannot be reversed.
   * 
   * Preconditions:
   * - Inventory must be in QUARANTINE status
   * - Cannot have reserved quantity
   * 
   * Postconditions:
   * - Status transitions to EXPIRED (terminal)
   * - Inventory becomes unusable
   */
  static expireOperation(inventory: Inventory): Result<Inventory> {
    // Operational invariant: can only expire QUARANTINE inventory
    if (inventory.status !== 'QUARANTINE') {
      return Result.fail(
        `Cannot expire inventory in ${inventory.status} status (must be QUARANTINE)`,
        'INVENTORY_INVALID_STATUS_FOR_EXPIRE'
      );
    }

    // Operational invariant: cannot expire reserved inventory
    if (inventory.quantityReserved > 0) {
      return Result.fail(
        `Cannot expire inventory with ${inventory.quantityReserved} reserved units`,
        'INVENTORY_HAS_RESERVED_QUANTITY'
      );
    }

    // Check state transition is valid
    const transitionCheck = this.canTransitionTo(inventory, 'EXPIRED');
    if (transitionCheck.isFailure) {
      return Result.fail(
        `State transition not allowed: ${transitionCheck.error}`,
        transitionCheck.errorCode || 'INVENTORY_INVALID_TRANSITION'
      );
    }

    const updated: Inventory = {
      ...inventory,
      status: 'EXPIRED',
      quantityAvailable: 0, // Expired inventory has zero availability
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Check if status transition is valid
   * 
   * E7.1 method - used by E7.2 operational methods
   */
  private static canTransitionTo(
    inventory: Inventory,
    newStatus: InventoryStatus
  ): Result<void> {
    const validTransitions: Record<InventoryStatus, InventoryStatus[]> = {
      AVAILABLE: ['RESERVED', 'ALLOCATED', 'QUARANTINE', 'DAMAGED', 'BLOCKED', 'TRANSIT'],
      RESERVED: ['AVAILABLE', 'ALLOCATED', 'QUARANTINE', 'BLOCKED', 'TRANSIT'],
      ALLOCATED: ['TRANSIT', 'QUARANTINE', 'DAMAGED'],
      QUARANTINE: ['AVAILABLE', 'DAMAGED', 'EXPIRED'],
      DAMAGED: [], // Terminal
      EXPIRED: [], // Terminal
      TRANSIT: ['AVAILABLE', 'QUARANTINE'],
      BLOCKED: ['AVAILABLE', 'QUARANTINE'],
    };

    const allowed = validTransitions[inventory.status] || [];

    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${inventory.status} to ${newStatus}`,
        'INVENTORY_INVALID_STATUS_TRANSITION'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Release reservation (undo soft allocation)
   * 
   * Increases available quantity without physical movement.
   * Used when order is cancelled or reservation expires.
   */
  static releaseReservation(
    inventory: Inventory,
    props: ReleaseReservationProps
  ): Result<Inventory> {
    if (props.quantity <= 0) {
      return Result.fail(
        'Release quantity must be positive',
        'INVENTORY_RELEASE_QUANTITY_INVALID'
      );
    }

    if (props.quantity > inventory.quantityReserved) {
      return Result.fail(
        `Cannot release ${props.quantity} (only ${inventory.quantityReserved} reserved)`,
        'INVENTORY_RELEASE_EXCEEDS_RESERVED'
      );
    }

    const newQuantityReserved = inventory.quantityReserved - props.quantity;

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newQuantityReserved,
      quantityAvailable: inventory.quantityOnHand - newQuantityReserved,
      status: newQuantityReserved === 0 && inventory.status === 'RESERVED' 
        ? 'AVAILABLE' 
        : inventory.status,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Change inventory status
   * 
   * Status affects availability for allocation/reservation.
   */
  static changeStatus(
    inventory: Inventory,
    newStatus: InventoryStatus,
    reason?: string
  ): Result<Inventory> {
    const validTransitions: Record<InventoryStatus, InventoryStatus[]> = {
      AVAILABLE: ['RESERVED', 'ALLOCATED', 'QUARANTINE', 'DAMAGED', 'BLOCKED', 'TRANSIT'],
      RESERVED: ['AVAILABLE', 'ALLOCATED', 'QUARANTINE', 'BLOCKED'],
      ALLOCATED: ['TRANSIT', 'QUARANTINE', 'DAMAGED'],
      QUARANTINE: ['AVAILABLE', 'DAMAGED', 'EXPIRED'],
      DAMAGED: [], // Terminal
      EXPIRED: [], // Terminal
      TRANSIT: ['AVAILABLE', 'QUARANTINE'],
      BLOCKED: ['AVAILABLE', 'QUARANTINE'],
    };

    const allowed = validTransitions[inventory.status] || [];

    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${inventory.status} to ${newStatus}`,
        'INVENTORY_INVALID_STATUS_TRANSITION'
      );
    }

    // Cannot have reservations in DAMAGED/EXPIRED status
    if ((newStatus === 'DAMAGED' || newStatus === 'EXPIRED') && inventory.quantityReserved > 0) {
      return Result.fail(
        `Cannot mark as ${newStatus} while ${inventory.quantityReserved} units are reserved`,
        'INVENTORY_RESERVED_UNITS_PREVENT_STATUS_CHANGE'
      );
    }

    const updated: Inventory = {
      ...inventory,
      status: newStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Check if inventory is available for reservation
   */
  static isAvailableForReservation(inventory: Inventory): boolean {
    return (
      inventory.status === 'AVAILABLE' &&
      inventory.quantityAvailable > 0
    );
  }

  /**
   * Check if inventory is usable (not damaged/expired)
   */
  static isUsable(inventory: Inventory): boolean {
    return inventory.status !== 'DAMAGED' && inventory.status !== 'EXPIRED';
  }

  /**
   * Check if inventory has expired (based on expiry date)
   */
  static hasExpired(inventory: Inventory, referenceDate: Date = new Date()): boolean {
    if (!inventory.expiryDate) return false;
    
    const expiryDate = new Date(inventory.expiryDate);
    return expiryDate < referenceDate;
  }

  /**
   * Calculate days until expiry
   */
  static daysUntilExpiry(inventory: Inventory, referenceDate: Date = new Date()): number | null {
    if (!inventory.expiryDate) return null;

    const expiryDate = new Date(inventory.expiryDate);
    const diffMs = expiryDate.getTime() - referenceDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if inventory is near expiry (within threshold days)
   */
  static isNearExpiry(
    inventory: Inventory,
    thresholdDays: number = 30,
    referenceDate: Date = new Date()
  ): boolean {
    const daysUntil = this.daysUntilExpiry(inventory, referenceDate);
    if (daysUntil === null) return false;
    
    return daysUntil > 0 && daysUntil <= thresholdDays;
  }

  /**
   * Calculate allocation percentage
   */
  static getAllocationPercentage(inventory: Inventory): number {
    if (inventory.quantityOnHand === 0) return 0;
    return (inventory.quantityReserved / inventory.quantityOnHand) * 100;
  }
}
