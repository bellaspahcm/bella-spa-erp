/**
 * Bella Hospitality Phase 2 - Guest + Reservation types.
 *
 * Scope: Guest, Reservation, Reserved Room.
 */

export type HospitalityGuestStatus = 'active' | 'inactive';
export type HospitalityReservationStatus = 'confirmed' | 'cancelled';
export type HospitalityReservationRoomStatus = 'reserved' | 'cancelled';

export interface HospitalityGuest {
  readonly id: string;
  readonly tenantId: string;
  readonly partyId: string;
  readonly status: HospitalityGuestStatus;
  readonly preferences: Record<string, unknown>;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityReservation {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly guestId: string;
  readonly reservationCode: string;
  readonly status: HospitalityReservationStatus;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly children: number;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityReservationRoom {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly reservationId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly children: number;
  readonly status: HospitalityReservationRoomStatus;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateGuestInput {
  readonly tenantId: string;
  readonly partyId: string;
  readonly preferences?: Record<string, unknown>;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateReservationInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly guestId: string;
  readonly reservationCode: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly children?: number;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateReservationRoomInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly reservationId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly children?: number;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateGuestReservationInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly guest: Omit<CreateGuestInput, 'tenantId'>;
  readonly reservation: Omit<CreateReservationInput, 'tenantId' | 'propertyId' | 'guestId'>;
  readonly reservedRoom: Omit<
    CreateReservationRoomInput,
    'tenantId' | 'propertyId' | 'reservationId' | 'checkInDate' | 'checkOutDate' | 'adults' | 'children'
  >;
}

export interface HospitalityGuestReservation {
  readonly guest: HospitalityGuest;
  readonly reservation: HospitalityReservation;
  readonly reservedRoom: HospitalityReservationRoom;
}
