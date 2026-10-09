/**
 * Bella Hospitality Phase 1 - Hotel physical foundation types.
 *
 * Scope: Property, Building, Floor, Room Type, Room.
 */

export type HospitalityRecordStatus = 'active' | 'inactive';

export type HospitalityPropertyType =
  | 'hotel'
  | 'resort'
  | 'aparthotel'
  | 'hostel'
  | 'villa'
  | 'mixed';

export interface HospitalityProperty {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly propertyType: HospitalityPropertyType;
  readonly timezone: string;
  readonly status: HospitalityRecordStatus;
  readonly addressLine1: string | null;
  readonly city: string | null;
  readonly countryCode: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityBuilding {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly status: HospitalityRecordStatus;
  readonly sortOrder: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityFloor {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly buildingId: string;
  readonly floorNumber: number;
  readonly code: string;
  readonly name: string;
  readonly status: HospitalityRecordStatus;
  readonly sortOrder: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityRoomType {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly maxOccupancy: number;
  readonly baseAdults: number;
  readonly baseChildren: number;
  readonly bedConfig: Record<string, unknown>;
  readonly status: HospitalityRecordStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityRoom {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly buildingId: string;
  readonly floorId: string;
  readonly roomTypeId: string;
  readonly roomNumber: string;
  readonly displayName: string | null;
  readonly status: HospitalityRecordStatus;
  readonly sortOrder: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePropertyInput {
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly legalName?: string;
  readonly propertyType?: HospitalityPropertyType;
  readonly timezone?: string;
  readonly addressLine1?: string;
  readonly city?: string;
  readonly countryCode?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateBuildingInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateFloorInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly buildingId: string;
  readonly floorNumber: number;
  readonly code: string;
  readonly name: string;
  readonly sortOrder?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateRoomTypeInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly maxOccupancy: number;
  readonly baseAdults?: number;
  readonly baseChildren?: number;
  readonly bedConfig?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateRoomInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly buildingId: string;
  readonly floorId: string;
  readonly roomTypeId: string;
  readonly roomNumber: string;
  readonly displayName?: string;
  readonly sortOrder?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface CreatePropertyRoomFoundationInput {
  readonly tenantId: string;
  readonly property: Omit<CreatePropertyInput, 'tenantId'>;
  readonly building: Omit<CreateBuildingInput, 'tenantId' | 'propertyId'>;
  readonly floor: Omit<CreateFloorInput, 'tenantId' | 'propertyId' | 'buildingId'>;
  readonly roomType: Omit<CreateRoomTypeInput, 'tenantId' | 'propertyId'>;
  readonly room: Omit<CreateRoomInput, 'tenantId' | 'propertyId' | 'buildingId' | 'floorId' | 'roomTypeId'>;
}

export interface HospitalityPropertyRoomFoundation {
  readonly property: HospitalityProperty;
  readonly building: HospitalityBuilding;
  readonly floor: HospitalityFloor;
  readonly roomType: HospitalityRoomType;
  readonly room: HospitalityRoom;
}
