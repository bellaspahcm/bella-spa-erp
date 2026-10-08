/**
 * Bella Hospitality Phase 3 - Front Office / Stay repository.
 *
 * This repository is product-owned and talks only to Hospitality product tables.
 */

import type { HospitalitySqlClient } from './property-room.repository';
import type {
  CheckInInput,
  CheckOutInput,
  HospitalityFrontOfficeStay,
  HospitalityRoomOccupancy,
  HospitalityRoomOccupancyStatus,
  HospitalityStay,
  HospitalityStayStatus,
} from '../types/front-office-stay.types';

export interface HospitalityFrontOfficeStayRepositoryPort {
  checkIn(input: CheckInInput): Promise<HospitalityFrontOfficeStay>;
  checkOut(input: CheckOutInput): Promise<HospitalityFrontOfficeStay>;
  getStay(tenantId: string, stayId: string): Promise<HospitalityStay | null>;
}

type StayRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  reservation_id: string;
  guest_id: string;
  status: HospitalityStayStatus;
  checked_in_at: unknown;
  checked_out_at: unknown;
  notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type OccupancyRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  stay_id: string;
  reservation_room_id: string;
  room_id: string;
  status: HospitalityRoomOccupancyStatus;
  occupied_at: unknown;
  released_at: unknown;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  throw new Error(`Expected timestamp database value, received ${String(value)}`);
}

function toNullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  return toTimestamp(value);
}

function firstRow<Row>(rows: readonly Row[], label: string): Row {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label}: expected database row`);
  }
  return row;
}

export class HospitalityFrontOfficeStayRepository implements HospitalityFrontOfficeStayRepositoryPort {
  constructor(private readonly db: HospitalitySqlClient) {}

  async checkIn(input: CheckInInput): Promise<HospitalityFrontOfficeStay> {
    await this.db.query('BEGIN');
    try {
      const stayResult = await this.db.query<StayRow>(
        `
          INSERT INTO public.hospitality_stays (
            tenant_id, property_id, reservation_id, guest_id,
            checked_in_at, notes, metadata
          )
          VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7)
          RETURNING *
        `,
        [
          input.tenantId,
          input.propertyId,
          input.reservationId,
          input.guestId,
          input.checkedInAt ?? null,
          input.notes ?? null,
          input.metadata ?? {},
        ]
      );

      const stay = this.mapStay(firstRow(stayResult.rows, 'checkIn stay'));

      const occupancyResult = await this.db.query<OccupancyRow>(
        `
          INSERT INTO public.hospitality_room_occupancies (
            tenant_id, property_id, stay_id, reservation_room_id,
            room_id, occupied_at, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)
          RETURNING *
        `,
        [
          input.tenantId,
          input.propertyId,
          stay.id,
          input.reservationRoomId,
          input.roomId,
          stay.checkedInAt,
          input.metadata ?? {},
        ]
      );

      const occupancy = this.mapOccupancy(firstRow(occupancyResult.rows, 'checkIn occupancy'));
      await this.db.query('COMMIT');
      return { stay, occupancy };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async checkOut(input: CheckOutInput): Promise<HospitalityFrontOfficeStay> {
    await this.db.query('BEGIN');
    try {
      const stayResult = await this.db.query<StayRow>(
        `
          UPDATE public.hospitality_stays
          SET status = 'completed',
              checked_out_at = COALESCE($3::timestamptz, NOW())
          WHERE tenant_id = $1
            AND id = $2
            AND status = 'active'
          RETURNING *
        `,
        [input.tenantId, input.stayId, input.checkedOutAt ?? null]
      );
      const stay = this.mapStay(firstRow(stayResult.rows, 'checkOut stay'));

      const occupancyResult = await this.db.query<OccupancyRow>(
        `
          UPDATE public.hospitality_room_occupancies
          SET status = 'released',
              released_at = $3::timestamptz
          WHERE tenant_id = $1
            AND stay_id = $2
            AND status = 'occupied'
          RETURNING *
        `,
        [input.tenantId, stay.id, stay.checkedOutAt]
      );
      const occupancy = this.mapOccupancy(firstRow(occupancyResult.rows, 'checkOut occupancy'));

      await this.db.query('COMMIT');
      return { stay, occupancy };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getStay(tenantId: string, stayId: string): Promise<HospitalityStay | null> {
    const result = await this.db.query<StayRow>(
      `
        SELECT *
        FROM public.hospitality_stays
        WHERE tenant_id = $1
          AND id = $2
        LIMIT 1
      `,
      [tenantId, stayId]
    );

    const [row] = result.rows;
    return row ? this.mapStay(row) : null;
  }

  private mapStay(row: StayRow): HospitalityStay {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      reservationId: row.reservation_id,
      guestId: row.guest_id,
      status: row.status,
      checkedInAt: toTimestamp(row.checked_in_at),
      checkedOutAt: toNullableTimestamp(row.checked_out_at),
      notes: row.notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapOccupancy(row: OccupancyRow): HospitalityRoomOccupancy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      stayId: row.stay_id,
      reservationRoomId: row.reservation_room_id,
      roomId: row.room_id,
      status: row.status,
      occupiedAt: toTimestamp(row.occupied_at),
      releasedAt: toNullableTimestamp(row.released_at),
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }
}
