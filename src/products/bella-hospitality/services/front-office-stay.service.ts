/**
 * Bella Hospitality Phase 3 - Front Office / Stay service.
 */

import type {
  CheckInInput,
  CheckOutInput,
  HospitalityFrontOfficeStay,
  HospitalityStay,
} from '../types/front-office-stay.types';
import type { HospitalityFrontOfficeStayRepositoryPort } from '../repositories/front-office-stay.repository';

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function assertTimestamp(label: string, value: string | undefined): void {
  if (!value) return;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid timestamp`);
  }
}

export class HospitalityFrontOfficeStayService {
  constructor(private readonly repository: HospitalityFrontOfficeStayRepositoryPort) {}

  async checkIn(input: CheckInInput): Promise<HospitalityFrontOfficeStay> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('reservationId', input.reservationId);
    assertNonEmpty('guestId', input.guestId);
    assertNonEmpty('reservationRoomId', input.reservationRoomId);
    assertNonEmpty('roomId', input.roomId);
    assertTimestamp('checkedInAt', input.checkedInAt);

    return this.repository.checkIn(input);
  }

  async checkOut(input: CheckOutInput): Promise<HospitalityFrontOfficeStay> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('stayId', input.stayId);
    assertTimestamp('checkedOutAt', input.checkedOutAt);

    return this.repository.checkOut(input);
  }

  async getStay(tenantId: string, stayId: string): Promise<HospitalityStay | null> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('stayId', stayId);

    return this.repository.getStay(tenantId, stayId);
  }
}
