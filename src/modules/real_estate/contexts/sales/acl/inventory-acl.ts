import { ApartmentStatus } from '../../inventory/domain/apartment';

export interface InventoryApartmentView {
  apartmentId: string;
  unitCode: string;
  status: ApartmentStatus;
  price: number;
}

/**
 * Sales Bounded Context ACL for Inventory.
 * Isolates Sales domain logic from Inventory internal entity structures.
 */
export class InventoryACL {
  static canReserveApartment(apartment: InventoryApartmentView): boolean {
    return apartment.status === 'available';
  }
}
