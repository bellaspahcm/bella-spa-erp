/**
 * Bella Hospitality Phase 6 - Housekeeping repository.
 *
 * This repository is product-owned and talks only to `hospitality_*` tables.
 */

import type { HospitalitySqlClient } from './property-room.repository';
import type {
  CompleteHousekeepingTaskInput,
  CreateHousekeepingTaskInput,
  HospitalityHousekeepingTask,
  HospitalityHousekeepingTaskCompletion,
  HospitalityHousekeepingTaskOpenResult,
  HospitalityHousekeepingTaskStatus,
  HospitalityHousekeepingTaskType,
  HospitalityReleasedStayRoom,
  HospitalityRoomHousekeepingState,
  HospitalityRoomHousekeepingStatus,
  OpenCheckoutCleaningTaskInput,
  UpsertRoomHousekeepingStateInput,
} from '../types/housekeeping.types';

export interface HospitalityHousekeepingRepositoryPort {
  getReleasedRoomForStay(tenantId: string, stayId: string): Promise<HospitalityReleasedStayRoom | null>;
  openCheckoutCleaningTask(input: OpenCheckoutCleaningTaskInput): Promise<HospitalityHousekeepingTaskOpenResult>;
  upsertRoomState(input: UpsertRoomHousekeepingStateInput): Promise<HospitalityRoomHousekeepingState>;
  createTask(input: CreateHousekeepingTaskInput): Promise<HospitalityHousekeepingTask>;
  completeTask(input: CompleteHousekeepingTaskInput): Promise<HospitalityHousekeepingTaskCompletion>;
  getRoomState(tenantId: string, roomId: string): Promise<HospitalityRoomHousekeepingState | null>;
}

type ReleasedStayRoomRow = {
  tenant_id: string;
  property_id: string;
  stay_id: string;
  room_id: string;
  occupancy_id: string;
};

type RoomHousekeepingStateRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  status: HospitalityRoomHousekeepingStatus;
  source: string;
  notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type HousekeepingTaskRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  stay_id: string | null;
  task_type: HospitalityHousekeepingTaskType;
  status: HospitalityHousekeepingTaskStatus;
  target_room_status: HospitalityRoomHousekeepingStatus;
  opened_at: unknown;
  started_at: unknown | null;
  completed_at: unknown | null;
  notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  throw new Error(`Expected timestamp database value, received ${String(value)}`);
}

function firstRow<Row>(rows: readonly Row[], label: string): Row {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label}: expected database row`);
  }
  return row;
}

export class HospitalityHousekeepingRepository implements HospitalityHousekeepingRepositoryPort {
  constructor(private readonly db: HospitalitySqlClient) {}

  async getReleasedRoomForStay(tenantId: string, stayId: string): Promise<HospitalityReleasedStayRoom | null> {
    const result = await this.db.query<ReleasedStayRoomRow>(
      `
        SELECT
          s.tenant_id,
          s.property_id,
          s.id AS stay_id,
          occ.room_id,
          occ.id AS occupancy_id
        FROM public.hospitality_stays s
        JOIN public.hospitality_room_occupancies occ
          ON occ.tenant_id = s.tenant_id
         AND occ.property_id = s.property_id
         AND occ.stay_id = s.id
        WHERE s.tenant_id = $1
          AND s.id = $2
          AND s.status = 'completed'
          AND occ.status = 'released'
        LIMIT 1
      `,
      [tenantId, stayId]
    );

    const [row] = result.rows;
    return row ? this.mapReleasedStayRoom(row) : null;
  }

  async openCheckoutCleaningTask(
    input: OpenCheckoutCleaningTaskInput
  ): Promise<HospitalityHousekeepingTaskOpenResult> {
    await this.db.query('BEGIN');
    try {
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

      await this.db.query('COMMIT');
      return { roomState, task };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async upsertRoomState(input: UpsertRoomHousekeepingStateInput): Promise<HospitalityRoomHousekeepingState> {
    const result = await this.db.query<RoomHousekeepingStateRow>(
      `
        INSERT INTO public.hospitality_room_housekeeping_statuses (
          tenant_id, property_id, room_id, status, source, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (tenant_id, property_id, room_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          notes = EXCLUDED.notes,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.roomId,
        input.status,
        input.source ?? 'manual',
        input.notes ?? null,
        input.metadata ?? {},
      ]
    );

    return this.mapRoomState(firstRow(result.rows, 'upsertRoomState'));
  }

  async createTask(input: CreateHousekeepingTaskInput): Promise<HospitalityHousekeepingTask> {
    const result = await this.db.query<HousekeepingTaskRow>(
      `
        INSERT INTO public.hospitality_housekeeping_tasks (
          tenant_id, property_id, room_id, stay_id, task_type,
          target_room_status, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.roomId,
        input.stayId ?? null,
        input.taskType,
        input.targetRoomStatus,
        input.notes ?? null,
        input.metadata ?? {},
      ]
    );

    return this.mapTask(firstRow(result.rows, 'createHousekeepingTask'));
  }

  async completeTask(input: CompleteHousekeepingTaskInput): Promise<HospitalityHousekeepingTaskCompletion> {
    await this.db.query('BEGIN');
    try {
      const taskResult = await this.db.query<HousekeepingTaskRow>(
        `
          UPDATE public.hospitality_housekeeping_tasks
          SET
            status = 'completed',
            target_room_status = $3,
            completed_at = COALESCE($4::timestamptz, NOW()),
            notes = COALESCE($5, notes),
            updated_at = NOW()
          WHERE tenant_id = $1
            AND id = $2
            AND status <> 'cancelled'
          RETURNING *
        `,
        [
          input.tenantId,
          input.taskId,
          input.resultingRoomStatus,
          input.completedAt ?? null,
          input.notes ?? null,
        ]
      );
      const task = this.mapTask(firstRow(taskResult.rows, 'completeHousekeepingTask'));

      const roomState = await this.upsertRoomState({
        tenantId: task.tenantId,
        propertyId: task.propertyId,
        roomId: task.roomId,
        status: input.resultingRoomStatus,
        source: task.taskType,
        notes: input.notes ?? task.notes ?? undefined,
        metadata: {
          taskId: task.id,
        },
      });

      await this.db.query('COMMIT');
      return { task, roomState };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRoomState(tenantId: string, roomId: string): Promise<HospitalityRoomHousekeepingState | null> {
    const result = await this.db.query<RoomHousekeepingStateRow>(
      `
        SELECT *
        FROM public.hospitality_room_housekeeping_statuses
        WHERE tenant_id = $1
          AND room_id = $2
        LIMIT 1
      `,
      [tenantId, roomId]
    );

    const [row] = result.rows;
    return row ? this.mapRoomState(row) : null;
  }

  private mapReleasedStayRoom(row: ReleasedStayRoomRow): HospitalityReleasedStayRoom {
    return {
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      stayId: row.stay_id,
      roomId: row.room_id,
      occupancyId: row.occupancy_id,
    };
  }

  private mapRoomState(row: RoomHousekeepingStateRow): HospitalityRoomHousekeepingState {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      roomId: row.room_id,
      status: row.status,
      source: row.source,
      notes: row.notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapTask(row: HousekeepingTaskRow): HospitalityHousekeepingTask {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      roomId: row.room_id,
      stayId: row.stay_id,
      taskType: row.task_type,
      status: row.status,
      targetRoomStatus: row.target_room_status,
      openedAt: toTimestamp(row.opened_at),
      startedAt: row.started_at ? toTimestamp(row.started_at) : null,
      completedAt: row.completed_at ? toTimestamp(row.completed_at) : null,
      notes: row.notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }
}
