import {
  AppointmentRecord,
  ProfessionalAssignmentHistoryRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationHistoryRecord,
  ResourceAllocationRecord,
  ResourceCapacityWindow,
  SessionRecord,
  TenantScoped,
} from '../contracts';

export interface AppointmentRepository {
  create(appointment: AppointmentRecord): Promise<AppointmentRecord>;
  getById(scope: TenantScoped & { appointmentId: string }): Promise<AppointmentRecord | null>;
  update(appointment: AppointmentRecord): Promise<AppointmentRecord>;
}

export interface ProfessionalAssignmentRepository {
  create(assignment: ProfessionalAssignmentRecord): Promise<ProfessionalAssignmentRecord>;
  update(assignment: ProfessionalAssignmentRecord): Promise<ProfessionalAssignmentRecord>;
  appendHistory(history: ProfessionalAssignmentHistoryRecord): Promise<ProfessionalAssignmentHistoryRecord>;
  listActive(scope: TenantScoped & { serviceCommitmentId: string }): Promise<ProfessionalAssignmentRecord[]>;
}

export interface ResourceAllocationRepository {
  create(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord>;
  update(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord>;
  appendHistory(history: ResourceAllocationHistoryRecord): Promise<ResourceAllocationHistoryRecord>;
  listActive(scope: TenantScoped & { resourceId: string }): Promise<ResourceAllocationRecord[]>;
}

export interface ResourceAvailabilityPort {
  getWindow(scope: TenantScoped & { resourceId: string; interval: ResourceAllocationRecord['interval'] }): Promise<ResourceCapacityWindow>;
}

export interface SessionRepository {
  create(session: SessionRecord): Promise<SessionRecord>;
  update(session: SessionRecord): Promise<SessionRecord>;
  getById(scope: TenantScoped & { sessionId: string }): Promise<SessionRecord | null>;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export interface Clock {
  now(): string;
}
