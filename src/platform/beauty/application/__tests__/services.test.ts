import {
  AppointmentService,
  BeautyApplicationError,
  ProfessionalAssignmentService,
  ResourceAllocationService,
  SessionTrackingService,
} from '../services';
import { AppointmentRecord, ProfessionalAssignmentHistoryRecord, ProfessionalAssignmentRecord, ResourceAllocationHistoryRecord, ResourceAllocationRecord, ResourceCapacityWindow, SessionRecord } from '../../contracts';
import { AppointmentRepository, Clock, IdGenerator, ProfessionalAssignmentRepository, ResourceAllocationRepository, ResourceAvailabilityPort, SessionRepository } from '../ports';

class TestIds implements IdGenerator {
  private counter = 0;
  public next(prefix: string): string { this.counter += 1; return `${prefix}-${this.counter}`; }
}

class TestClock implements Clock {
  private calls = 0;
  public now(): string {
    this.calls += 1;
    return this.calls === 1 ? '2026-09-16T10:00:00.000Z' : '2026-09-16T10:30:00.000Z';
  }
}

describe('Beauty OS H8 application services', () => {
  it('creates an appointment without forcing a professional assignment', async () => {
    let saved: AppointmentRecord | null = null;
    const repository: AppointmentRepository = {
      create: async (value) => { saved = value; return value; },
      getById: async () => saved,
      update: async (value) => { saved = value; return value; },
    };
    const appointment = await new AppointmentService(repository, new TestIds()).create({
      tenantId: 'tenant-1', branchId: 'branch-1', customerId: 'customer-1', serviceId: 'service-1',
      interval: { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' },
    });
    expect(appointment.status).toBe('PENDING');
    expect(saved?.id).toBe('appointment-1');
  });

  it('requires a reason when a professional rejects an assignment', async () => {
    const repository: ProfessionalAssignmentRepository = {
      create: async (value) => value,
      update: async (value) => value,
      appendHistory: async (value) => value,
      listActive: async () => [],
    };
    const service = new ProfessionalAssignmentService(repository, new TestIds(), new TestClock());
    const proposed = await service.propose({ tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', professionalId: 'pro-1' });
    await expect(service.decide(proposed, 'REJECTED', 'manager-1')).rejects.toMatchObject<BeautyApplicationError>({ code: 'REASON_REQUIRED' });
  });

  it('disrupts an accepted assignment by creating a replacement and history event', async () => {
    const updated: ProfessionalAssignmentRecord[] = [];
    const created: ProfessionalAssignmentRecord[] = [];
    const history: ProfessionalAssignmentHistoryRecord[] = [];
    const repository: ProfessionalAssignmentRepository = {
      create: async (value) => { created.push(value); return value; },
      update: async (value) => { updated.push(value); return value; },
      appendHistory: async (value) => { history.push(value); return value; },
      listActive: async () => [],
    };
    const service = new ProfessionalAssignmentService(repository, new TestIds(), new TestClock());
    const replacement = await service.disruptAndReplace({
      assignment: {
        id: 'existing-assignment-1', tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', professionalId: 'professional-a',
        status: 'ACCEPTED', replacementForId: null, reason: null, actorId: 'manager-1', proposedAt: '2026-09-16T09:55:00.000Z', decidedAt: '2026-09-16T10:00:00.000Z',
      },
      replacementProfessionalId: 'professional-b',
      actorId: 'manager-2',
      reason: 'STAFF_NO_SHOW',
    });
    expect(updated[0]?.status).toBe('DISRUPTED');
    expect(replacement.replacementForId).toBe('existing-assignment-1');
    expect(replacement.professionalId).toBe('professional-b');
    expect(history[0]).toMatchObject({ assignmentId: 'existing-assignment-1', fromProfessionalId: 'professional-a', toProfessionalId: 'professional-b', reason: 'STAFF_NO_SHOW' });
  });

  it('blocks overlapping resource allocations only when capacity is exhausted', async () => {
    const existing: ResourceAllocationRecord = {
      id: 'allocation-1', tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', segmentId: 'segment-1', resourceId: 'chair-1',
      interval: { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' }, capacityUnits: 1, status: 'ACTIVE', replacementForId: null, reason: null, actorId: null,
    };
    const repository: ResourceAllocationRepository = {
      create: async (value) => value,
      update: async (value) => value,
      appendHistory: async (value) => value,
      listActive: async () => [existing],
    };
    const availability: ResourceAvailabilityPort = {
      getWindow: async (scope): Promise<ResourceCapacityWindow> => ({ tenantId: scope.tenantId, resourceId: scope.resourceId, interval: scope.interval, capacityUnits: 1, unavailable: false }),
    };
    const service = new ResourceAllocationService(repository, availability, new TestIds(), new TestClock());
    await expect(service.allocate({ tenantId: 'tenant-1', serviceCommitmentId: 'commitment-2', segmentId: 'segment-2', resourceId: 'chair-1', interval: existing.interval, capacityUnits: 1 })).rejects.toMatchObject<BeautyApplicationError>({ code: 'RESOURCE_CAPACITY_CONFLICT' });
  });

  it('reallocates a resource by preserving the disrupted allocation and replacement history', async () => {
    const original: ResourceAllocationRecord = {
      id: 'existing-allocation-1', tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', segmentId: 'wash-segment', resourceId: 'wash-chair-1',
      interval: { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' }, capacityUnits: 1, status: 'ACTIVE', replacementForId: null, reason: null, actorId: null,
    };
    const updated: ResourceAllocationRecord[] = [];
    const created: ResourceAllocationRecord[] = [];
    const history: ResourceAllocationHistoryRecord[] = [];
    const repository: ResourceAllocationRepository = {
      create: async (value) => { created.push(value); return value; },
      update: async (value) => { updated.push(value); return value; },
      appendHistory: async (value) => { history.push(value); return value; },
      listActive: async () => [],
    };
    const availability: ResourceAvailabilityPort = {
      getWindow: async (scope): Promise<ResourceCapacityWindow> => ({ tenantId: scope.tenantId, resourceId: scope.resourceId, interval: scope.interval, capacityUnits: 1, unavailable: false }),
    };
    const service = new ResourceAllocationService(repository, availability, new TestIds(), new TestClock());
    const replacement = await service.reallocate({ allocation: original, replacementResourceId: 'wash-chair-2', actorId: 'manager-1', reason: 'RESOURCE_UNAVAILABLE' });
    expect(updated[0]).toMatchObject({ id: 'existing-allocation-1', status: 'DISRUPTED', reason: 'RESOURCE_UNAVAILABLE' });
    expect(replacement).toMatchObject({ resourceId: 'wash-chair-2', replacementForId: 'existing-allocation-1', status: 'PROPOSED' });
    expect(history[0]).toMatchObject({ allocationId: 'existing-allocation-1', replacementAllocationId: replacement.id, oldResourceId: 'wash-chair-1', newResourceId: 'wash-chair-2' });
  });

  it('finds only active allocations affected by a resource unavailable window', async () => {
    const allocations: ResourceAllocationRecord[] = [
      {
        id: 'allocation-before', tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', segmentId: 'segment-1', resourceId: 'chair-1',
        interval: { startsAt: '2026-09-16T09:00:00.000Z', endsAt: '2026-09-16T10:00:00.000Z' }, capacityUnits: 1, status: 'ACTIVE', replacementForId: null, reason: null, actorId: null,
      },
      {
        id: 'allocation-affected', tenantId: 'tenant-1', serviceCommitmentId: 'commitment-2', segmentId: 'segment-2', resourceId: 'chair-1',
        interval: { startsAt: '2026-09-16T10:15:00.000Z', endsAt: '2026-09-16T10:45:00.000Z' }, capacityUnits: 1, status: 'ACTIVE', replacementForId: null, reason: null, actorId: null,
      },
    ];
    const repository: ResourceAllocationRepository = {
      create: async (value) => value,
      update: async (value) => value,
      appendHistory: async (value) => value,
      listActive: async () => allocations,
    };
    const availability: ResourceAvailabilityPort = {
      getWindow: async (scope): Promise<ResourceCapacityWindow> => ({ tenantId: scope.tenantId, resourceId: scope.resourceId, interval: scope.interval, capacityUnits: 1, unavailable: false }),
    };
    const service = new ResourceAllocationService(repository, availability, new TestIds(), new TestClock());
    const affected = await service.findAffectedAllocations({
      tenantId: 'tenant-1',
      resourceId: 'chair-1',
      unavailableInterval: { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' },
    });
    expect(affected.map((allocation) => allocation.id)).toEqual(['allocation-affected']);
  });

  it('records the actual performer on session start and preserves it through completion', async () => {
    const session: SessionRecord = { id: 'session-1', tenantId: 'tenant-1', appointmentId: 'appointment-1', serviceCommitmentId: 'commitment-1', status: 'PLANNED', actualStartAt: null, actualEndAt: null, actualPerformerId: null, outcome: null };
    let saved = session;
    const repository: SessionRepository = { create: async (value) => value, update: async (value) => { saved = value; return value; }, getById: async () => saved };
    const service = new SessionTrackingService(repository, new TestClock());
    await service.start(session, 'professional-2');
    const completed = await service.complete(saved, 'service completed');
    expect(completed.actualPerformerId).toBe('professional-2');
    expect(completed.status).toBe('COMPLETED');
  });
});
