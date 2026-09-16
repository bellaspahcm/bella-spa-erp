import {
  AppointmentService,
  BeautyApplicationError,
  ProfessionalAssignmentService,
  ResourceAllocationService,
  SessionTrackingService,
} from '../services';
import { AppointmentRecord, ProfessionalAssignmentRecord, ResourceAllocationRecord, ResourceCapacityWindow, SessionRecord } from '../../contracts';
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
      listActive: async () => [],
    };
    const service = new ProfessionalAssignmentService(repository, new TestIds(), new TestClock());
    const proposed = await service.propose({ tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', professionalId: 'pro-1' });
    await expect(service.decide(proposed, 'REJECTED', 'manager-1')).rejects.toMatchObject<BeautyApplicationError>({ code: 'REASON_REQUIRED' });
  });

  it('blocks overlapping resource allocations before persistence', async () => {
    const existing: ResourceAllocationRecord = {
      id: 'allocation-1', tenantId: 'tenant-1', serviceCommitmentId: 'commitment-1', segmentId: 'segment-1', resourceId: 'chair-1',
      interval: { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' }, capacityUnits: 1, status: 'ACTIVE', replacementForId: null, reason: null, actorId: null,
    };
    const repository: ResourceAllocationRepository = {
      create: async (value) => value,
      listActive: async () => [existing],
    };
    const availability: ResourceAvailabilityPort = {
      getWindow: async (scope): Promise<ResourceCapacityWindow> => ({ tenantId: scope.tenantId, resourceId: scope.resourceId, interval: scope.interval, capacityUnits: 1, unavailable: false }),
    };
    const service = new ResourceAllocationService(repository, availability, new TestIds(), new TestClock());
    await expect(service.allocate({ tenantId: 'tenant-1', serviceCommitmentId: 'commitment-2', segmentId: 'segment-2', resourceId: 'chair-1', interval: existing.interval, capacityUnits: 1 })).rejects.toMatchObject<BeautyApplicationError>({ code: 'RESOURCE_CAPACITY_CONFLICT' });
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
