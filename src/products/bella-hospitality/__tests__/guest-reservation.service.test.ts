import { describe, expect, it } from '@jest/globals';

import { HospitalityGuestReservationService } from '../services/guest-reservation.service';
import type { HospitalityGuestReservationRepositoryPort } from '../repositories/guest-reservation.repository';
import type {
  CreateGuestInput,
  CreateReservationInput,
  CreateReservationRoomInput,
  HospitalityGuest,
  HospitalityReservation,
  HospitalityReservationRoom,
} from '../types/guest-reservation.types';

const NOW = '2026-10-08T00:00:00.000Z';

class FakeGuestReservationRepository implements HospitalityGuestReservationRepositoryPort {
  readonly created: string[] = [];
  private reservation: HospitalityReservation | null = null;

  async createGuest(input: CreateGuestInput): Promise<HospitalityGuest> {
    this.created.push('guest');
    return {
      id: 'guest-1',
      tenantId: input.tenantId,
      partyId: input.partyId,
      status: 'active',
      preferences: input.preferences ?? {},
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async createReservation(input: CreateReservationInput): Promise<HospitalityReservation> {
    this.created.push('reservation');
    this.reservation = {
      id: 'reservation-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      guestId: input.guestId,
      reservationCode: input.reservationCode,
      status: 'confirmed',
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      adults: input.adults,
      children: input.children ?? 0,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    return this.reservation;
  }

  async createReservationRoom(input: CreateReservationRoomInput): Promise<HospitalityReservationRoom> {
    this.created.push('reservedRoom');
    return {
      id: 'reserved-room-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      reservationId: input.reservationId,
      roomTypeId: input.roomTypeId,
      roomId: input.roomId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      adults: input.adults,
      children: input.children ?? 0,
      status: 'reserved',
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async getReservation(tenantId: string, reservationId: string): Promise<HospitalityReservation | null> {
    return this.reservation?.tenantId === tenantId && this.reservation.id === reservationId
      ? this.reservation
      : null;
  }

  async listReservationsByProperty(tenantId: string, propertyId: string): Promise<HospitalityReservation[]> {
    return this.reservation?.tenantId === tenantId && this.reservation.propertyId === propertyId
      ? [this.reservation]
      : [];
  }
}

describe('HospitalityGuestReservationService', () => {
  it('creates the Phase 2 Guest -> Reservation -> Reserved Room chain in order', async () => {
    const repository = new FakeGuestReservationRepository();
    const service = new HospitalityGuestReservationService(repository);

    const chain = await service.createGuestReservation({
      tenantId: 'tenant-hospitality',
      propertyId: 'property-1',
      guest: {
        partyId: 'party-1',
        preferences: { pillow: 'soft' },
      },
      reservation: {
        reservationCode: 'RSV-001',
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-03',
        adults: 2,
        children: 0,
      },
      reservedRoom: {
        roomTypeId: 'room-type-1',
        roomId: 'room-101',
      },
    });

    expect(repository.created).toEqual(['guest', 'reservation', 'reservedRoom']);
    expect(chain.guest.tenantId).toBe('tenant-hospitality');
    expect(chain.reservation.guestId).toBe(chain.guest.id);
    expect(chain.reservedRoom.reservationId).toBe(chain.reservation.id);
    expect(chain.reservedRoom.roomId).toBe('room-101');
    expect(chain.reservedRoom.checkInDate).toBe(chain.reservation.checkInDate);
    expect(chain.reservedRoom.checkOutDate).toBe(chain.reservation.checkOutDate);
  });

  it('rejects invalid reservation date ranges before persistence', async () => {
    const service = new HospitalityGuestReservationService(new FakeGuestReservationRepository());

    await expect(
      service.createReservation({
        tenantId: 'tenant-hospitality',
        propertyId: 'property-1',
        guestId: 'guest-1',
        reservationCode: 'BAD-DATE',
        checkInDate: '2026-11-03',
        checkOutDate: '2026-11-03',
        adults: 1,
      })
    ).rejects.toThrow('checkOutDate must be after checkInDate');
  });

  it('keeps tenant-scoped reservation reads explicit', async () => {
    const repository = new FakeGuestReservationRepository();
    const service = new HospitalityGuestReservationService(repository);
    const chain = await service.createGuestReservation({
      tenantId: 'tenant-a',
      propertyId: 'property-a',
      guest: { partyId: 'party-a' },
      reservation: {
        reservationCode: 'RSV-A',
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-02',
        adults: 1,
      },
      reservedRoom: {
        roomTypeId: 'room-type-a',
        roomId: 'room-a',
      },
    });

    await expect(service.getReservation('tenant-a', chain.reservation.id)).resolves.toBeDefined();
    await expect(service.getReservation('tenant-b', chain.reservation.id)).resolves.toBeNull();
  });
});
