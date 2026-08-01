/**
 * Bella EIP — Architectural Constitution Contracts & Types (10/10 Architecture)
 * 15-20 Year Lifespan Enterprise Contracts: Level 1 Constitution & Level 2 Commitments
 */

export type ResourceType = string;

/**
 * 1. ResourceRef Identity Tuple
 */
export interface ResourceRef {
  tenantId: string;
  resourceType: ResourceType;
  resourceId: string;
}

/**
 * 2. Service Container Infrastructure Services
 */
export interface ServiceContainer {
  logger: (level: string, message: string, data?: unknown) => void;
  now: () => string; // Returns ISO string
  generateId: (prefix?: string) => string;
}

/**
 * 3. Level 1: Universal Execution Context
 */
export interface UniversalExecutionContext {
  tenant: {
    id: string;
    code?: string;
    branchId?: string;
  };
  actor: {
    userId: string;
    userName?: string;
    roles?: string[];
  };
  security: {
    permissions: string[];
  };
  runtime: {
    requestId: string;
    correlationId: string;
    idempotencyKey?: string;
    locale?: string;
    timezone?: string;
  };
  featureFlags: Record<string, boolean>;
  services?: ServiceContainer;
}

/**
 * 4. Level 1: Enriched Capability Manifest
 */
export interface EnrichedCapabilityManifest {
  key: string;
  version: string;
  tier: 'foundation' | 'runtime' | 'intelligence';
  lifecycle: 'foundation' | 'runtime' | 'intelligence';
  experimental?: boolean;
  deprecated?: boolean;
  dependencies?: string[];
  commands?: string[];
  events?: string[];
  permissions?: string[];
  featureFlag?: string;
}

/**
 * 5. Level 1: Domain vs Integration Event Contracts (v1)
 */
export type DomainEventTypeV1 =
  | 'resource.assigned.v1'
  | 'resource.accepted.v1'
  | 'resource.workflow.updated.v1'
  | 'resource.sla.breached.v1'
  | 'resource.rotated.v1'
  | 'resource.closed.v1';

export type IntegrationEventTypeV1 =
  | 'crm.lead.created.v1'
  | 'crm.lead.converted.v1'
  | 'erp.invoice.created.v1';

export interface DomainEventV1<T = Record<string, unknown>> {
  eventId: string;
  eventType: DomainEventTypeV1;
  eventVersion: 1;
  resource: ResourceRef;
  context: UniversalExecutionContext;
  payload: T;
  timestamp: string;
}

export interface IntegrationEventV1<T = Record<string, unknown>> {
  eventId: string;
  eventType: IntegrationEventTypeV1;
  eventVersion: 1;
  resource: ResourceRef;
  payload: T;
  timestamp: string;
}

/**
 * 6. Level 1: Segregated ISP Snapshots (CQRS-Lite Read Model)
 */
export interface AssignmentSnapshot {
  ownerId?: string;
  ownerName?: string;
  assignedAt?: string;
  status: string;
}

export interface WorkflowSnapshot {
  state: string;
  workflowState: string;
  currentOutcome?: string;
  attemptCount: number;
}

export interface SLASnapshot {
  currentStage: string;
  currentSLAStatus: string;
  deadlineTime?: string;
  isBreached: boolean;
}

export interface AuditSnapshot {
  lastEventId?: string;
  lastEventType?: string;
  eventCount: number;
}

export interface ResourceSnapshot {
  resource: ResourceRef;
  assignment: AssignmentSnapshot;
  workflow: WorkflowSnapshot;
  sla: SLASnapshot;
  audit: AuditSnapshot;
  updatedAt: string;
}

/**
 * 7. Level 1: Strongly-Typed Capability Provider Map
 */
export interface CapabilityProviderFactory<T = unknown> {
  create(context: UniversalExecutionContext): T;
}

export type KnownCapabilityKey =
  | 'assignment'
  | 'workflow'
  | 'sla'
  | 'rotation'
  | 'audit'
  | 'notification'
  | 'approval'
  | 'permission'
  | 'rule'
  | string;

export interface TypedCapabilityProviderMap {
  assignment?: CapabilityProviderFactory;
  workflow?: CapabilityProviderFactory;
  sla?: CapabilityProviderFactory;
  rotation?: CapabilityProviderFactory;
  audit?: CapabilityProviderFactory;
  notification?: CapabilityProviderFactory;
  permission?: CapabilityProviderFactory;
  rule?: CapabilityProviderFactory;
}

export interface AssigneeUser {
  id: string;
  name: string;
  role?: string;
}

export interface ResourceProviderManifest {
  resourceType: string;
  slaMetadata?: {
    stages: Array<{ stage: string; label: string; timeoutMinutes: number }>;
    reminderBeforeMinutes: number;
  };
  workflowMetadata?: {
    initialState: string;
    terminalStates: string[];
    transitions: Array<{
      fromState: string;
      toState: string;
      actionCode: string;
      label: string;
      isTerminal?: boolean;
    }>;
  };
  getEligibleAssignees?: (resource: ResourceRef) => AssigneeUser[];
  getNextRotationAssignee?: (resource: ResourceRef, currentAssigneeId?: string) => AssigneeUser;
  formatNotification?: (event: any) => { title: string; body: string };
}
