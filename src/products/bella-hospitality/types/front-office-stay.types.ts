/**
 * Bella Hospitality Phase 3 - Front Office / Stay types.
 *
 * Scope: Check-in, Stay, Room Occupancy, Check-out.
 */

export type HospitalityStayStatus = 'active' | 'completed';
export type HospitalityRoomOccupancyStatus = 'occupied' | 'released';

export interface HospitalityStay {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly reservationId: string;
  readonly guestId: string;
  readonly status: HospitalityStayStatus;
  readonly checkedInAt: string;
  readonly checkedOutAt: string | null;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityRoomOccupancy {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly stayId: string;
  readonly reservationRoomId: string;
  readonly roomId: string;
  readonly status: HospitalityRoomOccupancyStatus;
  readonly occupiedAt: string;
  readonly releasedAt: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CheckInInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly reservationId: string;
  readonly guestId: string;
  readonly reservationRoomId: string;
  readonly roomId: string;
  readonly checkedInAt?: string;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CheckOutInput {
  readonly tenantId: string;
  readonly stayId: string;
  readonly checkedOutAt?: string;
}

export interface HospitalityFrontOfficeStay {
  readonly stay: HospitalityStay;
  readonly occupancy: HospitalityRoomOccupancy;
}
