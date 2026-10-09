/**
 * Bella Hospitality Phase 1 - Property/Room repository.
 *
 * This repository is product-owned and talks only to `hospitality_*` tables.
 */

import type {
  CreateBuildingInput,
  CreateFloorInput,
  CreatePropertyInput,
  CreateRoomInput,
  CreateRoomTypeInput,
  HospitalityBuilding,
  HospitalityFloor,
  HospitalityProperty,
  HospitalityPropertyType,
  HospitalityRecordStatus,
  HospitalityRoom,
  HospitalityRoomType,
} from '../types/property-room.types';

export interface HospitalitySqlClient {
  query<Row extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface HospitalityPropertyRoomRepositoryPort {
  createProperty(input: CreatePropertyInput): Promise<HospitalityProperty>;
  createBuilding(input: CreateBuildingInput): Promise<HospitalityBuilding>;
  createFloor(input: CreateFloorInput): Promise<HospitalityFloor>;
  createRoomType(input: CreateRoomTypeInput): Promise<HospitalityRoomType>;
  createRoom(input: CreateRoomInput): Promise<HospitalityRoom>;
  getRoom(tenantId: string, roomId: string): Promise<HospitalityRoom | null>;
  listRoomsByProperty(tenantId: string, propertyId: string): Promise<HospitalityRoom[]>;
}

type PropertyRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  legal_name: string | null;
  property_type: HospitalityPropertyType;
  timezone: string;
  status: HospitalityRecordStatus;
  address_line1: string | null;
  city: string | null;
  country_code: string;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type BuildingRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  code: string;
  name: string;
  status: HospitalityRecordStatus;
  sort_order: unknown;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type FloorRow = BuildingRow & {
  building_id: string;
  floor_number: unknown;
};

type RoomTypeRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  code: string;
  name: string;
  max_occupancy: unknown;
  base_adults: unknown;
  base_children: unknown;
  bed_config: unknown;
  status: HospitalityRecordStatus;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RoomRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  building_id: string;
  floor_id: string;
  room_type_id: string;
  room_number: string;
  display_name: string | null;
  status: HospitalityRecordStatus;
  sort_order: unknown;
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

export class HospitalityPropertyRoomRepository implements HospitalityPropertyRoomRepositoryPort {
  constructor(private readonly db: HospitalitySqlClient) {}

  async createProperty(input: CreatePropertyInput): Promise<HospitalityProperty> {
    const result = await this.db.query<PropertyRow>(
      `
        INSERT INTO public.hospitality_properties (
          tenant_id, code, name, legal_name, property_type, timezone,
          address_line1, city, country_code, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        input.tenantId,
        input.code,
        input.name,
        input.legalName ?? null,
        input.propertyType ?? 'hotel',
        input.timezone ?? 'Asia/Ho_Chi_Minh',
        input.addressLine1 ?? null,
        input.city ?? null,
        input.countryCode ?? 'VN',
        input.metadata ?? {},
      ]
    );

    return this.mapProperty(firstRow(result.rows, 'createProperty'));
  }

  async createBuilding(input: CreateBuildingInput): Promise<HospitalityBuilding> {
    const result = await this.db.query<BuildingRow>(
      `
        INSERT INTO public.hospitality_buildings (
          tenant_id, property_id, code, name, sort_order, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.code,
        input.name,
        input.sortOrder ?? 0,
        input.metadata ?? {},
      ]
    );

    return this.mapBuilding(firstRow(result.rows, 'createBuilding'));
  }

  async createFloor(input: CreateFloorInput): Promise<HospitalityFloor> {
    const result = await this.db.query<FloorRow>(
      `
        INSERT INTO public.hospitality_floors (
          tenant_id, property_id, building_id, floor_number, code, name, sort_order, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.buildingId,
        input.floorNumber,
        input.code,
        input.name,
        input.sortOrder ?? 0,
        input.metadata ?? {},
      ]
    );

    return this.mapFloor(firstRow(result.rows, 'createFloor'));
  }

  async createRoomType(input: CreateRoomTypeInput): Promise<HospitalityRoomType> {
    const result = await this.db.query<RoomTypeRow>(
      `
        INSERT INTO public.hospitality_room_types (
          tenant_id, property_id, code, name, max_occupancy,
          base_adults, base_children, bed_config, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.code,
        input.name,
        input.maxOccupancy,
        input.baseAdults ?? 2,
        input.baseChildren ?? 0,
        input.bedConfig ?? {},
        input.metadata ?? {},
      ]
    );

    return this.mapRoomType(firstRow(result.rows, 'createRoomType'));
  }

  async createRoom(input: CreateRoomInput): Promise<HospitalityRoom> {
    const result = await this.db.query<RoomRow>(
      `
        INSERT INTO public.hospitality_rooms (
          tenant_id, property_id, building_id, floor_id, room_type_id,
          room_number, display_name, sort_order, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.buildingId,
        input.floorId,
        input.roomTypeId,
        input.roomNumber,
        input.displayName ?? null,
        input.sortOrder ?? 0,
        input.metadata ?? {},
      ]
    );

    return this.mapRoom(firstRow(result.rows, 'createRoom'));
  }

  async getRoom(tenantId: string, roomId: string): Promise<HospitalityRoom | null> {
    const result = await this.db.query<RoomRow>(
      `
        SELECT *
        FROM public.hospitality_rooms
        WHERE tenant_id = $1
          AND id = $2
        LIMIT 1
      `,
      [tenantId, roomId]
    );

    const [row] = result.rows;
    return row ? this.mapRoom(row) : null;
  }

  async listRoomsByProperty(tenantId: string, propertyId: string): Promise<HospitalityRoom[]> {
    const result = await this.db.query<RoomRow>(
      `
        SELECT *
        FROM public.hospitality_rooms
        WHERE tenant_id = $1
          AND property_id = $2
        ORDER BY sort_order ASC, room_number ASC
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.mapRoom(row));
  }

  private mapProperty(row: PropertyRow): HospitalityProperty {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      legalName: row.legal_name,
      propertyType: row.property_type,
      timezone: row.timezone,
      status: row.status,
      addressLine1: row.address_line1,
      city: row.city,
      countryCode: row.country_code,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapBuilding(row: BuildingRow): HospitalityBuilding {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      code: row.code,
      name: row.name,
      status: row.status,
      sortOrder: toInteger(row.sort_order),
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapFloor(row: FloorRow): HospitalityFloor {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      buildingId: row.building_id,
      floorNumber: toInteger(row.floor_number),
      code: row.code,
      name: row.name,
      status: row.status,
      sortOrder: toInteger(row.sort_order),
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapRoomType(row: RoomTypeRow): HospitalityRoomType {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      code: row.code,
      name: row.name,
      maxOccupancy: toInteger(row.max_occupancy),
      baseAdults: toInteger(row.base_adults),
      baseChildren: toInteger(row.base_children),
      bedConfig: toRecord(row.bed_config),
      status: row.status,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapRoom(row: RoomRow): HospitalityRoom {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      buildingId: row.building_id,
      floorId: row.floor_id,
      roomTypeId: row.room_type_id,
      roomNumber: row.room_number,
      displayName: row.display_name,
      status: row.status,
      sortOrder: toInteger(row.sort_order),
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }
}
