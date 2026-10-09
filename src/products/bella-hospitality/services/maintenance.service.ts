/**
 * Bella Hospitality Phase 7 - Maintenance service.
 */

import type { HospitalityMaintenanceRepositoryPort } from '../repositories/maintenance.repository';
import type {
  AssignMaintenanceRequestInput,
  CompleteMaintenanceRequestInput,
  HospitalityMaintenanceIssueType,
  HospitalityMaintenancePriority,
  HospitalityMaintenanceRequest,
  HospitalityMaintenanceRoomStateResult,
  ReportRoomMaintenanceInput,
  StartMaintenanceRequestInput,
} from '../types/maintenance.types';

const ISSUE_TYPES: readonly HospitalityMaintenanceIssueType[] = [
  'repair',
  'safety',
  'utilities',
  'amenity',
  'inspection',
  'other',
];

const PRIORITIES: readonly HospitalityMaintenancePriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function assertIssueType(value: HospitalityMaintenanceIssueType): void {
  if (!ISSUE_TYPES.includes(value)) {
    throw new Error(`Unsupported maintenance issue type: ${value}`);
  }
}

function assertPriority(value: HospitalityMaintenancePriority | undefined): void {
  if (value === undefined) return;
  if (!PRIORITIES.includes(value)) {
    throw new Error(`Unsupported maintenance priority: ${value}`);
  }
}

function assertTimestamp(label: string, value: string | undefined): void {
  if (value === undefined) return;
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp`);
  }
}

export class HospitalityMaintenanceService {
  constructor(private readonly repository: HospitalityMaintenanceRepositoryPort) {}

  async reportRoomMaintenance(
    input: ReportRoomMaintenanceInput
  ): Promise<HospitalityMaintenanceRoomStateResult> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('roomId', input.roomId);
    assertNonEmpty('title', input.title);
    assertIssueType(input.issueType);
    assertPriority(input.priority);
    assertTimestamp('reportedAt', input.reportedAt);
    return this.repository.reportRoomMaintenance(input);
  }

  async assignRequest(input: AssignMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('requestId', input.requestId);
    assertNonEmpty('assignedToUserId', input.assignedToUserId);
    assertTimestamp('assignedAt', input.assignedAt);
    return this.repository.assignRequest(input);
  }

  async startRequest(input: StartMaintenanceRequestInput): Promise<HospitalityMaintenanceRequest> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('requestId', input.requestId);
    assertTimestamp('startedAt', input.startedAt);
    return this.repository.startRequest(input);
  }

  async completeRequest(
    input: CompleteMaintenanceRequestInput
  ): Promise<HospitalityMaintenanceRoomStateResult> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('requestId', input.requestId);
    assertTimestamp('completedAt', input.completedAt);
    return this.repository.completeRequest(input);
  }

  async getRequest(tenantId: string, requestId: string): Promise<HospitalityMaintenanceRequest | null> {
    assertNonEmpty('tenantId', tenantId);
    assertNonEmpty('requestId', requestId);
    return this.repository.getRequest(tenantId, requestId);
  }
}
