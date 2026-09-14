/**
 * E5 — English Center Timetable & Room Scheduling Types
 */

export type EnglishCenterRoomStatus = 'active' | 'inactive';
export type EnglishCenterSessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type TimetableConflictType = 'teacher' | 'room' | 'class' | 'branch' | 'tenant';

export interface EnglishCenterRoom {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly capacity: number;
  readonly status: EnglishCenterRoomStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateRoomInput {
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly capacity?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateRoomInput {
  readonly name?: string;
  readonly capacity?: number;
  readonly status?: EnglishCenterRoomStatus;
  readonly metadata?: Record<string, unknown>;
}

export interface EnglishCenterClassSession {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly classId: string;
  readonly teacherId: string | null;
  readonly roomId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: EnglishCenterSessionStatus;
  readonly topic: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ScheduleClassSessionInput {
  readonly branchId: string;
  readonly classId: string;
  readonly teacherId?: string | null;
  readonly roomId?: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly topic?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateClassSessionInput {
  readonly teacherId?: string | null;
  readonly roomId?: string | null;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly status?: EnglishCenterSessionStatus;
  readonly topic?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TimetableConflict {
  readonly type: TimetableConflictType;
  readonly sessionId: string;
  readonly message: string;
}

export interface TimetableListFilters {
  readonly branchId?: string;
  readonly classId?: string;
  readonly teacherId?: string;
  readonly roomId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly status?: EnglishCenterSessionStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RoomRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  code: string;
  name: string;
  capacity: number;
  status: EnglishCenterRoomStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClassSessionRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  class_id: string;
  teacher_id: string | null;
  room_id: string | null;
  starts_at: string;
  ends_at: string;
  status: EnglishCenterSessionStatus;
  topic: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClassScheduleContext {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly capacity: number;
  readonly teacherId: string | null;
}
