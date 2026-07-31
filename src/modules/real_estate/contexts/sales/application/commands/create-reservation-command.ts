import { ReservationDomainModel } from '../../domain/reservation';
import { InventoryACL, InventoryApartmentView } from '../../acl/inventory-acl';

export interface CreateReservationInput {
  apartment: InventoryApartmentView;
  customerName: string;
  customerPhone: string;
  depositAmount: number;
}

export class CreateReservationCommandHandler {
  static handle(input: CreateReservationInput): ReservationDomainModel {
    if (!InventoryACL.canReserveApartment(input.apartment)) {
      throw new Error(`Apartment ${input.apartment.unitCode} is not available for reservation`);
    }

    return new ReservationDomainModel({
      id: `res-${Date.now()}`,
      apartmentId: input.apartment.apartmentId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      depositAmount: input.depositAmount,
      status: 'pending_deposit',
      createdAt: new Date().toISOString(),
    });
  }
}
