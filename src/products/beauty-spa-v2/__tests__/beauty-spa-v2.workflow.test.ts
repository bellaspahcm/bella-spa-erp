import { productRegistry } from '../../../platform/registry/product-registry';
import type {
  AppointmentRepository,
  Clock,
  IdGenerator,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
} from '../../../platform/beauty/application/ports';
import type {
  AppointmentRecord,
  ProfessionalAssignmentHistoryRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationHistoryRecord,
  ResourceAllocationRecord,
  ResourceCapacityWindow,
  SessionRecord,
  TenantScoped,
  TimeInterval,
} from '../../../platform/beauty/contracts';
import {
  BeautySpaV2Error,
  BeautySpaV2Service,
  type SpaStaffAvailabilityPort,
  type SpaWaitlistPort,
} from '../service';

class WorkflowIds implements IdGenerator {
  private value = 0;

  public next(prefix: string): string {
    this.value += 1;
    return `${prefix}-${this.value}`;
  }
}

class WorkflowClock implements Clock {
  private value = 0;

  public now(): string {
    this.value += 1;
    return `2026-10-01T09:${String(this.value).padStart(2, '0')}:00.000Z`;
  }
}

class BeautySpaHarness {
  public readonly appointments: AppointmentRecord[] = [];
  public readonly assignments: ProfessionalAssignmentRecord[] = [];
  public readonly assignmentHistory: ProfessionalAssignmentHistoryRecord[] = [];
  public readonly allocations: ResourceAllocationRecord[] = [];
  public readonly allocationHistory: ResourceAllocationHistoryRecord[] = [];
  public readonly sessions: SessionRecord[] = [];
  public readonly waitlistEntries: Array<{ tenantId: string; customerId: string; reason: string }> = [];
  public readonly unavailableStaff = new Set<string>();
  public readonly assignmentCreateFailures = new Set<string>();

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
      if (this.assignmentCreateFailures.has(value.professionalId)) {
        throw new Error(`assignment create failed for ${value.professionalId}`);
      }
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

  public readonly availability: ResourceAvailabilityPort = {
    getWindow: async (scope): Promise<ResourceCapacityWindow> => ({
      tenantId: scope.tenantId,
      resourceId: scope.resourceId,
      interval: scope.interval,
      capacityUnits: 1,
      unavailable: false,
    }),
  };

  public readonly staffAvailability: SpaStaffAvailabilityPort = {
    isAvailable: async (scope) => !this.unavailableStaff.has(this.staffKey(scope.tenantId, scope.branchId, scope.professionalId, scope.interval)),
  };

  public readonly waitlist: SpaWaitlistPort = {
    add: async (request) => {
      this.waitlistEntries.push({
        tenantId: request.tenantId,
        customerId: request.customerId,
        reason: request.reason,
      });
      return {
        waitlistId: `waitlist-${this.waitlistEntries.length}`,
        position: this.waitlistEntries.length,
      };
    },
  };

  public createService(): BeautySpaV2Service {
    return new BeautySpaV2Service(
      this.appointmentRepository,
      this.assignmentRepository,
      this.allocationRepository,
      this.sessionRepository,
      this.availability,
      this.staffAvailability,
      new WorkflowIds(),
      new WorkflowClock(),
      this.waitlist,
    );
  }

  public staffKey(tenantId: string, branchId: string, professionalId: string, interval: TimeInterval): string {
    return `${tenantId}:${branchId}:${professionalId}:${interval.startsAt}:${interval.endsAt}`;
  }

  private replace<TRecord extends TenantScoped & { id: string }>(records: TRecord[], value: TRecord): void {
    const index = records.findIndex((record) => record.tenantId === value.tenantId && record.id === value.id);
    if (index >= 0) records[index] = value;
    else records.push(value);
  }
}

const chainInterval: TimeInterval = {
  startsAt: '2026-10-01T10:00:00.000Z',
  endsAt: '2026-10-01T11:30:00.000Z',
};

describe('Bella Beauty Spa v2 product discovery and workflow', () => {
  it('registers full Beauty Spa product identity without module fallback', () => {
    const product = productRegistry.getRequired('bella_spa');

    expect(product).toMatchObject({
      productKey: 'bella_spa',
      displayName: 'Bella Beauty Spa v2',
      requiredModules: ['beauty_spa'],
      serviceProfile: 'spa',
      navigationProfile: 'spa',
      defaultRoute: '/dashboard/beauty-spa-v2',
    });
  });

  it('runs a multi-branch spa booking through staff, room, bed, session, and handoff facts', async () => {
    const harness = new BeautySpaHarness();
    const service = harness.createService();

    const booking = await service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-vip-1',
      serviceId: 'service-facial-signature',
      interval: chainInterval,
      leadProfessionalId: 'therapist-lead-1',
      supportProfessionalIds: ['assistant-1'],
      resources: [
        { resourceId: 'room-d1-royal-suite', resourceType: 'ROOM', segmentId: 'facial-suite' },
        { resourceId: 'bed-d1-01', resourceType: 'BED', segmentId: 'facial-bed' },
        { resourceId: 'device-hifu-01', resourceType: 'DEVICE', segmentId: 'hifu-device' },
      ],
      actorId: 'manager-spa',
      bookingMode: 'BOOKING',
    });

    expect(booking.appointment).toMatchObject({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-vip-1',
      serviceId: 'service-facial-signature',
      status: 'PENDING',
    });
    expect(booking.assignments.map((assignment) => assignment.professionalId)).toEqual(['therapist-lead-1', 'assistant-1']);
    expect(booking.assignments.every((assignment) => assignment.status === 'ACCEPTED')).toBe(true);
    expect(booking.allocations.map((allocation) => allocation.resourceId)).toEqual([
      'room-d1-royal-suite',
      'bed-d1-01',
      'device-hifu-01',
    ]);
    expect(booking.allocations.every((allocation) => allocation.status === 'ACTIVE')).toBe(true);

    const plannedSession: SessionRecord = {
      id: 'session-spa-1',
      tenantId: booking.appointment.tenantId,
      appointmentId: booking.appointment.id,
      serviceCommitmentId: booking.serviceCommitmentId,
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    };

    const completed = await service.completeSession({
      session: plannedSession,
      performerId: 'therapist-lead-1',
      outcome: {
        checkedOutBy: 'manager-spa',
        customerHistoryNote: 'Skin hydration improved; recommend monthly HIFU maintenance.',
        packageSessionUsed: true,
        paymentStatus: 'FINANCE_HANDOFF_REQUIRED',
        inventoryHandoff: 'INVENTORY_HANDOFF_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['CHAIN_V2', 'ROOM_BED_DEVICE_CONFIRMED'],
      },
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.actualPerformerId).toBe('therapist-lead-1');
    const outcome = JSON.parse(completed.outcome as string) as { paymentStatus: string; auditTags: string[] };
    expect(outcome.paymentStatus).toBe('FINANCE_HANDOFF_REQUIRED');
    expect(outcome.auditTags).toContain('CHAIN_V2');
  });

  it('prevents staff and resource conflicts while preserving tenant boundaries', async () => {
    const harness = new BeautySpaHarness();
    const service = harness.createService();
    harness.unavailableStaff.add(harness.staffKey('tenant-spa-a', 'branch-d1', 'therapist-lead-1', chainInterval));

    await expect(service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-conflict-staff',
      serviceId: 'service-body-therapy',
      interval: chainInterval,
      leadProfessionalId: 'therapist-lead-1',
      resources: [{ resourceId: 'room-d1-02', resourceType: 'ROOM' }],
      actorId: 'manager-spa',
      bookingMode: 'WALK_IN',
    })).rejects.toMatchObject<BeautySpaV2Error>({ code: 'STAFF_TIME_BRANCH_CONFLICT' });

    expect(harness.appointments).toHaveLength(0);
    harness.unavailableStaff.clear();

    await service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-first',
      serviceId: 'service-body-therapy',
      interval: chainInterval,
      leadProfessionalId: 'therapist-a',
      resources: [{ resourceId: 'room-d1-02', resourceType: 'ROOM' }],
      actorId: 'manager-spa',
      bookingMode: 'BOOKING',
    });

    await expect(service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-overlap',
      serviceId: 'service-body-therapy',
      interval: chainInterval,
      leadProfessionalId: 'therapist-b',
      resources: [{ resourceId: 'room-d1-02', resourceType: 'ROOM' }],
      actorId: 'manager-spa',
      bookingMode: 'WALK_IN',
    })).rejects.toMatchObject({ code: 'RESOURCE_CAPACITY_CONFLICT' });

    const tenantBBooking = await service.bookService({
      tenantId: 'tenant-spa-b',
      branchId: 'branch-d1',
      customerId: 'customer-tenant-b',
      serviceId: 'service-body-therapy',
      interval: chainInterval,
      leadProfessionalId: 'therapist-b',
      resources: [{ resourceId: 'room-d1-02', resourceType: 'ROOM' }],
      actorId: 'manager-spa-b',
      bookingMode: 'BOOKING',
    });

    expect(tenantBBooking.allocations).toHaveLength(1);
    expect(harness.allocations.filter((allocation) => allocation.tenantId === 'tenant-spa-a')).toHaveLength(1);
    expect(harness.allocations.filter((allocation) => allocation.tenantId === 'tenant-spa-b')).toHaveLength(1);
    expect(harness.appointments.find((appointment) => appointment.customerId === 'customer-overlap')?.status).toBe('CANCELLED');
  });

  it('cancels the appointment and disrupts accepted staff when assignment orchestration fails mid-booking', async () => {
    const harness = new BeautySpaHarness();
    const service = harness.createService();
    harness.assignmentCreateFailures.add('assistant-fails');

    await expect(service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-assignment-failure',
      serviceId: 'service-facial-team',
      interval: chainInterval,
      leadProfessionalId: 'therapist-lead-1',
      supportProfessionalIds: ['assistant-fails'],
      resources: [{ resourceId: 'room-d1-03', resourceType: 'ROOM' }],
      actorId: 'manager-spa',
      bookingMode: 'BOOKING',
    })).rejects.toThrow('assignment create failed for assistant-fails');

    expect(harness.appointments.find((appointment) => (
      appointment.customerId === 'customer-assignment-failure'
    ))?.status).toBe('CANCELLED');
    expect(harness.assignments).toEqual([
      expect.objectContaining({
        professionalId: 'therapist-lead-1',
        status: 'DISRUPTED',
        reason: 'BOOKING_ORCHESTRATION_FAILED',
        actorId: 'manager-spa',
      }),
    ]);
    expect(harness.allocations).toHaveLength(0);
  });

  it('rolls back allocations created earlier in the same booking when a later resource conflicts', async () => {
    const harness = new BeautySpaHarness();
    const service = harness.createService();

    harness.allocations.push({
      id: 'existing-device-allocation',
      tenantId: 'tenant-spa-a',
      serviceCommitmentId: 'existing-commitment',
      segmentId: 'existing-device',
      resourceId: 'device-hifu-01',
      interval: chainInterval,
      capacityUnits: 1,
      status: 'ACTIVE',
      replacementForId: null,
      reason: null,
      actorId: null,
    });

    await expect(service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-partial-conflict',
      serviceId: 'service-hifu-combo',
      interval: chainInterval,
      leadProfessionalId: 'therapist-hifu',
      resources: [
        { resourceId: 'room-d1-royal-suite', resourceType: 'ROOM', segmentId: 'facial-suite' },
        { resourceId: 'device-hifu-01', resourceType: 'DEVICE', segmentId: 'hifu-device' },
      ],
      actorId: 'manager-spa',
      bookingMode: 'BOOKING',
    })).rejects.toMatchObject({ code: 'RESOURCE_CAPACITY_CONFLICT' });

    const failedAppointment = harness.appointments.find((appointment) => (
      appointment.customerId === 'customer-partial-conflict'
    ));
    expect(failedAppointment?.status).toBe('CANCELLED');

    const rolledBackRoom = harness.allocations.find((allocation) => (
      allocation.resourceId === 'room-d1-royal-suite'
      && allocation.serviceCommitmentId !== 'existing-commitment'
    ));
    expect(rolledBackRoom).toMatchObject({
      status: 'DISRUPTED',
      actorId: 'manager-spa',
      reason: 'BOOKING_RESOURCE_ALLOCATION_FAILED',
    });
    expect(harness.allocations.filter((allocation) => (
      allocation.resourceId === 'room-d1-royal-suite'
      && allocation.status === 'ACTIVE'
    ))).toHaveLength(0);
    expect(harness.allocationHistory).toEqual([
      expect.objectContaining({
        allocationId: rolledBackRoom?.id,
        eventType: 'BOOKING_ALLOCATION_ROLLED_BACK',
        reason: 'BOOKING_RESOURCE_ALLOCATION_FAILED',
        actorId: 'manager-spa',
      }),
    ]);
    expect(harness.assignments.every((assignment) => assignment.status === 'DISRUPTED')).toBe(true);
  });

  it('routes conflicted walk-ins to waitlist without creating false operational success', async () => {
    const harness = new BeautySpaHarness();
    const service = harness.createService();

    await service.bookService({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-booked',
      serviceId: 'service-vip-suite',
      interval: chainInterval,
      leadProfessionalId: 'therapist-a',
      resources: [{ resourceId: 'suite-d1-01', resourceType: 'SUITE' }],
      actorId: 'manager-spa',
      bookingMode: 'BOOKING',
    });

    const waitlisted = await service.bookOrWaitlist({
      tenantId: 'tenant-spa-a',
      branchId: 'branch-d1',
      customerId: 'customer-walk-in',
      serviceId: 'service-vip-suite',
      interval: chainInterval,
      leadProfessionalId: 'therapist-b',
      resources: [{ resourceId: 'suite-d1-01', resourceType: 'SUITE' }],
      actorId: 'manager-spa',
      bookingMode: 'WALK_IN',
    });

    expect(waitlisted.waitlist).toMatchObject({
      waitlistId: 'waitlist-1',
      position: 1,
      reason: 'RESOURCE_CAPACITY_CONFLICT',
    });
    expect(waitlisted.allocations).toHaveLength(0);
    expect(harness.waitlistEntries).toEqual([{
      tenantId: 'tenant-spa-a',
      customerId: 'customer-walk-in',
      reason: 'RESOURCE_CAPACITY_CONFLICT',
    }]);
    expect(harness.appointments.find((appointment) => appointment.customerId === 'customer-walk-in')?.status).toBe('CANCELLED');
  });
});
