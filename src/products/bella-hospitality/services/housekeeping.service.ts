/**
 * Bella Hospitality Phase 6 - Housekeeping service.
 */

import type { HospitalityHousekeepingRepositoryPort } from '../repositories/housekeeping.repository';
import type {
  CompleteHousekeepingTaskInput,
  CreateHousekeepingTaskInput,
  HospitalityHousekeepingTask,
  HospitalityHousekeepingTaskCompletion,
  HospitalityHousekeepingTaskOpenResult,
  HospitalityRoomHousekeepingState,
  HospitalityRoomHousekeepingStatus,
  OpenCheckoutCleaningTaskInput,
  UpsertRoomHousekeepingStateInput,
} from '../types/housekeeping.types';

const ROOM_STATUSES: readonly HospitalityRoomHousekeepingStatus[] = [
  'available',
  'occupied',
  'dirty',
  'clean',
  'inspected',
  'out_of_order',
];

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function assertRoomStatus(value: HospitalityRoomHousekeepingStatus): void {
  if (!ROOM_STATUSES.includes(value)) {
    throw new Error(`Unsupported room housekeeping status: ${value}`);
  }
}

function assertTimestamp(label: string, value: string | undefined): void {
  if (value === undefined) return;
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp`);
  }
}

export class HospitalityHousekeepingService {
  constructor(private readonly repository: HospitalityHousekeepingRepositoryPort) {}

  async openCheckoutCleaningTask(
    input: OpenCheckoutCleaningTaskInput
  ): Promise<HospitalityHousekeepingTaskOpenResult> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('stayId', input.stayId);

    return this.repository.openCheckoutCleaningTask(input);
  }

  async createTask(input: CreateHousekeepingTaskInput): Promise<HospitalityHousekeepingTask> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('roomId', input.roomId);
    assertRoomStatus(input.targetRoomStatus);
    return this.repository.createTask(input);
  }

  async completeTask(input: CompleteHousekeepingTaskInput): Promise<HospitalityHousekeepingTaskCompletion> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('taskId', input.taskId);
    assertRoomStatus(input.resultingRoomStatus);
    assertTimestamp('completedAt', input.completedAt);
    return this.repository.completeTask(input);
  }

  async upsertRoomState(input: UpsertRoomHousekeepingStateInput): Promise<HospitalityRoomHousekeepingState> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('roomId', input.roomId);
    assertRoomStatus(input.status);
    return this.repository.upsertRoomState(input);
  }

  async getRoomState(tenantId: string, roomId: string): Promise<HospitalityRoomHousekeepingState | null> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('roomId', roomId);
    return this.repository.getRoomState(tenantId, roomId);
  }
}
