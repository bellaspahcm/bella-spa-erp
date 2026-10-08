import { describe, expect, it } from '@jest/globals';

import { HospitalityFrontOfficeStayService } from '../services/front-office-stay.service';
import type { HospitalityFrontOfficeStayRepositoryPort } from '../repositories/front-office-stay.repository';
import type {
  CheckInInput,
  CheckOutInput,
  HospitalityFrontOfficeStay,
  HospitalityStay,
} from '../types/front-office-stay.types';

const CHECKED_IN_AT = '2026-11-01T07:00:00.000Z';
const CHECKED_OUT_AT = '2026-11-03T04:00:00.000Z';

class FakeFrontOfficeStayRepository implements HospitalityFrontOfficeStayRepositoryPort {
  readonly operations: string[] = [];
  private chain: HospitalityFrontOfficeStay | null = null;

  async checkIn(input: CheckInInput): Promise<HospitalityFrontOfficeStay> {
    this.operations.push('checkIn');
    this.chain = {
      stay: {
        id: 'stay-1',
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        reservationId: input.reservationId,
        guestId: input.guestId,
        status: 'active',
        checkedInAt: input.checkedInAt ?? CHECKED_IN_AT,
        checkedOutAt: null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? {},
        createdAt: CHECKED_IN_AT,
        updatedAt: CHECKED_IN_AT,
      },
      occupancy: {
        id: 'occupancy-1',
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        stayId: 'stay-1',
        reservationRoomId: input.reservationRoomId,
        roomId: input.roomId,
        status: 'occupied',
        occupiedAt: input.checkedInAt ?? CHECKED_IN_AT,
        releasedAt: null,
        metadata: input.metadata ?? {},
        createdAt: CHECKED_IN_AT,
        updatedAt: CHECKED_IN_AT,
      },
    };
    return this.chain;
  }

  async checkOut(input: CheckOutInput): Promise<HospitalityFrontOfficeStay> {
    this.operations.push('checkOut');
    if (!this.chain || this.chain.stay.id !== input.stayId || this.chain.stay.tenantId !== input.tenantId) {
      throw new Error('stay not found');
    }

    this.chain = {
      stay: {
        ...this.chain.stay,
        status: 'completed',
        checkedOutAt: input.checkedOutAt ?? CHECKED_OUT_AT,
        updatedAt: input.checkedOutAt ?? CHECKED_OUT_AT,
      },
      occupancy: {
        ...this.chain.occupancy,
        status: 'released',
        releasedAt: input.checkedOutAt ?? CHECKED_OUT_AT,
        updatedAt: input.checkedOutAt ?? CHECKED_OUT_AT,
      },
    };
    return this.chain;
  }

  async getStay(tenantId: string, stayId: string): Promise<HospitalityStay | null> {
    return this.chain?.stay.tenantId === tenantId && this.chain.stay.id === stayId
      ? this.chain.stay
      : null;
  }
}

describe('HospitalityFrontOfficeStayService', () => {
  it('checks in to an active stay and occupied room, then checks out to completed/released', async () => {
    const repository = new FakeFrontOfficeStayRepository();
    const service = new HospitalityFrontOfficeStayService(repository);

    const checkIn = await service.checkIn({
      tenantId: 'tenant-hospitality',
      propertyId: 'property-1',
      reservationId: 'reservation-1',
      guestId: 'guest-1',
      reservationRoomId: 'reserved-room-1',
      roomId: 'room-101',
      checkedInAt: CHECKED_IN_AT,
    });

    expect(checkIn.stay.status).toBe('active');
    expect(checkIn.occupancy.status).toBe('occupied');
    expect(checkIn.occupancy.roomId).toBe('room-101');

    const checkOut = await service.checkOut({
      tenantId: 'tenant-hospitality',
      stayId: checkIn.stay.id,
      checkedOutAt: CHECKED_OUT_AT,
    });

    expect(repository.operations).toEqual(['checkIn', 'checkOut']);
    expect(checkOut.stay.status).toBe('completed');
    expect(checkOut.stay.checkedOutAt).toBe(CHECKED_OUT_AT);
    expect(checkOut.occupancy.status).toBe('released');
    expect(checkOut.occupancy.releasedAt).toBe(CHECKED_OUT_AT);
  });

  it('rejects invalid timestamps before persistence', async () => {
    const service = new HospitalityFrontOfficeStayService(new FakeFrontOfficeStayRepository());

    await expect(
      service.checkIn({
        tenantId: 'tenant-hospitality',
        propertyId: 'property-1',
        reservationId: 'reservation-1',
        guestId: 'guest-1',
        reservationRoomId: 'reserved-room-1',
        roomId: 'room-101',
        checkedInAt: 'not-a-date',
      })
    ).rejects.toThrow('checkedInAt must be a valid timestamp');
  });

  it('keeps tenant-scoped stay reads explicit', async () => {
    const repository = new FakeFrontOfficeStayRepository();
    const service = new HospitalityFrontOfficeStayService(repository);
    const chain = await service.checkIn({
      tenantId: 'tenant-a',
      propertyId: 'property-a',
      reservationId: 'reservation-a',
      guestId: 'guest-a',
      reservationRoomId: 'reserved-room-a',
      roomId: 'room-a',
    });

    await expect(service.getStay('tenant-a', chain.stay.id)).resolves.toBeDefined();
    await expect(service.getStay('tenant-b', chain.stay.id)).resolves.toBeNull();
  });
});
