import { describe, expect, it } from '@jest/globals';

import { HospitalityHousekeepingService } from '../services/housekeeping.service';
import type { HospitalityHousekeepingRepositoryPort } from '../repositories/housekeeping.repository';
import type {
  CompleteHousekeepingTaskInput,
  CreateHousekeepingTaskInput,
  HospitalityHousekeepingTask,
  HospitalityHousekeepingTaskCompletion,
  HospitalityHousekeepingTaskOpenResult,
  HospitalityReleasedStayRoom,
  HospitalityRoomHousekeepingState,
  OpenCheckoutCleaningTaskInput,
  UpsertRoomHousekeepingStateInput,
} from '../types/housekeeping.types';

const NOW = '2026-11-03T04:30:00.000Z';

class FakeHousekeepingRepository implements HospitalityHousekeepingRepositoryPort {
  releasedRoom: HospitalityReleasedStayRoom | null = {
    tenantId: 'tenant-hospitality',
    propertyId: 'property-1',
    stayId: 'stay-1',
    roomId: 'room-101',
    occupancyId: 'occupancy-1',
  };

  roomState: HospitalityRoomHousekeepingState | null = null;
  task: HospitalityHousekeepingTask | null = null;
  readonly operations: string[] = [];

  async getReleasedRoomForStay(tenantId: string, stayId: string): Promise<HospitalityReleasedStayRoom | null> {
    this.operations.push('getReleasedRoomForStay');
    return this.releasedRoom?.tenantId === tenantId && this.releasedRoom.stayId === stayId
      ? this.releasedRoom
      : null;
  }

  async openCheckoutCleaningTask(
    input: OpenCheckoutCleaningTaskInput
  ): Promise<HospitalityHousekeepingTaskOpenResult> {
    this.operations.push('openCheckoutCleaningTask');
    const releasedRoom = await this.getReleasedRoomForStay(input.tenantId, input.stayId);
    if (!releasedRoom) {
      throw new Error('released completed stay room is required before housekeeping cleaning');
    }

    const roomState = await this.upsertRoomState({
      tenantId: input.tenantId,
      propertyId: releasedRoom.propertyId,
      roomId: releasedRoom.roomId,
      status: 'dirty',
      source: 'checkout',
      notes: input.notes,
      metadata: input.metadata,
    });

    const task = await this.createTask({
      tenantId: input.tenantId,
      propertyId: releasedRoom.propertyId,
      roomId: releasedRoom.roomId,
      stayId: releasedRoom.stayId,
      taskType: 'cleaning',
      targetRoomStatus: 'clean',
      notes: input.notes,
      metadata: {
        ...(input.metadata ?? {}),
        occupancyId: releasedRoom.occupancyId,
      },
    });

    return { roomState, task };
  }

  async upsertRoomState(input: UpsertRoomHousekeepingStateInput): Promise<HospitalityRoomHousekeepingState> {
    this.operations.push(`upsertRoomState:${input.status}`);
    this.roomState = {
      id: 'room-state-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      status: input.status,
      source: input.source ?? 'manual',
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    return this.roomState;
  }

  async createTask(input: CreateHousekeepingTaskInput): Promise<HospitalityHousekeepingTask> {
    this.operations.push(`createTask:${input.taskType}`);
    this.task = {
      id: 'housekeeping-task-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      stayId: input.stayId ?? null,
      taskType: input.taskType,
      status: 'pending',
      targetRoomStatus: input.targetRoomStatus,
      openedAt: NOW,
      startedAt: null,
      completedAt: null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    return this.task;
  }

  async completeTask(input: CompleteHousekeepingTaskInput): Promise<HospitalityHousekeepingTaskCompletion> {
    this.operations.push(`completeTask:${input.resultingRoomStatus}`);
    if (!this.task || this.task.id !== input.taskId || this.task.tenantId !== input.tenantId) {
      throw new Error('task not found');
    }

    this.task = {
      ...this.task,
      status: 'completed',
      targetRoomStatus: input.resultingRoomStatus,
      completedAt: input.completedAt ?? NOW,
      notes: input.notes ?? this.task.notes,
      updatedAt: input.completedAt ?? NOW,
    };

    this.roomState = {
      id: 'room-state-1',
      tenantId: this.task.tenantId,
      propertyId: this.task.propertyId,
      roomId: this.task.roomId,
      status: input.resultingRoomStatus,
      source: this.task.taskType,
      notes: input.notes ?? this.task.notes,
      metadata: { taskId: this.task.id },
      createdAt: NOW,
      updatedAt: input.completedAt ?? NOW,
    };

    return {
      task: this.task,
      roomState: this.roomState,
    };
  }

  async getRoomState(tenantId: string, roomId: string): Promise<HospitalityRoomHousekeepingState | null> {
    return this.roomState?.tenantId === tenantId && this.roomState.roomId === roomId
      ? this.roomState
      : null;
  }
}

describe('HospitalityHousekeepingService', () => {
  it('opens a checkout cleaning task from a completed stay with released room occupancy', async () => {
    const repository = new FakeHousekeepingRepository();
    const service = new HospitalityHousekeepingService(repository);

    const result = await service.openCheckoutCleaningTask({
      tenantId: 'tenant-hospitality',
      stayId: 'stay-1',
      notes: 'Guest checked out',
    });

    expect(repository.operations).toEqual([
      'openCheckoutCleaningTask',
      'getReleasedRoomForStay',
      'upsertRoomState:dirty',
      'createTask:cleaning',
    ]);
    expect(result.roomState.status).toBe('dirty');
    expect(result.roomState.source).toBe('checkout');
    expect(result.task.taskType).toBe('cleaning');
    expect(result.task.status).toBe('pending');
    expect(result.task.targetRoomStatus).toBe('clean');
    expect(result.task.stayId).toBe('stay-1');
  });

  it('does not open checkout cleaning before a released completed occupancy exists', async () => {
    const repository = new FakeHousekeepingRepository();
    repository.releasedRoom = null;
    const service = new HospitalityHousekeepingService(repository);

    await expect(
      service.openCheckoutCleaningTask({
        tenantId: 'tenant-hospitality',
        stayId: 'stay-1',
      })
    ).rejects.toThrow('released completed stay room is required before housekeeping cleaning');
  });

  it('completes a housekeeping task and updates the room housekeeping status', async () => {
    const repository = new FakeHousekeepingRepository();
    const service = new HospitalityHousekeepingService(repository);

    const opened = await service.openCheckoutCleaningTask({
      tenantId: 'tenant-hospitality',
      stayId: 'stay-1',
    });

    const completed = await service.completeTask({
      tenantId: 'tenant-hospitality',
      taskId: opened.task.id,
      resultingRoomStatus: 'clean',
      completedAt: '2026-11-03T05:00:00.000Z',
      notes: 'Room cleaned',
    });

    expect(completed.task.status).toBe('completed');
    expect(completed.task.completedAt).toBe('2026-11-03T05:00:00.000Z');
    expect(completed.roomState.status).toBe('clean');
    expect(completed.roomState.source).toBe('cleaning');
  });

  it('keeps validation at the service boundary', async () => {
    const service = new HospitalityHousekeepingService(new FakeHousekeepingRepository());

    await expect(
      service.completeTask({
        tenantId: 'tenant-hospitality',
        taskId: 'task-1',
        resultingRoomStatus: 'clean',
        completedAt: 'not-a-date',
      })
    ).rejects.toThrow('completedAt must be a valid timestamp');
  });
});
