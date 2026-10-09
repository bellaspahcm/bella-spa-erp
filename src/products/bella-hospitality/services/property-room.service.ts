/**
 * Bella Hospitality Phase 1 - Hotel physical foundation service.
 */

import type {
  CreateBuildingInput,
  CreateFloorInput,
  CreatePropertyInput,
  CreatePropertyRoomFoundationInput,
  CreateRoomInput,
  CreateRoomTypeInput,
  HospitalityBuilding,
  HospitalityFloor,
  HospitalityProperty,
  HospitalityPropertyRoomFoundation,
  HospitalityRoom,
  HospitalityRoomType,
} from '../types/property-room.types';
import type { HospitalityPropertyRoomRepositoryPort } from '../repositories/property-room.repository';

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

export class HospitalityPropertyRoomService {
  constructor(private readonly repository: HospitalityPropertyRoomRepositoryPort) {}

  async createProperty(input: CreatePropertyInput): Promise<HospitalityProperty> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('property code', input.code);
    assertNonEmpty('property name', input.name);
    return this.repository.createProperty(input);
  }

  async createBuilding(input: CreateBuildingInput): Promise<HospitalityBuilding> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('building code', input.code);
    assertNonEmpty('building name', input.name);
    return this.repository.createBuilding(input);
  }

  async createFloor(input: CreateFloorInput): Promise<HospitalityFloor> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('buildingId', input.buildingId);
    assertPositiveInteger('floorNumber', input.floorNumber);
    assertNonEmpty('floor code', input.code);
    assertNonEmpty('floor name', input.name);
    return this.repository.createFloor(input);
  }

  async createRoomType(input: CreateRoomTypeInput): Promise<HospitalityRoomType> {
    const baseAdults = input.baseAdults ?? 2;
    const baseChildren = input.baseChildren ?? 0;

    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('room type code', input.code);
    assertNonEmpty('room type name', input.name);
    assertPositiveInteger('maxOccupancy', input.maxOccupancy);
    assertNonNegativeInteger('baseAdults', baseAdults);
    assertNonNegativeInteger('baseChildren', baseChildren);

    if (baseAdults + baseChildren > input.maxOccupancy) {
      throw new Error('base occupancy cannot exceed maxOccupancy');
    }

    return this.repository.createRoomType(input);
  }

  async createRoom(input: CreateRoomInput): Promise<HospitalityRoom> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('buildingId', input.buildingId);
    assertNonEmpty('floorId', input.floorId);
    assertNonEmpty('roomTypeId', input.roomTypeId);
    assertNonEmpty('roomNumber', input.roomNumber);
    return this.repository.createRoom(input);
  }

  async createPropertyRoomFoundation(
    input: CreatePropertyRoomFoundationInput
  ): Promise<HospitalityPropertyRoomFoundation> {
    assertNonEmpty('tenantId', input.tenantId);

    const property = await this.createProperty({
      ...input.property,
      tenantId: input.tenantId,
    });

    const building = await this.createBuilding({
      ...input.building,
      tenantId: input.tenantId,
      propertyId: property.id,
    });

    const floor = await this.createFloor({
      ...input.floor,
      tenantId: input.tenantId,
      propertyId: property.id,
      buildingId: building.id,
    });

    const roomType = await this.createRoomType({
      ...input.roomType,
      tenantId: input.tenantId,
      propertyId: property.id,
    });

    const room = await this.createRoom({
      ...input.room,
      tenantId: input.tenantId,
      propertyId: property.id,
      buildingId: building.id,
      floorId: floor.id,
      roomTypeId: roomType.id,
    });

    return {
      property,
      building,
      floor,
      roomType,
      room,
    };
  }

  async getRoom(tenantId: string, roomId: string): Promise<HospitalityRoom | null> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('roomId', roomId);
    return this.repository.getRoom(tenantId, roomId);
  }

  async listRoomsByProperty(tenantId: string, propertyId: string): Promise<HospitalityRoom[]> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('propertyId', propertyId);
    return this.repository.listRoomsByProperty(tenantId, propertyId);
  }
}
