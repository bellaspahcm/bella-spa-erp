import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AllocationStatus,
  AppointmentRecord,
  AssignmentStatus,
  ProfessionalAssignmentHistoryRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationHistoryRecord,
  ResourceAllocationRecord,
  SessionRecord,
  SessionStatus,
  TenantScoped,
} from '../contracts';
import type {
  AppointmentRepository,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  SessionRepository,
} from '../application/ports';
import type { BeautyH8Database, BeautyH8Tables } from './beauty-h8.database.generated';

type BeautySupabaseClient = SupabaseClient<BeautyH8Database>;
type BeautyAppointmentRow = BeautyH8Tables['beauty_appointments']['Row'];
type BeautyAppointmentInsert = BeautyH8Tables['beauty_appointments']['Insert'];
type BeautyAppointmentUpdate = BeautyH8Tables['beauty_appointments']['Update'];
type BeautyAssignmentRow = BeautyH8Tables['beauty_professional_assignments']['Row'];
type BeautyAssignmentInsert = BeautyH8Tables['beauty_professional_assignments']['Insert'];
type BeautyAssignmentUpdate = BeautyH8Tables['beauty_professional_assignments']['Update'];
type BeautyAssignmentHistoryInsert = BeautyH8Tables['beauty_professional_assignment_history']['Insert'];
type BeautyAllocationRow = BeautyH8Tables['beauty_resource_allocations']['Row'];
type BeautyAllocationInsert = BeautyH8Tables['beauty_resource_allocations']['Insert'];
type BeautyAllocationUpdate = BeautyH8Tables['beauty_resource_allocations']['Update'];
type BeautyAllocationHistoryInsert = BeautyH8Tables['beauty_resource_allocation_history']['Insert'];
type BeautySessionRow = BeautyH8Tables['beauty_sessions']['Row'];
type BeautySessionInsert = BeautyH8Tables['beauty_sessions']['Insert'];
type BeautySessionUpdate = BeautyH8Tables['beauty_sessions']['Update'];

const appointmentStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const assignmentStatuses = ['PROPOSED', 'ACCEPTED', 'REJECTED', 'DISRUPTED'] as const;
const allocationStatuses = ['PROPOSED', 'ACTIVE', 'RELEASED', 'DISRUPTED'] as const;
const sessionStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class BeautySupabaseRepositoryError extends Error {
  public constructor(operation: string, message: string) {
    super(`${operation}: ${message}`);
    this.name = 'BeautySupabaseRepositoryError';
  }
}

export class SupabaseBeautyAppointmentRepository implements AppointmentRepository {
  public constructor(private readonly client: BeautySupabaseClient) {}

  public async create(appointment: AppointmentRecord): Promise<AppointmentRecord> {
    const insert: BeautyAppointmentInsert = {
      id: appointment.id,
      tenant_id: appointment.tenantId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      service_id: appointment.serviceId,
      starts_at: appointment.interval.startsAt,
      ends_at: appointment.interval.endsAt,
      status: appointment.status,
    };

    const { data, error } = await this.client
      .from('beauty_appointments')
      .insert(insert)
      .select()
      .single();

    return mapAppointment(expectRow(data, error, 'create beauty appointment'));
  }

  public async getById(scope: TenantScoped & { appointmentId: string }): Promise<AppointmentRecord | null> {
    const { data, error } = await this.client
      .from('beauty_appointments')
      .select()
      .eq('tenant_id', scope.tenantId)
      .eq('id', scope.appointmentId)
      .maybeSingle();

    if (error) throw new BeautySupabaseRepositoryError('get beauty appointment', error.message);
    return data ? mapAppointment(data) : null;
  }

  public async update(appointment: AppointmentRecord): Promise<AppointmentRecord> {
    const update: BeautyAppointmentUpdate = {
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      service_id: appointment.serviceId,
      starts_at: appointment.interval.startsAt,
      ends_at: appointment.interval.endsAt,
      status: appointment.status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('beauty_appointments')
      .update(update)
      .eq('tenant_id', appointment.tenantId)
      .eq('id', appointment.id)
      .select()
      .single();

    return mapAppointment(expectRow(data, error, 'update beauty appointment'));
  }
}

export class SupabaseBeautyProfessionalAssignmentRepository implements ProfessionalAssignmentRepository {
  public constructor(private readonly client: BeautySupabaseClient) {}

  public async create(assignment: ProfessionalAssignmentRecord): Promise<ProfessionalAssignmentRecord> {
    const insert: BeautyAssignmentInsert = {
      id: assignment.id,
      tenant_id: assignment.tenantId,
      service_commitment_id: assignment.serviceCommitmentId,
      professional_id: assignment.professionalId,
      status: assignment.status,
      replacement_for_id: assignment.replacementForId,
      reason: assignment.reason,
      actor_id: assignment.actorId,
      proposed_at: assignment.proposedAt,
      decided_at: assignment.decidedAt,
    };

    const { data, error } = await this.client
      .from('beauty_professional_assignments')
      .insert(insert)
      .select()
      .single();

    return mapAssignment(expectRow(data, error, 'create beauty professional assignment'));
  }

  public async update(assignment: ProfessionalAssignmentRecord): Promise<ProfessionalAssignmentRecord> {
    const update: BeautyAssignmentUpdate = {
      service_commitment_id: assignment.serviceCommitmentId,
      professional_id: assignment.professionalId,
      status: assignment.status,
      replacement_for_id: assignment.replacementForId,
      reason: assignment.reason,
      actor_id: assignment.actorId,
      proposed_at: assignment.proposedAt,
      decided_at: assignment.decidedAt,
    };

    const { data, error } = await this.client
      .from('beauty_professional_assignments')
      .update(update)
      .eq('tenant_id', assignment.tenantId)
      .eq('id', assignment.id)
      .select()
      .single();

    return mapAssignment(expectRow(data, error, 'update beauty professional assignment'));
  }

  public async appendHistory(history: ProfessionalAssignmentHistoryRecord): Promise<ProfessionalAssignmentHistoryRecord> {
    const insert: BeautyAssignmentHistoryInsert = {
      id: history.id,
      tenant_id: history.tenantId,
      assignment_id: history.assignmentId,
      from_professional_id: history.fromProfessionalId,
      to_professional_id: history.toProfessionalId,
      event_type: history.eventType,
      reason: history.reason,
      actor_id: history.actorId,
      occurred_at: history.occurredAt,
    };

    const { data, error } = await this.client
      .from('beauty_professional_assignment_history')
      .insert(insert)
      .select()
      .single();

    const row = expectRow(data, error, 'append beauty assignment history');
    return {
      id: row.id,
      tenantId: row.tenant_id,
      assignmentId: row.assignment_id,
      fromProfessionalId: row.from_professional_id,
      toProfessionalId: row.to_professional_id,
      eventType: row.event_type,
      reason: row.reason,
      actorId: row.actor_id,
      occurredAt: row.occurred_at,
    };
  }

  public async listActive(scope: TenantScoped & { serviceCommitmentId: string }): Promise<ProfessionalAssignmentRecord[]> {
    const { data, error } = await this.client
      .from('beauty_professional_assignments')
      .select()
      .eq('tenant_id', scope.tenantId)
      .eq('service_commitment_id', scope.serviceCommitmentId)
      .eq('status', 'ACCEPTED');

    if (error) throw new BeautySupabaseRepositoryError('list active beauty professional assignments', error.message);
    return (data ?? []).map(mapAssignment);
  }
}

export class SupabaseBeautyResourceAllocationRepository implements ResourceAllocationRepository {
  public constructor(private readonly client: BeautySupabaseClient) {}

  public async create(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord> {
    const insert: BeautyAllocationInsert = {
      id: allocation.id,
      tenant_id: allocation.tenantId,
      service_commitment_id: allocation.serviceCommitmentId,
      segment_id: allocation.segmentId,
      resource_id: allocation.resourceId,
      starts_at: allocation.interval.startsAt,
      ends_at: allocation.interval.endsAt,
      capacity_units: allocation.capacityUnits,
      status: allocation.status,
      replacement_for_id: allocation.replacementForId,
      reason: allocation.reason,
      actor_id: allocation.actorId,
    };

    const { data, error } = await this.client
      .from('beauty_resource_allocations')
      .insert(insert)
      .select()
      .single();

    return mapAllocation(expectRow(data, error, 'create beauty resource allocation'));
  }

  public async update(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord> {
    const update: BeautyAllocationUpdate = {
      service_commitment_id: allocation.serviceCommitmentId,
      segment_id: allocation.segmentId,
      resource_id: allocation.resourceId,
      starts_at: allocation.interval.startsAt,
      ends_at: allocation.interval.endsAt,
      capacity_units: allocation.capacityUnits,
      status: allocation.status,
      replacement_for_id: allocation.replacementForId,
      reason: allocation.reason,
      actor_id: allocation.actorId,
      released_at: allocation.status === 'RELEASED' ? new Date().toISOString() : undefined,
    };

    const { data, error } = await this.client
      .from('beauty_resource_allocations')
      .update(update)
      .eq('tenant_id', allocation.tenantId)
      .eq('id', allocation.id)
      .select()
      .single();

    return mapAllocation(expectRow(data, error, 'update beauty resource allocation'));
  }

  public async appendHistory(history: ResourceAllocationHistoryRecord): Promise<ResourceAllocationHistoryRecord> {
    const insert: BeautyAllocationHistoryInsert = {
      id: history.id,
      tenant_id: history.tenantId,
      allocation_id: history.allocationId,
      replacement_allocation_id: history.replacementAllocationId,
      old_resource_id: history.oldResourceId,
      new_resource_id: history.newResourceId,
      segment_id: history.segmentId,
      event_type: history.eventType,
      reason: history.reason,
      actor_id: history.actorId,
      occurred_at: history.occurredAt,
    };

    const { data, error } = await this.client
      .from('beauty_resource_allocation_history')
      .insert(insert)
      .select()
      .single();

    const row = expectRow(data, error, 'append beauty allocation history');
    return {
      id: row.id,
      tenantId: row.tenant_id,
      allocationId: row.allocation_id,
      replacementAllocationId: row.replacement_allocation_id,
      oldResourceId: row.old_resource_id,
      newResourceId: row.new_resource_id ?? history.newResourceId,
      segmentId: row.segment_id,
      eventType: row.event_type,
      reason: row.reason,
      actorId: row.actor_id,
      occurredAt: row.occurred_at,
    };
  }

  public async listActive(scope: TenantScoped & { resourceId: string }): Promise<ResourceAllocationRecord[]> {
    const { data, error } = await this.client
      .from('beauty_resource_allocations')
      .select()
      .eq('tenant_id', scope.tenantId)
      .eq('resource_id', scope.resourceId)
      .eq('status', 'ACTIVE');

    if (error) throw new BeautySupabaseRepositoryError('list active beauty resource allocations', error.message);
    return (data ?? []).map(mapAllocation);
  }
}

export class SupabaseBeautySessionRepository implements SessionRepository {
  public constructor(private readonly client: BeautySupabaseClient) {}

  public async create(session: SessionRecord): Promise<SessionRecord> {
    const insert: BeautySessionInsert = {
      id: session.id,
      tenant_id: session.tenantId,
      appointment_id: session.appointmentId,
      service_commitment_id: session.serviceCommitmentId,
      status: session.status,
      actual_start_at: session.actualStartAt,
      actual_end_at: session.actualEndAt,
      actual_performer_id: session.actualPerformerId,
      outcome: session.outcome,
    };

    const { data, error } = await this.client
      .from('beauty_sessions')
      .insert(insert)
      .select()
      .single();

    return mapSession(expectRow(data, error, 'create beauty session'));
  }

  public async update(session: SessionRecord): Promise<SessionRecord> {
    const update: BeautySessionUpdate = {
      appointment_id: session.appointmentId,
      service_commitment_id: session.serviceCommitmentId,
      status: session.status,
      actual_start_at: session.actualStartAt,
      actual_end_at: session.actualEndAt,
      actual_performer_id: session.actualPerformerId,
      outcome: session.outcome,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('beauty_sessions')
      .update(update)
      .eq('tenant_id', session.tenantId)
      .eq('id', session.id)
      .select()
      .single();

    return mapSession(expectRow(data, error, 'update beauty session'));
  }

  public async getById(scope: TenantScoped & { sessionId: string }): Promise<SessionRecord | null> {
    const { data, error } = await this.client
      .from('beauty_sessions')
      .select()
      .eq('tenant_id', scope.tenantId)
      .eq('id', scope.sessionId)
      .maybeSingle();

    if (error) throw new BeautySupabaseRepositoryError('get beauty session', error.message);
    return data ? mapSession(data) : null;
  }
}

function mapAppointment(row: BeautyAppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    interval: { startsAt: row.starts_at, endsAt: row.ends_at },
    status: requireStatus(appointmentStatuses, row.status, 'beauty appointment status'),
  };
}

function mapAssignment(row: BeautyAssignmentRow): ProfessionalAssignmentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    serviceCommitmentId: row.service_commitment_id,
    professionalId: row.professional_id,
    status: requireStatus<AssignmentStatus>(assignmentStatuses, row.status, 'beauty assignment status'),
    replacementForId: row.replacement_for_id,
    reason: row.reason,
    actorId: row.actor_id,
    proposedAt: row.proposed_at,
    decidedAt: row.decided_at,
  };
}

function mapAllocation(row: BeautyAllocationRow): ResourceAllocationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    serviceCommitmentId: row.service_commitment_id,
    segmentId: row.segment_id,
    resourceId: row.resource_id,
    interval: { startsAt: row.starts_at, endsAt: row.ends_at },
    capacityUnits: row.capacity_units,
    status: requireStatus<AllocationStatus>(allocationStatuses, row.status, 'beauty allocation status'),
    replacementForId: row.replacement_for_id,
    reason: row.reason,
    actorId: row.actor_id,
  };
}

function mapSession(row: BeautySessionRow): SessionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    appointmentId: row.appointment_id,
    serviceCommitmentId: row.service_commitment_id,
    status: requireStatus<SessionStatus>(sessionStatuses, row.status, 'beauty session status'),
    actualStartAt: row.actual_start_at,
    actualEndAt: row.actual_end_at,
    actualPerformerId: row.actual_performer_id,
    outcome: row.outcome,
  };
}

function expectRow<TRow>(row: TRow | null, error: { message: string } | null, operation: string): TRow {
  if (error) throw new BeautySupabaseRepositoryError(operation, error.message);
  if (!row) throw new BeautySupabaseRepositoryError(operation, 'Supabase returned no row.');
  return row;
}

function requireStatus<TStatus extends string>(
  allowed: readonly TStatus[],
  value: string,
  label: string,
): TStatus {
  const match = allowed.find((candidate) => candidate === value);
  if (!match) throw new BeautySupabaseRepositoryError('map Beauty H8 row', `Unexpected ${label}: ${value}`);
  return match;
}
