/**
 * Bella Preschool OS — P9 Facilities & Asset Maintenance Types
 * File: src/products/bella-education/facilities/domain/facilities.types.ts
 */

export type OperationalStatus = 'OPERATIONAL' | 'UNDER_INSPECTION' | 'OUT_OF_SERVICE';
export type RestrictionScope = 'ASSET_ONLY' | 'ZONE';
export type ZoneType = 'CLASSROOM' | 'PLAYGROUND' | 'KITCHEN' | 'RESTROOM' | 'COMMON';
export type AssetCategory = 'FURNITURE' | 'PLAY_EQUIPMENT' | 'ELECTRICAL' | 'FIRE_SAFETY' | 'FIRST_AID';
export type InspectionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type InspectionResult = 'PASS' | 'FAIL_MINOR' | 'FAIL_CRITICAL';
export type JobPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type JobStatus = 'SUBMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

export interface Facility {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address?: string;
  createdAt: string;
}

export interface FacilityZone {
  id: string;
  tenantId: string;
  facilityId: string;
  name: string;
  zoneType: ZoneType;
  maxOccupancy: number;
  operationalStatus: OperationalStatus;
  restrictionScope: RestrictionScope;
  createdAt: string;
}

export interface FacilityAsset {
  id: string;
  tenantId: string;
  zoneId: string;
  name: string;
  assetCategory: AssetCategory;
  serialNumber?: string;
  inspectionIntervalDays: number;
  lastInspectedAt?: string;
  operationalStatus: OperationalStatus;
  restrictionScope: RestrictionScope;
  createdAt: string;
}

export interface ChecklistItem {
  key: string;
  question: string;
  passed: boolean;
  notes?: string;
}

export interface InspectionSchedule {
  id: string;
  tenantId: string;
  zoneId: string;
  assetId?: string;
  title: string;
  frequency: InspectionFrequency;
  checklistSchema: ChecklistItem[];
  nextDueDate: string;
  createdAt: string;
}

export interface InspectionLog {
  id: string;
  tenantId: string;
  scheduleId?: string;
  zoneId: string;
  assetId?: string;
  inspectorPartyId: string;
  inspectionDate: string;
  resultStatus: InspectionResult;
  checklistAnswers: ChecklistItem[];
  remarks?: string;
  restrictionScope: RestrictionScope;
  createdAt: string;
}

export interface MaintenanceJob {
  id: string;
  tenantId: string;
  zoneId: string;
  assetId?: string;
  title: string;
  priority: JobPriority;
  status: JobStatus;
  reportedByPartyId: string;
  assignedTechnicianPartyId?: string;
  completionNotes?: string;
  verifiedByPartyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutOfServiceLog {
  id: string;
  tenantId: string;
  entityType: 'ASSET' | 'ZONE';
  entityId: string;
  reason: string;
  restrictionScope: RestrictionScope;
  initiatedByPartyId: string;
  restoredByPartyId?: string;
  createdAt: string;
  restoredAt?: string;
}

/**
 * Public Contract DTO published by P9 Facilities for P3/P8 consumption.
 * P9 publishes availability truth ONLY; P3/P8 owns scheduling logic.
 */
export interface ZoneAvailabilityDTO {
  zoneId: string;
  operationalStatus: OperationalStatus;
  availableForScheduling: boolean;
  restrictionReason?: string;
  restrictionScope: RestrictionScope;
  evidenceRef?: string;
  evaluatedAt: string;
}
