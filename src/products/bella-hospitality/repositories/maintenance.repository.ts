/**
 * Bella Hospitality Phase 7 - Maintenance repository.
 *
 * This repository is product-owned and talks only to `hospitality_*` tables.
 */

import type { HospitalitySqlClient } from './property-room.repository';
import type {
  HospitalityRoomHousekeepingState,
  HospitalityRoomHousekeepingStatus,
} from '../types/housekeeping.types';
import type {
  AssignMaintenanceRequestInput,
  CompleteMaintenanceRequestInput,
  HospitalityMaintenanceIssueType,
  HospitalityMaintenancePriority,
  HospitalityMaintenanceRequest,
  HospitalityMaintenanceRequestStatus,
  HospitalityMaintenanceRoomStateResult,
  ReportRoomMaintenanceInput,
  StartMaintenanceRequestInput,
} from '../types/maintenance.types';

export interface HospitalityMaintenanceRepositoryPort {
  reportRoomMaintenance(input: ReportRoomMaintenanceInput): Promise<HospitalityMaintenanceRoomStateResult>;
  assignRequest(input: AssignMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest>;
  startRequest(input: StartMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest>;
  completeRequest(input: CompleteMaintenanceRequestInput): Promise<HospitalityMaintenanceRoomStateResult>;
  getRequest(tenantId: string, requestId: string): Promise<HospitalityMaintenanceRequest | null>;
}

type MaintenanceRequestRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  source_housekeeping_task_id: string | null;
  issue_type: HospitalityMaintenanceIssueType;
  priority: HospitalityMaintenancePriority;
  status: HospitalityMaintenanceRequestStatus;
  title: string;
  description: string | null;
  reported_by_user_id: string | null;
  assigned_to_user_id: string | null;
  reported_at: unknown;
  assigned_at: unknown | null;
  started_at: unknown | null;
  completed_at: unknown | null;
  completion_notes: string | null;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
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

function toNullableTimestamp(value: unknown | null): string | null {
  return value === null ? null : toTimestamp(value);
}

function firstRow<Row>(rows: readonly Row[], label: string): Row {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label}: expected database row`);
  }
  return row;
}

export class HospitalityMaintenanceRepository implements HospitalityMaintenanceRepositoryPort {
  constructor(private readonly db: HospitalitySqlClient) {}

  async reportRoomMaintenance(
    input: ReportRoomMaintenanceInput
  ): Promise<HospitalityMaintenanceRoomStateResult> {
    await this.db.query('BEGIN');
    try {
      const requestResult = await this.db.query<MaintenanceRequestRow>(
        `
          INSERT INTO public.hospitality_maintenance_requests (
            tenant_id, property_id, room_id, source_housekeeping_task_id,
            issue_type, priority, title, description, reported_by_user_id,
            reported_at, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()), $11)
          RETURNING *
        `,
        [
          input.tenantId,
          input.propertyId,
          input.roomId,
          input.sourceHousekeepingTaskId ?? null,
          input.issueType,
          input.priority ?? 'normal',
          input.title,
          input.description ?? null,
          input.reportedByUserId ?? null,
          input.reportedAt ?? null,
          input.metadata ?? {},
        ]
      );
      const request = this.mapRequest(firstRow(requestResult.rows, 'reportRoomMaintenance'));

      const roomState = await this.upsertRoomState({
        tenantId: request.tenantId,
        propertyId: request.propertyId,
        roomId: request.roomId,
        status: 'out_of_order',
        source: 'maintenance',
        notes: request.title,
        metadata: {
          maintenanceRequestId: request.id,
          issueType: request.issueType,
          priority: request.priority,
        },
      });

      await this.db.query('COMMIT');
      return { request, roomState };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async assignRequest(input: AssignMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest> {
    const result = await this.db.query<MaintenanceRequestRow>(
      `
        UPDATE public.hospitality_maintenance_requests
        SET
          status = 'assigned',
          assigned_to_user_id = $3,
          assigned_at = COALESCE($4::timestamptz, NOW()),
          updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
          AND status IN ('reported', 'assigned')
        RETURNING *
      `,
      [
        input.tenantId,
        input.requestId,
        input.assignedToUserId,
        input.assignedAt ?? null,
      ]
    );

    return this.mapRequest(firstRow(result.rows, 'assignMaintenanceRequest'));
  }

  async startRequest(input: StartMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest> {
    const result = await this.db.query<MaintenanceRequestRow>(
      `
        UPDATE public.hospitality_maintenance_requests
        SET
          status = 'in_progress',
          started_at = COALESCE($3::timestamptz, NOW()),
          updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
          AND status IN ('assigned', 'in_progress')
        RETURNING *
      `,
      [
        input.tenantId,
        input.requestId,
        input.startedAt ?? null,
      ]
    );

    return this.mapRequest(firstRow(result.rows, 'startMaintenanceRequest'));
  }

  async completeRequest(
    input: CompleteMaintenanceRequestInput
  ): Promise<HospitalityMaintenanceRoomStateResult> {
    await this.db.query('BEGIN');
    try {
      const requestResult = await this.db.query<MaintenanceRequestRow>(
        `
          UPDATE public.hospitality_maintenance_requests
          SET
            status = 'completed',
            completed_at = COALESCE($3::timestamptz, NOW()),
            completion_notes = COALESCE($4, completion_notes),
            updated_at = NOW()
          WHERE tenant_id = $1
            AND id = $2
            AND status IN ('assigned', 'in_progress')
          RETURNING *
        `,
        [
          input.tenantId,
          input.requestId,
          input.completedAt ?? null,
          input.completionNotes ?? null,
        ]
      );
      const request = this.mapRequest(firstRow(requestResult.rows, 'completeMaintenanceRequest'));

      const roomState = await this.upsertRoomState({
        tenantId: request.tenantId,
        propertyId: request.propertyId,
        roomId: request.roomId,
        status: 'dirty',
        source: 'maintenance',
        notes: input.completionNotes ?? request.title,
        metadata: {
          maintenanceRequestId: request.id,
          completedAt: request.completedAt,
        },
      });

      await this.db.query('COMMIT');
      return { request, roomState };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRequest(tenantId: string, requestId: string): Promise<HospitalityMaintenanceRequest | null> {
    const result = await this.db.query<MaintenanceRequestRow>(
      `
        SELECT *
        FROM public.hospitality_maintenance_requests
        WHERE tenant_id = $1
          AND id = $2
        LIMIT 1
      `,
      [tenantId, requestId]
    );

    const [row] = result.rows;
    return row ? this.mapRequest(row) : null;
  }

  private async upsertRoomState(input: {
    readonly tenantId: string;
    readonly propertyId: string;
    readonly roomId: string;
    readonly status: HospitalityRoomHousekeepingStatus;
    readonly source: string;
    readonly notes: string;
    readonly metadata: Record<string, unknown>;
  }): Promise<HospitalityRoomHousekeepingState> {
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
        input.source,
        input.notes,
        input.metadata,
      ]
    );

    return this.mapRoomState(firstRow(result.rows, 'upsertMaintenanceRoomState'));
  }

  private mapRequest(row: MaintenanceRequestRow): HospitalityMaintenanceRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      roomId: row.room_id,
      sourceHousekeepingTaskId: row.source_housekeeping_task_id,
      issueType: row.issue_type,
      priority: row.priority,
      status: row.status,
      title: row.title,
      description: row.description,
      reportedByUserId: row.reported_by_user_id,
      assignedToUserId: row.assigned_to_user_id,
      reportedAt: toTimestamp(row.reported_at),
      assignedAt: toNullableTimestamp(row.assigned_at),
      startedAt: toNullableTimestamp(row.started_at),
      completedAt: toNullableTimestamp(row.completed_at),
      completionNotes: row.completion_notes,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
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
}
