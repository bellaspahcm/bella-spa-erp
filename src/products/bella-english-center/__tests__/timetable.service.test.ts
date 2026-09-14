import { describe, expect, it } from '@jest/globals';
import {
  TimetableConflictError,
  TimetableRepositoryContract,
  TimetableService,
} from '../services/timetable.service';
import {
  ClassScheduleContext,
  CreateRoomInput,
  EnglishCenterClassSession,
  EnglishCenterRoom,
  ScheduleClassSessionInput,
  TimetableListFilters,
  UpdateClassSessionInput,
  UpdateRoomInput,
} from '../types/timetable.types';

const baseRoom: EnglishCenterRoom = {
  id: 'room-a',
  tenantId: 'tenant-a',
  branchId: 'branch-a',
  code: 'A101',
  name: 'Room A101',
  capacity: 20,
  status: 'active',
  metadata: {},
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
};

const baseClass: ClassScheduleContext = {
  id: 'class-a',
  tenantId: 'tenant-a',
  branchId: 'branch-a',
  capacity: 16,
  teacherId: 'teacher-a',
};

const existingSession: EnglishCenterClassSession = {
  id: 'session-existing',
  tenantId: 'tenant-a',
  branchId: 'branch-a',
  classId: 'class-b',
  teacherId: 'teacher-a',
  roomId: 'room-a',
  startsAt: '2026-09-15T09:00:00.000Z',
  endsAt: '2026-09-15T10:30:00.000Z',
  status: 'scheduled',
  topic: 'Grammar',
  metadata: {},
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
};

function makeRepository(overrides: Partial<TimetableRepositoryContract> = {}): TimetableRepositoryContract {
  return {
    async createRoom(_tenantId: string, input: CreateRoomInput) {
      return { ...baseRoom, ...input, tenantId: _tenantId, capacity: input.capacity || baseRoom.capacity, status: 'active' };
    },
    async getRoomById() {
      return baseRoom;
    },
    async listRooms() {
      return { rooms: [baseRoom], total: 1 };
    },
    async updateRoom(_tenantId: string, roomId: string, input: UpdateRoomInput) {
      return { ...baseRoom, ...input, id: roomId };
    },
    async getClassContext() {
      return baseClass;
    },
    async teacherAssignedToBranch() {
      return true;
    },
    async listOverlappingSessions() {
      return [];
    },
    async createSession(tenantId: string, input: ScheduleClassSessionInput) {
      return {
        id: 'session-new',
        tenantId,
        branchId: input.branchId,
        classId: input.classId,
        teacherId: input.teacherId || null,
        roomId: input.roomId || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: 'scheduled',
        topic: input.topic || null,
        metadata: input.metadata || {},
        createdAt: '2026-09-14T00:00:00Z',
        updatedAt: '2026-09-14T00:00:00Z',
      };
    },
    async getSessionById() {
      return existingSession;
    },
    async listSessions(_tenantId: string, _filters?: TimetableListFilters) {
      return { sessions: [existingSession], total: 1 };
    },
    async updateSession(_tenantId: string, sessionId: string, input: UpdateClassSessionInput) {
      return { ...existingSession, ...input, id: sessionId };
    },
    ...overrides,
  };
}

const validInput: ScheduleClassSessionInput = {
  branchId: 'branch-a',
  classId: 'class-a',
  teacherId: 'teacher-a',
  roomId: 'room-a',
  startsAt: '2026-09-15T11:00:00.000Z',
  endsAt: '2026-09-15T12:30:00.000Z',
  topic: 'Speaking',
};

describe('E5 — TimetableService', () => {
  it('schedules a class session when branch, teacher, room, and class are clear', async () => {
    const service = new TimetableService(makeRepository());

    const session = await service.scheduleSession('tenant-a', validInput);

    expect(session.id).toBe('session-new');
    expect(session.branchId).toBe('branch-a');
    expect(session.status).toBe('scheduled');
  });

  it('blocks teacher conflicts in overlapping windows', async () => {
    const service = new TimetableService(makeRepository({
      async listOverlappingSessions() {
        return [existingSession];
      },
    }));

    await expect(service.scheduleSession('tenant-a', {
      ...validInput,
      startsAt: '2026-09-15T09:30:00.000Z',
      endsAt: '2026-09-15T10:00:00.000Z',
    })).rejects.toThrow(TimetableConflictError);
  });

  it('blocks room conflicts in overlapping windows', async () => {
    const service = new TimetableService(makeRepository({
      async listOverlappingSessions() {
        return [{ ...existingSession, teacherId: 'teacher-b', roomId: 'room-a' }];
      },
    }));

    await expect(service.scheduleSession('tenant-a', {
      ...validInput,
      teacherId: 'teacher-c',
      startsAt: '2026-09-15T09:15:00.000Z',
      endsAt: '2026-09-15T10:00:00.000Z',
    })).rejects.toThrow(/Room already has a session/);
  });

  it('blocks class conflicts in overlapping windows', async () => {
    const service = new TimetableService(makeRepository({
      async listOverlappingSessions() {
        return [{ ...existingSession, classId: 'class-a', teacherId: 'teacher-b', roomId: 'room-b' }];
      },
    }));

    await expect(service.scheduleSession('tenant-a', {
      ...validInput,
      teacherId: 'teacher-c',
      roomId: 'room-c',
      startsAt: '2026-09-15T09:15:00.000Z',
      endsAt: '2026-09-15T10:00:00.000Z',
    })).rejects.toThrow(/Class already has a session/);
  });

  it('blocks branch mismatch between class and session', async () => {
    const service = new TimetableService(makeRepository());

    await expect(service.scheduleSession('tenant-a', {
      ...validInput,
      branchId: 'branch-b',
    })).rejects.toThrow(/Class branch does not match session branch/);
  });

  it('blocks tenant isolation violations before scheduling', async () => {
    const service = new TimetableService(makeRepository({
      async getClassContext() {
        return { ...baseClass, tenantId: 'tenant-b' };
      },
    }));

    await expect(service.scheduleSession('tenant-a', validInput)).rejects.toThrow(/TENANT_SCOPE_VIOLATION/);
  });

  it('supports timetable lifecycle updates without conflict checks when cancelling', async () => {
    const service = new TimetableService(makeRepository({
      async listOverlappingSessions() {
        throw new Error('conflict check should not run for cancellation');
      },
    }));

    const session = await service.updateSession('tenant-a', 'session-existing', { status: 'cancelled' });

    expect(session.status).toBe('cancelled');
  });
});
