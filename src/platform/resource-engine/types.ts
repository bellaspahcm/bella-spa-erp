/**
 * Bella EIP — Generic Resource Lifecycle Platform Contracts
 * Core Framework Primitives for Assignment, SLA, Workflow, Rotation, Rule, and Audit Engines.
 * Serves Lead, Ticket, Complaint, Opportunity, Claim, and Candidate Consumers seamlessly.
 */

export type ResourceType = 'lead' | 'ticket' | 'complaint' | 'opportunity' | 'claim' | string;

export interface ResourceRef {
  resourceType: ResourceType;
  resourceId: string;
  tenantId: string;
  moduleKey: string;
}

export interface ResourceAssignment {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  assignedToUserId: string;
  assignedToUserName: string;
  assignedByUserId: string;
  assignedByUserName: string;
  assignedAt: string;     // ISO string
  status: 'waiting_accept' | 'accepted' | 'reassigned' | 'expired';
}

export interface ResourceSLATimer {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  stage: string;          // 'accept', 'followup_1', 'response', 'resolve', etc.
  startTime: string;      // ISO string
  deadlineTime: string;   // ISO string
  isBreached: boolean;
  breachedAt?: string;    // ISO string
  isCompleted: boolean;
  completedAt?: string;   // ISO string
}

export interface ResourceRotationRecord {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  fromUserId?: string;
  fromUserName?: string;
  toUserId: string;
  toUserName: string;
  rotationNumber: number;
  reason: string;
  rotatedAt: string;     // ISO string
}

export interface ResourceAuditEvent {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  eventType: string;     // 'ASSIGNED', 'ACCEPTED', 'OUTCOME_LOGGED', 'SLA_BREACHED', 'ROTATED', 'CLOSED'
  actorId: string;
  actorName: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;     // ISO string
}

export interface ResourceRuleConfig {
  acceptWindowMinutes: number;
  stage1WindowHours: number;
  stage2WindowHours: number;
  maxAttempts: number;
  maxRotations: number;
  reminderBeforeMinutes: number;
  autoRotateOnTimeout: boolean;
  escalateOnMaxRotations: boolean;
}

/**
 * Provider contract for Domain Modules to plug custom Outcomes & States into Core WorkflowEngine
 */
export interface ResourceWorkflowProviderContract {
  resourceType: ResourceType;
  getInitialState(): string;
  getTerminalStates(): string[];
  parseOutcome(outcomeCode: string): {
    isSuccess: boolean;
    isFailure: boolean;
    requiresNextStage: boolean;
    incrementsAttemptCount: boolean;
    nextState: string;
  };
}
