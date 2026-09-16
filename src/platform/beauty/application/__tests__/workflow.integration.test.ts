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
});
