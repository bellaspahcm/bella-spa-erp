/**
 * E5 — English Center Timetable & Room Scheduling Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TimetableRepository } from '../repositories/timetable.repository';
import {
  ClassScheduleContext,
  CreateRoomInput,
  EnglishCenterClassSession,
  EnglishCenterRoom,
  ScheduleClassSessionInput,
  TimetableConflict,
  TimetableListFilters,
  UpdateClassSessionInput,
  UpdateRoomInput,
} from '../types/timetable.types';

export interface TimetableRepositoryContract {
  createRoom(tenantId: string, input: CreateRoomInput): Promise<EnglishCenterRoom>;
  getRoomById(tenantId: string, roomId: string): Promise<EnglishCenterRoom | null>;
  listRooms(
    tenantId: string,
    filters?: { branchId?: string; status?: 'active' | 'inactive'; limit?: number; offset?: number }
  ): Promise<{ rooms: EnglishCenterRoom[]; total: number }>;
  updateRoom(tenantId: string, roomId: string, input: UpdateRoomInput): Promise<EnglishCenterRoom>;
  getClassContext(tenantId: string, classId: string): Promise<ClassScheduleContext | null>;
  teacherAssignedToBranch(tenantId: string, teacherId: string, branchId: string): Promise<boolean>;
  listOverlappingSessions(input: {
    tenantId: string;
    startsAt: string;
    endsAt: string;
    excludeSessionId?: string;
  }): Promise<EnglishCenterClassSession[]>;
  createSession(tenantId: string, input: ScheduleClassSessionInput): Promise<EnglishCenterClassSession>;
  getSessionById(tenantId: string, sessionId: string): Promise<EnglishCenterClassSession | null>;
  listSessions(
    tenantId: string,
    filters?: TimetableListFilters
  ): Promise<{ sessions: EnglishCenterClassSession[]; total: number }>;
  updateSession(
    tenantId: string,
    sessionId: string,
    input: UpdateClassSessionInput
  ): Promise<EnglishCenterClassSession>;
}

export class TimetableConflictError extends Error {
  constructor(readonly conflicts: TimetableConflict[]) {
    super(`TIMETABLE_CONFLICT: ${conflicts.map((conflict) => conflict.message).join('; ')}`);
    this.name = 'TimetableConflictError';
  }
}

export class TimetableService {
  private readonly repository: TimetableRepositoryContract;

  constructor(supabaseOrRepository: SupabaseClient | TimetableRepositoryContract) {
    this.repository = this.isRepository(supabaseOrRepository)
      ? supabaseOrRepository
      : new TimetableRepository(supabaseOrRepository);
  }

  async createRoom(tenantId: string, input: CreateRoomInput): Promise<EnglishCenterRoom> {
    if (!tenantId || !input.branchId || !input.code || !input.name) {
      throw new Error('INVALID_ROOM_INPUT: tenantId, branchId, code, and name are required');
    }
    if (input.capacity !== undefined && input.capacity <= 0) {
      throw new Error('INVALID_ROOM_CAPACITY: capacity must be greater than zero');
    }

    return this.repository.createRoom(tenantId, input);
  }

  async listRooms(
    tenantId: string,
    filters?: { branchId?: string; status?: 'active' | 'inactive'; limit?: number; offset?: number }
  ): Promise<{ rooms: EnglishCenterRoom[]; total: number }> {
    return this.repository.listRooms(tenantId, filters);
  }

  async updateRoom(
    tenantId: string,
    roomId: string,
    input: UpdateRoomInput
  ): Promise<EnglishCenterRoom> {
    return this.repository.updateRoom(tenantId, roomId, input);
  }

  async scheduleSession(
    tenantId: string,
    input: ScheduleClassSessionInput
  ): Promise<EnglishCenterClassSession> {
    await this.assertSchedulable(tenantId, input);
    return this.repository.createSession(tenantId, input);
  }

  async updateSession(
    tenantId: string,
    sessionId: string,
    input: UpdateClassSessionInput
  ): Promise<EnglishCenterClassSession> {
    const existing = await this.repository.getSessionById(tenantId, sessionId);
    if (!existing) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const candidate: ScheduleClassSessionInput = {
      branchId: existing.branchId,
      classId: existing.classId,
      teacherId: input.teacherId !== undefined ? input.teacherId : existing.teacherId,
      roomId: input.roomId !== undefined ? input.roomId : existing.roomId,
      startsAt: input.startsAt || existing.startsAt,
      endsAt: input.endsAt || existing.endsAt,
      topic: input.topic !== undefined ? input.topic : existing.topic,
      metadata: input.metadata || existing.metadata,
    };

    if (input.status !== 'cancelled') {
      await this.assertSchedulable(tenantId, candidate, sessionId);
    }

    return this.repository.updateSession(tenantId, sessionId, input);
  }

  async listSessions(
    tenantId: string,
    filters?: TimetableListFilters
  ): Promise<{ sessions: EnglishCenterClassSession[]; total: number }> {
    return this.repository.listSessions(tenantId, filters);
  }

  async detectConflicts(
    tenantId: string,
    input: ScheduleClassSessionInput,
    excludeSessionId?: string
  ): Promise<TimetableConflict[]> {
    const classContext = await this.requireClassContext(tenantId, input.classId);
    const conflicts: TimetableConflict[] = [];

    if (classContext.branchId !== input.branchId) {
      conflicts.push({
        type: 'branch',
        sessionId: input.classId,
        message: 'Class branch does not match session branch',
      });
    }

    const teacherId = input.teacherId || classContext.teacherId;
    if (teacherId) {
      const assigned = await this.repository.teacherAssignedToBranch(tenantId, teacherId, input.branchId);
      if (!assigned) {
        conflicts.push({
          type: 'branch',
          sessionId: teacherId,
          message: 'Teacher is not assigned to this branch',
        });
      }
    }

    if (input.roomId) {
      const room = await this.repository.getRoomById(tenantId, input.roomId);
      if (!room || room.branchId !== input.branchId || room.status !== 'active') {
        conflicts.push({
          type: 'room',
          sessionId: input.roomId,
          message: 'Room is not active in this branch',
        });
      } else if (room.capacity < classContext.capacity) {
        conflicts.push({
          type: 'room',
          sessionId: input.roomId,
          message: 'Room capacity is lower than class capacity',
        });
      }
    }

    const overlapping = await this.repository.listOverlappingSessions({
      tenantId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeSessionId,
    });

    for (const session of overlapping) {
      if (session.classId === input.classId) {
        conflicts.push({
          type: 'class',
          sessionId: session.id,
          message: 'Class already has a session in this time window',
        });
      }
      if (teacherId && session.teacherId === teacherId) {
        conflicts.push({
          type: 'teacher',
          sessionId: session.id,
          message: 'Teacher already has a session in this time window',
        });
      }
      if (input.roomId && session.roomId === input.roomId) {
        conflicts.push({
          type: 'room',
          sessionId: session.id,
          message: 'Room already has a session in this time window',
        });
      }
    }

    return conflicts;
  }

  private async assertSchedulable(
    tenantId: string,
    input: ScheduleClassSessionInput,
    excludeSessionId?: string
  ): Promise<void> {
    if (!tenantId || !input.branchId || !input.classId || !input.startsAt || !input.endsAt) {
      throw new Error('INVALID_SESSION_INPUT: tenantId, branchId, classId, startsAt, and endsAt are required');
    }
    if (new Date(input.startsAt).getTime() >= new Date(input.endsAt).getTime()) {
      throw new Error('INVALID_SESSION_WINDOW: startsAt must be before endsAt');
    }

    const conflicts = await this.detectConflicts(tenantId, input, excludeSessionId);
    if (conflicts.length > 0) {
      throw new TimetableConflictError(conflicts);
    }
  }

  private async requireClassContext(
    tenantId: string,
    classId: string
  ): Promise<ClassScheduleContext> {
    const classContext = await this.repository.getClassContext(tenantId, classId);
    if (!classContext) {
      throw new Error('CLASS_NOT_FOUND');
    }
    if (classContext.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return classContext;
  }

  private isRepository(
    candidate: SupabaseClient | TimetableRepositoryContract
  ): candidate is TimetableRepositoryContract {
    return 'createRoom' in candidate && 'listOverlappingSessions' in candidate;
  }
}
