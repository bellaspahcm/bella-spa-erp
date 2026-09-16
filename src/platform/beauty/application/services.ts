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

export interface ReplaceAssignmentCommand {
  assignment: ProfessionalAssignmentRecord;
  replacementProfessionalId: string;
  actorId: string;
  reason: string;
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

  public async disruptAndReplace(command: ReplaceAssignmentCommand): Promise<ProfessionalAssignmentRecord> {
    if (command.assignment.status !== 'ACCEPTED') {
      throw new BeautyApplicationError('INVALID_ASSIGNMENT_STATE', 'Only accepted assignments can be disrupted for replacement.');
    }
    const disruptedAt = this.clock.now();
    const disrupted: ProfessionalAssignmentRecord = {
      ...command.assignment,
      status: 'DISRUPTED',
      reason: command.reason,
      actorId: command.actorId,
      decidedAt: disruptedAt,
    };
    const disruptedViolations = validateAssignmentChange(disrupted);
    if (disruptedViolations.length > 0) throw new BeautyApplicationError(disruptedViolations[0], 'Assignment disruption violates a frozen invariant.');
    await this.repository.update(disrupted);

    const replacement: ProfessionalAssignmentRecord = {
      id: this.ids.next('assignment'),
      tenantId: command.assignment.tenantId,
      serviceCommitmentId: command.assignment.serviceCommitmentId,
      professionalId: command.replacementProfessionalId,
      status: 'PROPOSED',
      replacementForId: command.assignment.id,
      reason: null,
      actorId: null,
      proposedAt: this.clock.now(),
      decidedAt: null,
    };
    const replacementViolations = validateAssignmentChange(replacement);
    if (replacementViolations.length > 0) throw new BeautyApplicationError(replacementViolations[0], 'Replacement assignment violates a frozen invariant.');
    const created = await this.repository.create(replacement);
    await this.repository.appendHistory({
      id: this.ids.next('assignment-history'),
      tenantId: command.assignment.tenantId,
      assignmentId: command.assignment.id,
      fromProfessionalId: command.assignment.professionalId,
      toProfessionalId: command.replacementProfessionalId,
      eventType: 'DISRUPTED_REPLACED',
      reason: command.reason,
      actorId: command.actorId,
      occurredAt: disruptedAt,
    });
    return created;
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

export interface ReallocateResourceCommand {
  allocation: ResourceAllocationRecord;
  replacementResourceId: string;
  actorId: string;
  reason: string;
}

export interface FindAffectedAllocationsCommand {
  tenantId: string;
  resourceId: string;
  unavailableInterval: ResourceAllocationRecord['interval'];
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
    const overlappingCapacity = active
      .filter((existing) => intervalsOverlap(existing.interval, command.interval))
      .reduce((total, existing) => total + existing.capacityUnits, 0);
    if (overlappingCapacity + command.capacityUnits > capacity.capacityUnits) {
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

  public async reallocate(command: ReallocateResourceCommand): Promise<ResourceAllocationRecord> {
    if (command.allocation.status !== 'ACTIVE' && command.allocation.status !== 'PROPOSED') {
      throw new BeautyApplicationError('INVALID_ALLOCATION_STATE', 'Only proposed or active allocations can be reallocated.');
    }
    if (command.replacementResourceId === command.allocation.resourceId) {
      throw new BeautyApplicationError('INVALID_REPLACEMENT_RESOURCE', 'Replacement resource must differ from the disrupted resource.');
    }
    const capacity = await this.availability.getWindow({
      tenantId: command.allocation.tenantId,
      resourceId: command.replacementResourceId,
      interval: command.allocation.interval,
    });
    const active = await this.repository.listActive({ tenantId: command.allocation.tenantId, resourceId: command.replacementResourceId });
    const overlappingCapacity = active
      .filter((existing) => intervalsOverlap(existing.interval, command.allocation.interval))
      .reduce((total, existing) => total + existing.capacityUnits, 0);
    if (overlappingCapacity + command.allocation.capacityUnits > capacity.capacityUnits) {
      throw new BeautyApplicationError('RESOURCE_CAPACITY_CONFLICT', 'Replacement resource capacity is exhausted.');
    }

    const disrupted: ResourceAllocationRecord = {
      ...command.allocation,
      status: 'DISRUPTED',
      reason: command.reason,
      actorId: command.actorId,
    };
    const disruptedViolations = validateAllocation(disrupted, {
      tenantId: command.allocation.tenantId,
      resourceId: command.allocation.resourceId,
      interval: command.allocation.interval,
      capacityUnits: Math.max(command.allocation.capacityUnits, 1),
      unavailable: false,
    });
    if (disruptedViolations.length > 0) throw new BeautyApplicationError(disruptedViolations[0], 'Resource disruption violates a frozen invariant.');
    await this.repository.update(disrupted);

    const replacement: ResourceAllocationRecord = {
      ...command.allocation,
      id: this.ids.next('allocation'),
      resourceId: command.replacementResourceId,
      status: 'PROPOSED',
      replacementForId: command.allocation.id,
      reason: null,
      actorId: null,
    };
    const replacementViolations = validateAllocation(replacement, capacity);
    if (replacementViolations.length > 0) throw new BeautyApplicationError(replacementViolations[0], 'Replacement allocation violates a frozen invariant.');
    const created = await this.repository.create(replacement);
    await this.repository.appendHistory({
      id: this.ids.next('allocation-history'),
      tenantId: command.allocation.tenantId,
      allocationId: command.allocation.id,
      replacementAllocationId: created.id,
      oldResourceId: command.allocation.resourceId,
      newResourceId: command.replacementResourceId,
      segmentId: command.allocation.segmentId,
      eventType: 'RESOURCE_REALLOCATED',
      reason: command.reason,
      actorId: command.actorId,
      occurredAt: this.clock.now(),
    });
    return created;
  }

  public async findAffectedAllocations(command: FindAffectedAllocationsCommand): Promise<ResourceAllocationRecord[]> {
    const active = await this.repository.listActive({ tenantId: command.tenantId, resourceId: command.resourceId });
    return active.filter((allocation) => intervalsOverlap(allocation.interval, command.unavailableInterval));
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
