import {
  AppointmentRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationRecord,
  SessionRecord,
  validateAllocation,
  validateAssignmentChange,
  validateSession,
  intervalsOverlap,
} from '../contracts';
import {
  AppointmentRepository,
  Clock,
  IdGenerator,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
} from './ports';

export class BeautyApplicationError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BeautyApplicationError';
  }
}

export interface CreateAppointmentCommand {
  tenantId: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  interval: AppointmentRecord['interval'];
}

export class AppointmentService {
  public constructor(
    private readonly repository: AppointmentRepository,
    private readonly ids: IdGenerator,
  ) {}

  public async create(command: CreateAppointmentCommand): Promise<AppointmentRecord> {
    const appointment: AppointmentRecord = {
      id: this.ids.next('appointment'),
      tenantId: command.tenantId,
      branchId: command.branchId,
      customerId: command.customerId,
      serviceId: command.serviceId,
      interval: command.interval,
      status: 'PENDING',
    };
    return this.repository.create(appointment);
  }
}

export interface ProposeAssignmentCommand {
  tenantId: string;
  serviceCommitmentId: string;
  professionalId: string;
}

export class ProfessionalAssignmentService {
  public constructor(
    private readonly repository: ProfessionalAssignmentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async propose(command: ProposeAssignmentCommand): Promise<ProfessionalAssignmentRecord> {
    return this.repository.create({
      id: this.ids.next('assignment'),
      tenantId: command.tenantId,
      serviceCommitmentId: command.serviceCommitmentId,
      professionalId: command.professionalId,
      status: 'PROPOSED',
      replacementForId: null,
      reason: null,
      actorId: null,
      proposedAt: this.clock.now(),
      decidedAt: null,
    });
  }

  public async decide(
    assignment: ProfessionalAssignmentRecord,
    status: 'ACCEPTED' | 'REJECTED',
    actorId: string,
    reason?: string,
  ): Promise<ProfessionalAssignmentRecord> {
    if (assignment.status !== 'PROPOSED') {
      throw new BeautyApplicationError('INVALID_ASSIGNMENT_STATE', 'Only proposed assignments can be decided.');
    }
    const next: ProfessionalAssignmentRecord = {
      ...assignment,
      status,
      actorId,
      reason: reason ?? null,
      decidedAt: this.clock.now(),
    };
    const violations = validateAssignmentChange(next);
    if (violations.length > 0) throw new BeautyApplicationError(violations[0], 'Assignment decision violates a frozen invariant.');
    return this.repository.update(next);
  }
}

export interface AllocateResourceCommand {
  tenantId: string;
  serviceCommitmentId: string;
  segmentId: string;
  resourceId: string;
  interval: ResourceAllocationRecord['interval'];
  capacityUnits: number;
}

export class ResourceAllocationService {
  public constructor(
    private readonly repository: ResourceAllocationRepository,
    private readonly availability: ResourceAvailabilityPort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async allocate(command: AllocateResourceCommand): Promise<ResourceAllocationRecord> {
    const capacity = await this.availability.getWindow({ tenantId: command.tenantId, resourceId: command.resourceId, interval: command.interval });
    const active = await this.repository.listActive({ tenantId: command.tenantId, resourceId: command.resourceId });
    if (active.some((existing) => intervalsOverlap(existing.interval, command.interval))) {
      throw new BeautyApplicationError('RESOURCE_CAPACITY_CONFLICT', 'Resource commitment overlaps an active allocation.');
    }
    const allocation: ResourceAllocationRecord = {
      id: this.ids.next('allocation'),
      tenantId: command.tenantId,
      serviceCommitmentId: command.serviceCommitmentId,
      segmentId: command.segmentId,
      resourceId: command.resourceId,
      interval: command.interval,
      capacityUnits: command.capacityUnits,
      status: 'PROPOSED',
      replacementForId: null,
      reason: null,
      actorId: null,
    };
    const violations = validateAllocation(allocation, capacity);
    if (violations.length > 0) throw new BeautyApplicationError(violations[0], 'Resource allocation violates a frozen invariant.');
    return this.repository.create(allocation);
  }
}

export class SessionTrackingService {
  public constructor(
    private readonly repository: SessionRepository,
    private readonly clock: Clock,
  ) {}

  public async start(session: SessionRecord, performerId: string): Promise<SessionRecord> {
    if (session.status !== 'PLANNED') throw new BeautyApplicationError('INVALID_SESSION_STATE', 'Only planned sessions can start.');
    const next: SessionRecord = { ...session, status: 'IN_PROGRESS', actualStartAt: this.clock.now(), actualPerformerId: performerId };
    const violations = validateSession(next);
    if (violations.length > 0) throw new BeautyApplicationError(violations[0], 'Session start violates a frozen invariant.');
    return this.repository.update(next);
  }

  public async complete(session: SessionRecord, outcome: string): Promise<SessionRecord> {
    if (session.status !== 'IN_PROGRESS') throw new BeautyApplicationError('INVALID_SESSION_STATE', 'Only in-progress sessions can complete.');
    const next: SessionRecord = { ...session, status: 'COMPLETED', actualEndAt: this.clock.now(), outcome };
    const violations = validateSession(next);
    if (violations.length > 0) throw new BeautyApplicationError(violations[0], 'Session completion violates a frozen invariant.');
    return this.repository.update(next);
  }
}
