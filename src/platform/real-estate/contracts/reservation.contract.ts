/**
 * Real Estate Kernel — Reservation Public Contract
 *
 * Defines the public transaction contract for placing property units on hold (reservations).
 *
 * @module platform/real-estate/contracts/reservation.contract
 */

export interface ReservationParams {
  tenantId: string;
  productId: string;
  userId: string;
  customerId: string;
  durationMinutes: number;
}

export interface ReservationResultDTO {
  success: boolean;
  reservationId?: string;
  expiresAt?: string;
  error?: string;
}

export interface IReservationContract {
  /**
   * Reserves a unit, setting state to HELD and recording temporal timelines.
   */
  reserveProduct(params: ReservationParams): Promise<ReservationResultDTO>;

  /**
   * Releases an active reservation, returning status to AVAILABLE.
   */
  releaseProduct(tenantId: string, productId: string, reservationId: string): Promise<void>;
}
