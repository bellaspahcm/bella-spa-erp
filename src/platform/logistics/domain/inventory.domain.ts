/**
 * Inventory Domain
 * 
 * E7 Logistics Domain Kernel - Inventory Component
 * Canonical: Database['logistics']['Tables']['inventory']
 * 
 * 7 Domain Invariants:
 * 1. Quantity on hand >= 0
 * 2. Quantity reserved >= 0
 * 3. Quantity reserved <= quantity on hand
 * 4. Available = on hand - reserved (computed)
 * 5. Serial number requires lot number
 * 6. Status transitions validated
 * 7. Cannot mark DAMAGED/EXPIRED with reservations
 */

import { Result } from './core/result';
import type { Database } from '../../../shared/database.types';

// Canonical DB row type
type InventoryRow = Database['logistics']['Tables']['inventory']['Row'];

// Domain types
export type InventoryStatus = 'AVAILABLE' | 'RESERVED' | 'QUARANTINE' | 'DAMAGED' | 'EXPIRED' | 'TRANSIT';
export type LocationType = 'WAREHOUSE' | 'STORE' | 'TRANSIT' | 'VENDOR' | 'CUSTOMER';

export interface Inventory {
  id: string;
  tenantId: string;
  itemId: string;
  locationId: string;
  locationType: LocationType;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number; // Computed: onHand - reserved
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDate: Date | null;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryProps {
  tenantId: string;
  itemId: string;
  locationId: string;
  locationType: LocationType;
  quantityOnHand: number;
  quantityReserved?: number;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  status?: InventoryStatus;
}

export interface UpdateQuantityProps {
  quantityOnHand?: number;
  quantityReserved?: number;
}

export interface ReserveProps {
  quantity: number;
}

export interface ReleaseReservationProps {
  quantity: number;
}

export class InventoryDomain {
  /**
   * Create new inventory record
   * Validates all 7 domain invariants
   */
  static create(props: CreateInventoryProps): Result<Inventory> {
    const quantityOnHand = props.quantityOnHand;
    const quantityReserved = props.quantityReserved ?? 0;

    // Invariant 1: Quantity on hand >= 0
    if (quantityOnHand < 0) {
      return Result.fail('Quantity on hand cannot be negative', 'INVENTORY_QUANTITY_ON_HAND_NEGATIVE');
    }

    // Invariant 2: Quantity reserved >= 0
    if (quantityReserved < 0) {
      return Result.fail('Quantity reserved cannot be negative', 'INVENTORY_QUANTITY_RESERVED_NEGATIVE');
    }

    // Invariant 3: Quantity reserved <= quantity on hand
    if (quantityReserved > quantityOnHand) {
      return Result.fail('Quantity reserved cannot exceed quantity on hand', 'INVENTORY_RESERVED_EXCEEDS_ON_HAND');
    }

    // Invariant 5: Serial number requires lot number
    if (props.serialNumber && !props.lotNumber) {
      return Result.fail('Serial number requires lot number', 'INVENTORY_SERIAL_REQUIRES_LOT');
    }

    // Invariant 4: Available = on hand - reserved (computed)
    const quantityAvailable = quantityOnHand - quantityReserved;

    const now = new Date();
    const inventory: Inventory = {
      id: crypto.randomUUID(),
      tenantId: props.tenantId,
      itemId: props.itemId,
      locationId: props.locationId,
      locationType: props.locationType,
      quantityOnHand,
      quantityReserved,
      quantityAvailable,
      lotNumber: props.lotNumber ?? null,
      serialNumber: props.serialNumber ?? null,
      expiryDate: props.expiryDate ?? null,
      status: props.status ?? 'AVAILABLE',
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(inventory);
  }

  /**
   * Update inventory quantities
   * Re-validates invariants 1-4
   */
  static updateQuantity(
    inventory: Inventory,
    props: UpdateQuantityProps
  ): Result<Inventory> {
    const newOnHand = props.quantityOnHand ?? inventory.quantityOnHand;
    const newReserved = props.quantityReserved ?? inventory.quantityReserved;

    // Invariant 1: Quantity on hand >= 0
    if (newOnHand < 0) {
      return Result.fail('Quantity on hand cannot be negative', 'INVENTORY_QUANTITY_ON_HAND_NEGATIVE');
    }

    // Invariant 2: Quantity reserved >= 0
    if (newReserved < 0) {
      return Result.fail('Quantity reserved cannot be negative', 'INVENTORY_QUANTITY_RESERVED_NEGATIVE');
    }

    // Invariant 3: Quantity reserved <= quantity on hand
    if (newReserved > newOnHand) {
      return Result.fail(
        `Quantity reserved (${newReserved}) cannot exceed quantity on hand (${newOnHand})`,
        'INVENTORY_RESERVED_EXCEEDS_ON_HAND'
      );
    }

    // Invariant 4: Recalculate available
    const newAvailable = newOnHand - newReserved;

    const updated: Inventory = {
      ...inventory,
      quantityOnHand: newOnHand,
      quantityReserved: newReserved,
      quantityAvailable: newAvailable,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Reserve quantity from available inventory
   * Transitions to RESERVED if fully reserved
   */
  static reserve(
    inventory: Inventory,
    props: ReserveProps
  ): Result<Inventory> {
    // Validate positive quantity
    if (props.quantity <= 0) {
      return Result.fail('Reservation quantity must be positive', 'INVENTORY_RESERVATION_QUANTITY_INVALID');
    }

    // Check sufficient availability
    if (props.quantity > inventory.quantityAvailable) {
      return Result.fail(
        `Insufficient inventory to reserve ${props.quantity} (available: ${inventory.quantityAvailable})`,
        'INVENTORY_INSUFFICIENT_FOR_RESERVATION'
      );
    }

    const newReserved = inventory.quantityReserved + props.quantity;
    const newAvailable = inventory.quantityAvailable - props.quantity;

    // Transition to RESERVED if fully reserved
    const newStatus = newAvailable === 0 ? 'RESERVED' : inventory.status;

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newReserved,
      quantityAvailable: newAvailable,
      status: newStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Release reservation back to available
   * Transitions to AVAILABLE if no longer fully reserved
   */
  static releaseReservation(
    inventory: Inventory,
    props: ReleaseReservationProps
  ): Result<Inventory> {
    // Validate positive quantity
    if (props.quantity <= 0) {
      return Result.fail('Release quantity must be positive', 'INVENTORY_RELEASE_QUANTITY_INVALID');
    }

    // Check not releasing more than reserved
    if (props.quantity > inventory.quantityReserved) {
      return Result.fail(
        `Cannot release ${props.quantity} (only ${inventory.quantityReserved} reserved)`,
        'INVENTORY_RELEASE_EXCEEDS_RESERVED'
      );
    }

    const newReserved = inventory.quantityReserved - props.quantity;
    const newAvailable = inventory.quantityAvailable + props.quantity;

    // Transition to AVAILABLE if no longer fully reserved
    const newStatus = inventory.status === 'RESERVED' && newReserved < inventory.quantityOnHand 
      ? 'AVAILABLE' 
      : inventory.status;

    const updated: Inventory = {
      ...inventory,
      quantityReserved: newReserved,
      quantityAvailable: newAvailable,
      status: newStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Change inventory status
   * Validates transitions and invariant 7
   */
  static changeStatus(
    inventory: Inventory,
    targetStatus: InventoryStatus
  ): Result<Inventory> {
    // Validate transition
    const transitionValid = this.isValidTransition(inventory.status, targetStatus);
    if (!transitionValid) {
      return Result.fail(
        `Cannot transition from ${inventory.status} to ${targetStatus}`,
        'INVENTORY_INVALID_STATUS_TRANSITION'
      );
    }

    // Invariant 7: Cannot mark DAMAGED/EXPIRED with reservations
    if ((targetStatus === 'DAMAGED' || targetStatus === 'EXPIRED') && inventory.quantityReserved > 0) {
      return Result.fail(
        `Cannot mark as ${targetStatus} while ${inventory.quantityReserved} units are reserved`,
        'INVENTORY_RESERVED_UNITS_PREVENT_STATUS_CHANGE'
      );
    }

    const updated: Inventory = {
      ...inventory,
      status: targetStatus,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Check if inventory is available for new reservations
   */
  static isAvailableForReservation(inventory: Inventory): boolean {
    return inventory.status === 'AVAILABLE' && inventory.quantityAvailable > 0;
  }

  /**
   * Check if inventory has expired
   */
  static hasExpired(inventory: Inventory, asOf: Date = new Date()): boolean {
    if (!inventory.expiryDate) {
      return false;
    }
    return inventory.expiryDate < asOf;
  }

  /**
   * Validate status transition
   * Invariant 6: Status transitions validated
   */
  private static isValidTransition(from: InventoryStatus, to: InventoryStatus): boolean {
    // Same status is not a transition
    if (from === to) {
      return false;
    }

    // Define valid transitions
    const validTransitions: Record<InventoryStatus, InventoryStatus[]> = {
      AVAILABLE: ['RESERVED', 'QUARANTINE', 'DAMAGED', 'TRANSIT'],
      RESERVED: ['AVAILABLE', 'QUARANTINE', 'TRANSIT'],
      QUARANTINE: ['AVAILABLE', 'DAMAGED', 'EXPIRED'],
      DAMAGED: [],
      EXPIRED: [],
      TRANSIT: ['AVAILABLE', 'QUARANTINE'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}
