import {
  AppointmentService,
  ProfessionalAssignmentService,
  ResourceAllocationService,
  SessionTrackingService,
} from '../services';
import { AppointmentRepository, Clock, IdGenerator, ProfessionalAssignmentRepository, ResourceAllocationRepository, ResourceAvailabilityPort, SessionRepository } from '../ports';
import { AppointmentRecord, ProfessionalAssignmentRecord, ResourceAllocationRecord, ResourceCapacityWindow, SessionRecord } from '../../contracts';

class WorkflowIds implements IdGenerator {
  private value = 0;
  public next(prefix: string): string { this.value += 1; return `${prefix}-${this.value}`; }
}

class WorkflowClock implements Clock {
  private value = 0;
  public now(): string {
    this.value += 1;
    return `2026-09-16T10:${String(this.value).padStart(2, '0')}:00.000Z`;
  }
}

describe('Bella Haircut H8 golden operational workflow', () => {
  it('keeps planned assignment, resource allocation, and actual execution distinct', async () => {
    let appointment: AppointmentRecord | null = null;
    let assignment: ProfessionalAssignmentRecord | null = null;
    const allocation: ResourceAllocationRecord[] = [];
    let session: SessionRecord = {
      id: 'session-1', tenantId: 'tenant-1', appointmentId: 'pending', serviceCommitmentId: 'commitment-1',
      status: 'PLANNED', actualStartAt: null, actualEndAt: null, actualPerformerId: null, outcome: null,
    };
    const appointmentRepository: AppointmentRepository = {
      create: async (value) => { appointment = value; return value; },
      getById: async () => appointment,
      update: async (value) => { appointment = value; return value; },
    };
    const assignmentRepository: ProfessionalAssignmentRepository = {
      create: async (value) => { assignment = value; return value; },
      update: async (value) => { assignment = value; return value; },
      appendHistory: async (value) => value,
      listActive: async () => [],
    };
    const allocationRepository: ResourceAllocationRepository = {
      create: async (value) => { allocation.push(value); return value; },
      update: async (value) => value,
      appendHistory: async (value) => value,
      listActive: async () => [],
    };
    const availability: ResourceAvailabilityPort = {
      getWindow: async (scope): Promise<ResourceCapacityWindow> => ({ tenantId: scope.tenantId, resourceId: scope.resourceId, interval: scope.interval, capacityUnits: 1, unavailable: false }),
    };
    const sessionRepository: SessionRepository = {
      create: async (value) => value,
      update: async (value) => { session = value; return value; },
      getById: async () => session,
    };
    const ids = new WorkflowIds();
    const clock = new WorkflowClock();
    const appointmentService = new AppointmentService(appointmentRepository, ids);
    const assignmentService = new ProfessionalAssignmentService(assignmentRepository, ids, clock);
    const allocationService = new ResourceAllocationService(allocationRepository, availability, ids, clock);
    const sessionService = new SessionTrackingService(sessionRepository, clock);

    const created = await appointmentService.create({
      tenantId: 'tenant-1', branchId: 'branch-1', customerId: 'customer-1', serviceId: 'service-1',
      interval: { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' },
    });
    session = { ...session, appointmentId: created.id };
    const proposed = await assignmentService.propose({ tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', professionalId: 'professional-a' });
    await assignmentService.decide(proposed, 'ACCEPTED', 'manager-1');
    const plannedAllocation = await allocationService.allocate({
      tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', segmentId: 'segment-1', resourceId: 'chair-1',
      interval: created.interval, capacityUnits: 1,
    });
    const started = await sessionService.start(session, 'professional-b');
    const completed = await sessionService.complete(started, 'completed');

    expect(created.status).toBe('PENDING');
    expect(assignment?.professionalId).toBe('professional-a');
    expect(plannedAllocation.resourceId).toBe('chair-1');
    expect(completed.actualPerformerId).toBe('professional-b');
    expect(completed.status).toBe('COMPLETED');
    expect(allocation).toHaveLength(1);
  });

  it('recovers from professional and resource disruption before producing operational facts', async () => {
    const assignments: ProfessionalAssignmentRecord[] = [];
    const allocations: ResourceAllocationRecord[] = [];
    let session: SessionRecord = {
      id: 'session-2', tenantId: 'tenant-1', appointmentId: 'appointment-2', serviceCommitmentId: 'commitment-2',
      status: 'PLANNED', actualStartAt: null, actualEndAt: null, actualPerformerId: null, outcome: null,
    };
    const appointmentRepository: AppointmentRepository = {
      create: async (value) => value,
      getById: async () => null,
      update: async (value) => value,
    };
    const assignmentRepository: ProfessionalAssignmentRepository = {
      create: async (value) => { assignments.push(value); return value; },
      update: async (value) => {
        const index = assignments.findIndex((assignment) => assignment.id === value.id);
        if (index >= 0) assignments[index] = value;
        return value;
      },
      appendHistory: async (value) => value,
      listActive: async () => assignments.filter((assignment) => assignment.serviceCommitmentId === 'commitment-2' && assignment.status === 'ACCEPTED'),
    };
    const allocationRepository: ResourceAllocationRepository = {
      create: async (value) => { allocations.push(value); return value; },
      update: async (value) => {
        const index = allocations.findIndex((allocation) => allocation.id === value.id);
        if (index >= 0) allocations[index] = value;
        return value;
      },
      appendHistory: async (value) => value,
      listActive: async (scope) => allocations.filter((allocation) => allocation.resourceId === scope.resourceId && allocation.status === 'ACTIVE'),
    };
    const availability: ResourceAvailabilityPort = {
      getWindow: async (scope): Promise<ResourceCapacityWindow> => ({ tenantId: scope.tenantId, resourceId: scope.resourceId, interval: scope.interval, capacityUnits: 1, unavailable: false }),
    };
    const sessionRepository: SessionRepository = {
      create: async (value) => value,
      update: async (value) => { session = value; return value; },
      getById: async () => session,
    };
    const ids = new WorkflowIds();
    const clock = new WorkflowClock();
    const appointmentService = new AppointmentService(appointmentRepository, ids);
    const assignmentService = new ProfessionalAssignmentService(assignmentRepository, ids, clock);
    const allocationService = new ResourceAllocationService(allocationRepository, availability, ids, clock);
    const sessionService = new SessionTrackingService(sessionRepository, clock);

    const appointment = await appointmentService.create({
      tenantId: 'tenant-1', branchId: 'branch-1', customerId: 'customer-2', serviceId: 'service-color',
      interval: { startsAt: '2026-09-16T11:00:00.000Z', endsAt: '2026-09-16T12:00:00.000Z' },
    });
    const initialAssignment = await assignmentService.propose({ tenantId: 'tenant-1', serviceCommitmentId: 'commitment-2', professionalId: 'professional-a' });
    const acceptedAssignment = await assignmentService.decide(initialAssignment, 'ACCEPTED', 'manager-1');
    const replacementAssignment = await assignmentService.disruptAndReplace({
      assignment: acceptedAssignment,
      replacementProfessionalId: 'professional-b',
      actorId: 'manager-1',
      reason: 'STAFF_NO_SHOW',
    });
    const acceptedReplacement = await assignmentService.decide(replacementAssignment, 'ACCEPTED', 'manager-1');
    const initialAllocation = await allocationService.allocate({
      tenantId: 'tenant-1', serviceCommitmentId: 'commitment-2', segmentId: 'wash-segment', resourceId: 'wash-chair-1',
      interval: appointment.interval, capacityUnits: 1,
    });
    await allocationRepository.update({ ...initialAllocation, status: 'ACTIVE' });
    const affected = await allocationService.findAffectedAllocations({
      tenantId: 'tenant-1',
      resourceId: 'wash-chair-1',
      unavailableInterval: { startsAt: '2026-09-16T11:15:00.000Z', endsAt: '2026-09-16T11:45:00.000Z' },
    });
    const replacementAllocation = await allocationService.reallocate({
      allocation: affected[0],
      replacementResourceId: 'wash-chair-2',
      actorId: 'manager-1',
      reason: 'RESOURCE_UNAVAILABLE',
    });
    const started = await sessionService.start(session, acceptedReplacement.professionalId);
    const completed = await sessionService.complete(started, 'service completed');

    expect(assignments.find((assignment) => assignment.id === acceptedAssignment.id)?.status).toBe('DISRUPTED');
    expect(acceptedReplacement).toMatchObject({ professionalId: 'professional-b', status: 'ACCEPTED', replacementForId: acceptedAssignment.id });
    expect(affected.map((allocation) => allocation.id)).toEqual([initialAllocation.id]);
    expect(allocations.find((allocation) => allocation.id === initialAllocation.id)?.status).toBe('DISRUPTED');
    expect(replacementAllocation).toMatchObject({ resourceId: 'wash-chair-2', replacementForId: initialAllocation.id });
    expect(completed).toMatchObject({ actualPerformerId: 'professional-b', status: 'COMPLETED', outcome: 'service completed' });
  });
});
