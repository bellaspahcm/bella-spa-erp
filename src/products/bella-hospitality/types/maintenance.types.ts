/**
 * Bella Hospitality Phase 7 - Maintenance types.
 *
 * Scope: Room maintenance request lifecycle only.
 */

import type { HospitalityRoomHousekeepingState } from './housekeeping.types';

export type HospitalityMaintenanceIssueType =
  | 'repair'
  | 'safety'
  | 'utilities'
  | 'amenity'
  | 'inspection'
  | 'other';

export type HospitalityMaintenancePriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export type HospitalityMaintenanceRequestStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'completed';

export interface HospitalityMaintenanceRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly sourceHousekeepingTaskId: string | null;
  readonly issueType: HospitalityMaintenanceIssueType;
  readonly priority: HospitalityMaintenancePriority;
  readonly status: HospitalityMaintenanceRequestStatus;
  readonly title: string;
  readonly description: string | null;
  readonly reportedByUserId: string | null;
  readonly assignedToUserId: string | null;
  readonly reportedAt: string;
  readonly assignedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly completionNotes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReportRoomMaintenanceInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly title: string;
  readonly description?: string;
  readonly issueType: HospitalityMaintenanceIssueType;
  readonly priority?: HospitalityMaintenancePriority;
  readonly reportedByUserId?: string;
  readonly sourceHousekeepingTaskId?: string;
  readonly reportedAt?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AssignMaintenanceRequestInput {
  readonly tenantId: string;
  readonly requestId: string;
  readonly assignedToUserId: string;
  readonly assignedAt?: string;
}

export interface StartMaintenanceRequestInput {
  readonly tenantId: string;
  readonly requestId: string;
  readonly startedAt?: string;
}

export interface CompleteMaintenanceRequestInput {
  readonly tenantId: string;
  readonly requestId: string;
  readonly completedAt?: string;
  readonly completionNotes?: string;
}

export interface HospitalityMaintenanceRoomStateResult {
  readonly request: HospitalityMaintenanceRequest;
  readonly roomState: HospitalityRoomHousekeepingState;
}
