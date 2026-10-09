import { describe, expect, it } from '@jest/globals';

import { HospitalityMaintenanceService } from '../services/maintenance.service';
import type { HospitalityMaintenanceRepositoryPort } from '../repositories/maintenance.repository';
import type { HospitalityRoomHousekeepingState } from '../types/housekeeping.types';
import type {
  AssignMaintenanceRequestInput,
  CompleteMaintenanceRequestInput,
  HospitalityMaintenanceRequest,
  HospitalityMaintenanceRoomStateResult,
  ReportRoomMaintenanceInput,
  StartMaintenanceRequestInput,
} from '../types/maintenance.types';

const NOW = '2026-11-04T04:30:00.000Z';

class FakeMaintenanceRepository implements HospitalityMaintenanceRepositoryPort {
  request: HospitalityMaintenanceRequest | null = null;
  roomState: HospitalityRoomHousekeepingState | null = null;
  readonly operations: string[] = [];

  async reportRoomMaintenance(input: ReportRoomMaintenanceInput): Promise<HospitalityMaintenanceRoomStateResult> {
    this.operations.push('reportRoomMaintenance');
    this.request = {
      id: 'maintenance-request-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      sourceHousekeepingTaskId: input.sourceHousekeepingTaskId ?? null,
      issueType: input.issueType,
      priority: input.priority ?? 'normal',
      status: 'reported',
      title: input.title,
      description: input.description ?? null,
      reportedByUserId: input.reportedByUserId ?? null,
      assignedToUserId: null,
      reportedAt: input.reportedAt ?? NOW,
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      completionNotes: null,
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.roomState = {
      id: 'room-state-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      status: 'out_of_order',
      source: 'maintenance',
      notes: input.title,
      metadata: {
        maintenanceRequestId: this.request.id,
      },
      createdAt: NOW,
      updatedAt: NOW,
    };
    return {
      request: this.request,
      roomState: this.roomState,
    };
  }

  async assignRequest(input: AssignMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest> {
    this.operations.push('assignRequest');
    if (!this.request || this.request.id !== input.requestId || this.request.tenantId !== input.tenantId) {
      throw new Error('maintenance request not found');
    }

    this.request = {
      ...this.request,
      status: 'assigned',
      assignedToUserId: input.assignedToUserId,
      assignedAt: input.assignedAt ?? NOW,
      updatedAt: input.assignedAt ?? NOW,
    };
    return this.request;
  }

  async startRequest(input: StartMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest> {
    this.operations.push('startRequest');
    if (!this.request || this.request.id !== input.requestId || this.request.tenantId !== input.tenantId) {
      throw new Error('maintenance request not found');
    }

    this.request = {
      ...this.request,
      status: 'in_progress',
      startedAt: input.startedAt ?? NOW,
      updatedAt: input.startedAt ?? NOW,
    };
    return this.request;
  }

  async completeRequest(input: CompleteMaintenanceRequestInput): Promise<HospitalityMaintenanceRoomStateResult> {
    this.operations.push('completeRequest');
    if (!this.request || this.request.id !== input.requestId || this.request.tenantId !== input.tenantId) {
      throw new Error('maintenance request not found');
    }

    this.request = {
      ...this.request,
      status: 'completed',
      completedAt: input.completedAt ?? NOW,
      completionNotes: input.completionNotes ?? null,
      updatedAt: input.completedAt ?? NOW,
    };
    this.roomState = {
      id: 'room-state-1',
      tenantId: this.request.tenantId,
      propertyId: this.request.propertyId,
      roomId: this.request.roomId,
      status: 'dirty',
      source: 'maintenance',
      notes: input.completionNotes ?? this.request.title,
      metadata: {
        maintenanceRequestId: this.request.id,
      },
      createdAt: NOW,
      updatedAt: input.completedAt ?? NOW,
    };
    return {
      request: this.request,
      roomState: this.roomState,
    };
  }

  async getRequest(tenantId: string, requestId: string): Promise<HospitalityMaintenanceRequest | null> {
    return this.request?.tenantId === tenantId && this.request.id === requestId
      ? this.request
      : null;
  }
}

describe('HospitalityMaintenanceService', () => {
  it('reports room maintenance and marks the room out of order', async () => {
    const repository = new FakeMaintenanceRepository();
    const service = new HospitalityMaintenanceService(repository);

    const result = await service.reportRoomMaintenance({
      tenantId: 'tenant-hospitality',
      propertyId: 'property-1',
      roomId: 'room-101',
      title: 'Air conditioner leaking',
      issueType: 'utilities',
      priority: 'high',
    });

    expect(repository.operations).toEqual(['reportRoomMaintenance']);
    expect(result.request.status).toBe('reported');
    expect(result.request.priority).toBe('high');
    expect(result.roomState.status).toBe('out_of_order');
    expect(result.roomState.source).toBe('maintenance');
  });

  it('assigns, starts, and completes maintenance while keeping the room not ready for sale', async () => {
    const repository = new FakeMaintenanceRepository();
    const service = new HospitalityMaintenanceService(repository);

    const reported = await service.reportRoomMaintenance({
      tenantId: 'tenant-hospitality',
      propertyId: 'property-1',
      roomId: 'room-101',
      title: 'Door lock repair',
      issueType: 'repair',
    });

    const assigned = await service.assignRequest({
      tenantId: 'tenant-hospitality',
      requestId: reported.request.id,
      assignedToUserId: 'user-maintenance',
      assignedAt: '2026-11-04T05:00:00.000Z',
    });
    const started = await service.startRequest({
      tenantId: 'tenant-hospitality',
      requestId: reported.request.id,
      startedAt: '2026-11-04T05:15:00.000Z',
    });
    const completed = await service.completeRequest({
      tenantId: 'tenant-hospitality',
      requestId: reported.request.id,
      completedAt: '2026-11-04T06:00:00.000Z',
      completionNotes: 'Lock replaced; housekeeping required',
    });

    expect(assigned.status).toBe('assigned');
    expect(assigned.assignedToUserId).toBe('user-maintenance');
    expect(started.status).toBe('in_progress');
    expect(completed.request.status).toBe('completed');
    expect(completed.roomState.status).toBe('dirty');
    expect(completed.roomState.source).toBe('maintenance');
  });

  it('keeps validation at the service boundary', async () => {
    const service = new HospitalityMaintenanceService(new FakeMaintenanceRepository());

    await expect(
      service.assignRequest({
        tenantId: 'tenant-hospitality',
        requestId: 'request-1',
        assignedToUserId: '',
      })
    ).rejects.toThrow('assignedToUserId is required');

    await expect(
      service.reportRoomMaintenance({
        tenantId: 'tenant-hospitality',
        propertyId: 'property-1',
        roomId: 'room-101',
        title: 'Broken lamp',
        issueType: 'repair',
        reportedAt: 'not-a-date',
      })
    ).rejects.toThrow('reportedAt must be a valid timestamp');
  });
});
