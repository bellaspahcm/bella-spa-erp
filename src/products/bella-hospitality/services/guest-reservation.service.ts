/**
 * Bella Hospitality Phase 2 - Guest + Reservation service.
 */

import type {
  CreateGuestInput,
  CreateGuestReservationInput,
  CreateReservationInput,
  CreateReservationRoomInput,
  HospitalityGuest,
  HospitalityGuestReservation,
  HospitalityReservation,
  HospitalityReservationRoom,
} from '../types/guest-reservation.types';
import type { HospitalityGuestReservationRepositoryPort } from '../repositories/guest-reservation.repository';

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function assertPositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertNonNegativeInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertDateRange(checkInDate: string, checkOutDate: string): void {
  assertNonEmpty('checkInDate', checkInDate);
  assertNonEmpty('checkOutDate', checkOutDate);

  const checkIn = new Date(`${checkInDate}T00:00:00.000Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    throw new Error('reservation date range must use valid ISO dates');
  }

  if (checkOut <= checkIn) {
    throw new Error('checkOutDate must be after checkInDate');
  }
}

export class HospitalityGuestReservationService {
  constructor(private readonly repository: HospitalityGuestReservationRepositoryPort) {}

  async createGuest(input: CreateGuestInput): Promise<HospitalityGuest> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('partyId', input.partyId);
    return this.repository.createGuest(input);
  }

  async createReservation(input: CreateReservationInput): Promise<HospitalityReservation> {
    const children = input.children ?? 0;

    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('guestId', input.guestId);
    assertNonEmpty('reservationCode', input.reservationCode);
    assertDateRange(input.checkInDate, input.checkOutDate);
    assertPositiveInteger('adults', input.adults);
    assertNonNegativeInteger('children', children);

    return this.repository.createReservation(input);
  }

  async createReservationRoom(input: CreateReservationRoomInput): Promise<HospitalityReservationRoom> {
    const children = input.children ?? 0;

    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('reservationId', input.reservationId);
    assertNonEmpty('roomTypeId', input.roomTypeId);
    assertNonEmpty('roomId', input.roomId);
    assertDateRange(input.checkInDate, input.checkOutDate);
    assertPositiveInteger('adults', input.adults);
    assertNonNegativeInteger('children', children);

    return this.repository.createReservationRoom(input);
  }

  async createGuestReservation(input: CreateGuestReservationInput): Promise<HospitalityGuestReservation> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);

    const guest = await this.createGuest({
      ...input.guest,
      tenantId: input.tenantId,
    });

    const reservation = await this.createReservation({
      ...input.reservation,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      guestId: guest.id,
    });

    const reservedRoom = await this.createReservationRoom({
      ...input.reservedRoom,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      reservationId: reservation.id,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      adults: reservation.adults,
      children: reservation.children,
    });

    return {
      guest,
      reservation,
      reservedRoom,
    };
  }

  async getReservation(tenantId: string, reservationId: string): Promise<HospitalityReservation | null> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('reservationId', reservationId);
    return this.repository.getReservation(tenantId, reservationId);
  }

  async listReservationsByProperty(
    tenantId: string,
    propertyId: string
  ): Promise<HospitalityReservation[]> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('propertyId', propertyId);
    return this.repository.listReservationsByProperty(tenantId, propertyId);
  }
}
