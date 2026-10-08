/**
 * Bella Hospitality Phase 6 - Housekeeping types.
 *
 * Scope: Room housekeeping status and housekeeping task lifecycle only.
 */

export type HospitalityRoomHousekeepingStatus =
  | 'available'
  | 'occupied'
  | 'dirty'
  | 'clean'
  | 'inspected'
  | 'out_of_order';

export type HospitalityHousekeepingTaskType =
  | 'cleaning'
  | 'inspection'
  | 'maintenance_request'
  | 'status_update';

export type HospitalityHousekeepingTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface HospitalityRoomHousekeepingState {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly status: HospitalityRoomHousekeepingStatus;
  readonly source: string;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityHousekeepingTask {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly stayId: string | null;
  readonly taskType: HospitalityHousekeepingTaskType;
  readonly status: HospitalityHousekeepingTaskStatus;
  readonly targetRoomStatus: HospitalityRoomHousekeepingStatus;
  readonly openedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityReleasedStayRoom {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly stayId: string;
  readonly roomId: string;
  readonly occupancyId: string;
}

export interface UpsertRoomHousekeepingStateInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly status: HospitalityRoomHousekeepingStatus;
  readonly source?: string;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateHousekeepingTaskInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly stayId?: string;
  readonly taskType: HospitalityHousekeepingTaskType;
  readonly targetRoomStatus: HospitalityRoomHousekeepingStatus;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface OpenCheckoutCleaningTaskInput {
  readonly tenantId: string;
  readonly stayId: string;
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CompleteHousekeepingTaskInput {
  readonly tenantId: string;
  readonly taskId: string;
  readonly completedAt?: string;
  readonly resultingRoomStatus: HospitalityRoomHousekeepingStatus;
  readonly notes?: string;
}

export interface HospitalityHousekeepingTaskOpenResult {
  readonly roomState: HospitalityRoomHousekeepingState;
  readonly task: HospitalityHousekeepingTask;
}

export interface HospitalityHousekeepingTaskCompletion {
  readonly roomState: HospitalityRoomHousekeepingState;
  readonly task: HospitalityHousekeepingTask;
}
