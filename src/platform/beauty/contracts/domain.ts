export type AssignmentStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'DISRUPTED';
export type AllocationStatus = 'PROPOSED' | 'ACTIVE' | 'RELEASED' | 'DISRUPTED';
export type SessionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TenantScoped {
  tenantId: string;
}

export interface TimeInterval {
  startsAt: string;
  endsAt: string;
}

export interface AppointmentRecord extends TenantScoped {
  id: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  interval: TimeInterval;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface ProfessionalAssignmentRecord extends TenantScoped {
  id: string;
  serviceCommitmentId: string;
  professionalId: string;
  status: AssignmentStatus;
  replacementForId: string | null;
  reason: string | null;
  actorId: string | null;
  proposedAt: string;
  decidedAt: string | null;
}

export interface ResourceAllocationRecord extends TenantScoped {
  id: string;
  serviceCommitmentId: string;
  segmentId: string;
  resourceId: string;
  interval: TimeInterval;
  capacityUnits: number;
  status: AllocationStatus;
  replacementForId: string | null;
  reason: string | null;
  actorId: string | null;
}

export interface SessionRecord extends TenantScoped {
  id: string;
  appointmentId: string;
  serviceCommitmentId: string;
  status: SessionStatus;
  actualStartAt: string | null;
  actualEndAt: string | null;
  actualPerformerId: string | null;
  outcome: string | null;
}

export interface ResourceCapacityWindow extends TenantScoped {
  resourceId: string;
  interval: TimeInterval;
  capacityUnits: number;
  unavailable: boolean;
}
