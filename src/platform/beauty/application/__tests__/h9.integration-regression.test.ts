import type { IServiceCatalog, IWaitlistEngine, Service, ServiceBranchAvailability } from '../../../contracts/v1';
import type {
  AppointmentRecord,
  ProfessionalAssignmentHistoryRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationHistoryRecord,
  ResourceAllocationRecord,
  ResourceCapacityWindow,
  SessionRecord,
  TenantScoped,
} from '../../contracts';
import { ServiceCatalogAdapter, WaitlistAdapter } from '../adapters';
import type {
  AppointmentRepository,
  Clock,
  IdGenerator,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
} from '../ports';
import {
  AppointmentService,
  BeautyApplicationError,
  ProfessionalAssignmentService,
  ResourceAllocationService,
  SessionTrackingService,
} from '../services';

class H9Ids implements IdGenerator {
  private value = 0;

  public next(prefix: string): string {
    this.value += 1;
    return `${prefix}-h9-${this.value}`;
  }
}

class H9Clock implements Clock {
  private value = 0;

  public now(): string {
    this.value += 1;
    return `2026-09-16T13:${String(this.value).padStart(2, '0')}:00.000Z`;
  }
}

const haircutService: Service = {
  id: 'haircut-service-1',
  tenant_id: 'tenant-a',
  name: 'Haircut Basic',
  description: null,
  module_key: 'haircut',
  service_kind: 'single',
  service_category: 'cut',
  price: 120000,
  full_price: 120000,
  price_floor: null,
  price_cap: null,
  duration: null,
  default_duration_minutes: 30,
  estimated_duration: null,
  total_sessions: 1,
  session_multiplier: null,
  requires_resource: true,
  default_resource_type: 'CUTTING_STATION',
  required_workers: 1,
  before_after_required: false,
  care_note_template: null,
  ktv_commission: 0,
  details: null,
  offer: null,
  is_hq_template: false,
  template_id: null,
  allowed_franchise_override: true,
  status: 'active',
  metadata: null,
  created_at: '2026-09-16T00:00:00.000Z',
  updated_at: null,
};

class H9Harness {
  public readonly appointments: AppointmentRecord[] = [];
  public readonly assignments: ProfessionalAssignmentRecord[] = [];
  public readonly assignmentHistory: ProfessionalAssignmentHistoryRecord[] = [];
  public readonly allocations: ResourceAllocationRecord[] = [];
  public readonly allocationHistory: ResourceAllocationHistoryRecord[] = [];
  public readonly sessions: SessionRecord[] = [];
  public readonly waits: string[] = [];

  public readonly appointmentRepository: AppointmentRepository = {
    create: async (value) => {
      this.appointments.push(value);
      return value;
    },
    getById: async (scope) => this.appointments.find((appointment) => (
      appointment.tenantId === scope.tenantId && appointment.id === scope.appointmentId
    )) ?? null,
    update: async (value) => {
      this.replace(this.appointments, value);
      return value;
    },
  };

  public readonly assignmentRepository: ProfessionalAssignmentRepository = {
    create: async (value) => {
      this.assignments.push(value);
      return value;
    },
    update: async (value) => {
      this.replace(this.assignments, value);
      return value;
    },
    appendHistory: async (value) => {
      this.assignmentHistory.push(value);
      return value;
    },
    listActive: async (scope) => this.assignments.filter((assignment) => (
      assignment.tenantId === scope.tenantId
      && assignment.serviceCommitmentId === scope.serviceCommitmentId
      && assignment.status === 'ACCEPTED'
    )),
  };

  public readonly allocationRepository: ResourceAllocationRepository = {
    create: async (value) => {
      this.allocations.push(value);
      return value;
    },
    update: async (value) => {
      this.replace(this.allocations, value);
      return value;
    },
    appendHistory: async (value) => {
      this.allocationHistory.push(value);
      return value;
    },
    listActive: async (scope) => this.allocations.filter((allocation) => (
      allocation.tenantId === scope.tenantId
      && allocation.resourceId === scope.resourceId
      && allocation.status === 'ACTIVE'
    )),
  };

  public readonly availability: ResourceAvailabilityPort = {
    getWindow: async (scope): Promise<ResourceCapacityWindow> => ({
      tenantId: scope.tenantId,
      resourceId: scope.resourceId,
      interval: scope.interval,
      capacityUnits: 1,
      unavailable: false,
    }),
  };

  public readonly sessionRepository: SessionRepository = {
    create: async (value) => {
      this.sessions.push(value);
      return value;
    },
    update: async (value) => {
      this.replace(this.sessions, value);
      return value;
    },
    getById: async (scope) => this.sessions.find((session) => (
      session.tenantId === scope.tenantId && session.id === scope.sessionId
    )) ?? null,
  };

  private replace<TRecord extends TenantScoped & { id: string }>(records: TRecord[], value: TRecord): void {
    const index = records.findIndex((record) => record.tenantId === value.tenantId && record.id === value.id);
    if (index >= 0) records[index] = value;
    else records.push(value);
  }
}

function buildCatalog(service: Service, available: boolean): IServiceCatalog {
  const catalog = {
    getService: async () => service,
    getServiceAvailabilityByBranches: async (): Promise<ServiceBranchAvailability[]> => [{
      service_id: service.id,
      branch_id: 'branch-a',
      tenant_id: service.tenant_id,
      is_available: available,
      unavailable_reason: available ? null : 'closed',
      created_at: '2026-09-16T00:00:00.000Z',
      updated_at: null,
    }],
  } as Pick<IServiceCatalog, 'getService' | 'getServiceAvailabilityByBranches'>;
  return catalog as IServiceCatalog;
}

describe('Bella Haircut H9 integration and regression verification', () => {
  it('runs a product workflow through catalog, appointment, assignment, allocation, session, and waitlist fallback', async () => {
    const harness = new H9Harness();
    const ids = new H9Ids();
    const clock = new H9Clock();
    const catalog = new ServiceCatalogAdapter(buildCatalog(haircutService, true));
    const waitlist = new WaitlistAdapter({
      addToWaitlist: async (input) => {
        harness.waits.push(`${input.tenant_id}:${input.customer_id}:${input.package_id}`);
        return { success: true, waitlist_id: 'wait-1', position: 1 };
      },
    } as Pick<IWaitlistEngine, 'addToWaitlist'> as IWaitlistEngine);
    const appointments = new AppointmentService(harness.appointmentRepository, ids);
    const assignments = new ProfessionalAssignmentService(harness.assignmentRepository, ids, clock);
    const allocations = new ResourceAllocationService(harness.allocationRepository, harness.availability, ids, clock);
    const sessions = new SessionTrackingService(harness.sessionRepository, clock);

    const bookable = await catalog.getBookableService('tenant-a', 'haircut-service-1', 'branch-a');
    expect(bookable).toMatchObject({ id: 'haircut-service-1', requiredResourceType: 'CUTTING_STATION' });

    const appointment = await appointments.create({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      customerId: 'customer-a',
      serviceId: bookable?.id ?? 'missing-service',
      interval: { startsAt: '2026-09-16T14:00:00.000Z', endsAt: '2026-09-16T14:30:00.000Z' },
    });
    const proposed = await assignments.propose({
      tenantId: appointment.tenantId,
      serviceCommitmentId: appointment.id,
      professionalId: 'stylist-a',
    });
    const accepted = await assignments.decide(proposed, 'ACCEPTED', 'manager-a');
    const allocation = await allocations.allocate({
      tenantId: appointment.tenantId,
      serviceCommitmentId: appointment.id,
      segmentId: 'cut-segment',
      resourceId: 'station-1',
      interval: appointment.interval,
      capacityUnits: 1,
    });
    await harness.allocationRepository.update({ ...allocation, status: 'ACTIVE' });

    await expect(allocations.allocate({
      tenantId: appointment.tenantId,
      serviceCommitmentId: 'walk-in-demand',
      segmentId: 'cut-segment',
      resourceId: 'station-1',
      interval: appointment.interval,
      capacityUnits: 1,
    })).rejects.toMatchObject<BeautyApplicationError>({ code: 'RESOURCE_CAPACITY_CONFLICT' });
    await waitlist.add({
      tenantId: appointment.tenantId,
      customerId: 'walk-in-customer',
      serviceId: appointment.serviceId,
      preferredDate: '2026-09-16',
      preferredStartTime: '14:00',
      bookingValue: haircutService.price,
      notes: 'capacity fallback',
    });

    const plannedSession = await harness.sessionRepository.create({
      id: 'session-a',
      tenantId: appointment.tenantId,
      appointmentId: appointment.id,
      serviceCommitmentId: appointment.id,
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    });
    const started = await sessions.start(plannedSession, accepted.professionalId);
    const completed = await sessions.complete(started, 'SERVICE_COMPLETED');

    expect(harness.waits).toEqual(['tenant-a:walk-in-customer:haircut-service-1']);
    expect(completed).toMatchObject({
      appointmentId: appointment.id,
      actualPerformerId: 'stylist-a',
      outcome: 'SERVICE_COMPLETED',
      status: 'COMPLETED',
    });
    expect(harness.assignmentHistory).toHaveLength(0);
    expect(harness.allocations.filter((item) => item.tenantId === 'tenant-a')).toHaveLength(1);
  });

  it('keeps resource capacity checks tenant-scoped during overlapping workflows', async () => {
    const harness = new H9Harness();
    const ids = new H9Ids();
    const clock = new H9Clock();
    const allocations = new ResourceAllocationService(harness.allocationRepository, harness.availability, ids, clock);
    const interval = { startsAt: '2026-09-16T15:00:00.000Z', endsAt: '2026-09-16T15:30:00.000Z' };

    const tenantAAllocation = await allocations.allocate({
      tenantId: 'tenant-a',
      serviceCommitmentId: 'commitment-a',
      segmentId: 'segment-a',
      resourceId: 'station-shared-label',
      interval,
      capacityUnits: 1,
    });
    await harness.allocationRepository.update({ ...tenantAAllocation, status: 'ACTIVE' });

    const tenantBAllocation = await allocations.allocate({
      tenantId: 'tenant-b',
      serviceCommitmentId: 'commitment-b',
      segmentId: 'segment-b',
      resourceId: 'station-shared-label',
      interval,
      capacityUnits: 1,
    });

    expect(tenantBAllocation).toMatchObject({
      tenantId: 'tenant-b',
      resourceId: 'station-shared-label',
      status: 'PROPOSED',
    });
    expect(harness.allocations.filter((allocation) => allocation.tenantId === 'tenant-a')).toHaveLength(1);
    expect(harness.allocations.filter((allocation) => allocation.tenantId === 'tenant-b')).toHaveLength(1);
  });

  it('rejects unbookable catalog branches before creating operational facts', async () => {
    const harness = new H9Harness();
    const catalog = new ServiceCatalogAdapter(buildCatalog(haircutService, false));
    const bookable = await catalog.getBookableService('tenant-a', 'haircut-service-1', 'branch-a');

    expect(bookable).toBeNull();
    expect(harness.appointments).toHaveLength(0);
    expect(harness.assignments).toHaveLength(0);
    expect(harness.allocations).toHaveLength(0);
    expect(harness.sessions).toHaveLength(0);
  });
});
