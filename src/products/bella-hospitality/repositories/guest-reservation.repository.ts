/**
 * Bella Hospitality Phase 2 - Guest + Reservation repository.
 *
 * This repository is product-owned and talks only to Platform Party identity
 * and Hospitality product tables.
 */

import type { HospitalitySqlClient } from './property-room.repository';
import type {
  CreateGuestInput,
  CreateReservationInput,
  CreateReservationRoomInput,
  HospitalityGuest,
  HospitalityGuestStatus,
  HospitalityReservation,
  HospitalityReservationRoom,
  HospitalityReservationRoomStatus,
  HospitalityReservationStatus,
} from '../types/guest-reservation.types';

export interface HospitalityGuestReservationRepositoryPort {
  createGuest(input: CreateGuestInput): Promise<HospitalityGuest>;
  createReservation(input: CreateReservationInput): Promise<HospitalityReservation>;
  createReservationRoom(input: CreateReservationRoomInput): Promise<HospitalityReservationRoom>;
  getReservation(tenantId: string, reservationId: string): Promise<HospitalityReservation | null>;
  listReservationsByProperty(tenantId: string, propertyId: string): Promise<HospitalityReservation[]>;
}

type GuestRow = {
  id: string;
  tenant_id: string;
  party_id: string;
  status: HospitalityGuestStatus;
  preferences: unknown;
  notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type ReservationRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  guest_id: string;
  reservation_code: string;
  status: HospitalityReservationStatus;
  check_in_date: unknown;
  check_out_date: unknown;
  adults: unknown;
  children: unknown;
  notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type ReservationRoomRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  reservation_id: string;
  room_type_id: string;
  room_id: string;
  check_in_date: unknown;
  check_out_date: unknown;
  adults: unknown;
  children: unknown;
  status: HospitalityReservationRoomStatus;
  notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toInteger(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10);
  throw new Error(`Expected numeric database value, received ${String(value)}`);
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  throw new Error(`Expected date database value, received ${String(value)}`);
}

function toTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  throw new Error(`Expected timestamp database value, received ${String(value)}`);
}

function firstRow<Row>(rows: readonly Row[], label: string): Row {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label}: expected database row`);
  }
  return row;
}

export class HospitalityGuestReservationRepository implements HospitalityGuestReservationRepositoryPort {
  constructor(private readonly db: HospitalitySqlClient) {}

  async createGuest(input: CreateGuestInput): Promise<HospitalityGuest> {
    const result = await this.db.query<GuestRow>(
      `
        INSERT INTO public.hospitality_guests (
          tenant_id, party_id, preferences, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        input.tenantId,
        input.partyId,
        input.preferences ?? {},
        input.notes ?? null,
        input.metadata ?? {},
      ]
    );

    return this.mapGuest(firstRow(result.rows, 'createGuest'));
  }

  async createReservation(input: CreateReservationInput): Promise<HospitalityReservation> {
    const result = await this.db.query<ReservationRow>(
      `
        INSERT INTO public.hospitality_reservations (
          tenant_id, property_id, guest_id, reservation_code,
          check_in_date, check_out_date, adults, children, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.guestId,
        input.reservationCode,
        input.checkInDate,
        input.checkOutDate,
        input.adults,
        input.children ?? 0,
        input.notes ?? null,
        input.metadata ?? {},
      ]
    );

    return this.mapReservation(firstRow(result.rows, 'createReservation'));
  }

  async createReservationRoom(input: CreateReservationRoomInput): Promise<HospitalityReservationRoom> {
    const result = await this.db.query<ReservationRoomRow>(
      `
        INSERT INTO public.hospitality_reservation_rooms (
          tenant_id, property_id, reservation_id, room_type_id, room_id,
          check_in_date, check_out_date, adults, children, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.reservationId,
        input.roomTypeId,
        input.roomId,
        input.checkInDate,
        input.checkOutDate,
        input.adults,
        input.children ?? 0,
        input.notes ?? null,
        input.metadata ?? {},
      ]
    );

    return this.mapReservationRoom(firstRow(result.rows, 'createReservationRoom'));
  }

  async getReservation(tenantId: string, reservationId: string): Promise<HospitalityReservation | null> {
    const result = await this.db.query<ReservationRow>(
      `
        SELECT *
        FROM public.hospitality_reservations
        WHERE tenant_id = $1
          AND id = $2
        LIMIT 1
      `,
      [tenantId, reservationId]
    );

    const [row] = result.rows;
    return row ? this.mapReservation(row) : null;
  }

  async listReservationsByProperty(tenantId: string, propertyId: string): Promise<HospitalityReservation[]> {
    const result = await this.db.query<ReservationRow>(
      `
        SELECT *
        FROM public.hospitality_reservations
        WHERE tenant_id = $1
          AND property_id = $2
        ORDER BY check_in_date ASC, reservation_code ASC
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.mapReservation(row));
  }

  private mapGuest(row: GuestRow): HospitalityGuest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      partyId: row.party_id,
      status: row.status,
      preferences: toRecord(row.preferences),
      notes: row.notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapReservation(row: ReservationRow): HospitalityReservation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      guestId: row.guest_id,
      reservationCode: row.reservation_code,
      status: row.status,
      checkInDate: toDateString(row.check_in_date),
      checkOutDate: toDateString(row.check_out_date),
      adults: toInteger(row.adults),
      children: toInteger(row.children),
      notes: row.notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapReservationRoom(row: ReservationRoomRow): HospitalityReservationRoom {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      reservationId: row.reservation_id,
      roomTypeId: row.room_type_id,
      roomId: row.room_id,
      checkInDate: toDateString(row.check_in_date),
      checkOutDate: toDateString(row.check_out_date),
      adults: toInteger(row.adults),
      children: toInteger(row.children),
      status: row.status,
      notes: row.notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }
}
