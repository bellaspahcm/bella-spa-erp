import { describe, expect, it } from '@jest/globals';

import { HospitalityPropertyRoomService } from '../services/property-room.service';
import type {
  CreateBuildingInput,
  CreateFloorInput,
  CreatePropertyInput,
  CreateRoomInput,
  CreateRoomTypeInput,
  HospitalityBuilding,
  HospitalityFloor,
  HospitalityProperty,
  HospitalityRoom,
  HospitalityRoomType,
} from '../types/property-room.types';
import type { HospitalityPropertyRoomRepositoryPort } from '../repositories/property-room.repository';

const NOW = '2026-10-08T00:00:00.000Z';

class FakePropertyRoomRepository implements HospitalityPropertyRoomRepositoryPort {
  readonly created: string[] = [];
  private room: HospitalityRoom | null = null;

  async createProperty(input: CreatePropertyInput): Promise<HospitalityProperty> {
    this.created.push('property');
    return {
      id: 'property-1',
      tenantId: input.tenantId,
      code: input.code,
      name: input.name,
      legalName: input.legalName ?? null,
      propertyType: input.propertyType ?? 'hotel',
      timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
      status: 'active',
      addressLine1: input.addressLine1 ?? null,
      city: input.city ?? null,
      countryCode: input.countryCode ?? 'VN',
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async createBuilding(input: CreateBuildingInput): Promise<HospitalityBuilding> {
    this.created.push('building');
    return {
      id: 'building-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      code: input.code,
      name: input.name,
      status: 'active',
      sortOrder: input.sortOrder ?? 0,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async createFloor(input: CreateFloorInput): Promise<HospitalityFloor> {
    this.created.push('floor');
    return {
      id: 'floor-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      buildingId: input.buildingId,
      floorNumber: input.floorNumber,
      code: input.code,
      name: input.name,
      status: 'active',
      sortOrder: input.sortOrder ?? 0,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async createRoomType(input: CreateRoomTypeInput): Promise<HospitalityRoomType> {
    this.created.push('roomType');
    return {
      id: 'room-type-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      code: input.code,
      name: input.name,
      maxOccupancy: input.maxOccupancy,
      baseAdults: input.baseAdults ?? 2,
      baseChildren: input.baseChildren ?? 0,
      bedConfig: input.bedConfig ?? {},
      status: 'active',
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async createRoom(input: CreateRoomInput): Promise<HospitalityRoom> {
    this.created.push('room');
    this.room = {
      id: 'room-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      buildingId: input.buildingId,
      floorId: input.floorId,
      roomTypeId: input.roomTypeId,
      roomNumber: input.roomNumber,
      displayName: input.displayName ?? null,
      status: 'active',
      sortOrder: input.sortOrder ?? 0,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    return this.room;
  }

  async getRoom(tenantId: string, roomId: string): Promise<HospitalityRoom | null> {
    return this.room?.tenantId === tenantId && this.room.id === roomId ? this.room : null;
  }

  async listRoomsByProperty(tenantId: string, propertyId: string): Promise<HospitalityRoom[]> {
    return this.room?.tenantId === tenantId && this.room.propertyId === propertyId
      ? [this.room]
      : [];
  }
}

describe('HospitalityPropertyRoomService', () => {
  it('creates the Phase 1 physical Hotel chain in order', async () => {
    const repository = new FakePropertyRoomRepository();
    const service = new HospitalityPropertyRoomService(repository);

    const foundation = await service.createPropertyRoomFoundation({
      tenantId: 'tenant-hospitality',
      property: {
        code: 'PROP-01',
        name: 'Bella Hotel Saigon',
        city: 'Ho Chi Minh City',
      },
      building: {
        code: 'MAIN',
        name: 'Main Tower',
      },
      floor: {
        floorNumber: 1,
        code: 'L1',
        name: 'Level 1',
      },
      roomType: {
        code: 'DLX',
        name: 'Deluxe King',
        maxOccupancy: 2,
        bedConfig: { king: 1 },
      },
      room: {
        roomNumber: '101',
        displayName: '101 - Deluxe King',
      },
    });

    expect(repository.created).toEqual(['property', 'building', 'floor', 'roomType', 'room']);
    expect(foundation.property.tenantId).toBe('tenant-hospitality');
    expect(foundation.building.propertyId).toBe(foundation.property.id);
    expect(foundation.floor.buildingId).toBe(foundation.building.id);
    expect(foundation.roomType.propertyId).toBe(foundation.property.id);
    expect(foundation.room.roomTypeId).toBe(foundation.roomType.id);
    expect(foundation.room.roomNumber).toBe('101');
  });

  it('rejects room type base occupancy above max occupancy', async () => {
    const service = new HospitalityPropertyRoomService(new FakePropertyRoomRepository());

    await expect(
      service.createRoomType({
        tenantId: 'tenant-hospitality',
        propertyId: 'property-1',
        code: 'BAD',
        name: 'Invalid',
        maxOccupancy: 2,
        baseAdults: 2,
        baseChildren: 1,
      })
    ).rejects.toThrow('base occupancy cannot exceed maxOccupancy');
  });

  it('keeps tenant-scoped room reads explicit', async () => {
    const repository = new FakePropertyRoomRepository();
    const service = new HospitalityPropertyRoomService(repository);
    const foundation = await service.createPropertyRoomFoundation({
      tenantId: 'tenant-a',
      property: { code: 'PROP-A', name: 'Property A' },
      building: { code: 'MAIN', name: 'Main' },
      floor: { floorNumber: 1, code: 'L1', name: 'Level 1' },
      roomType: { code: 'STD', name: 'Standard', maxOccupancy: 2 },
      room: { roomNumber: '101' },
    });

    await expect(service.getRoom('tenant-a', foundation.room.id)).resolves.toBeDefined();
    await expect(service.getRoom('tenant-b', foundation.room.id)).resolves.toBeNull();
  });
});
