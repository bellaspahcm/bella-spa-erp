import {
  AppointmentService,
  BeautyApplicationError,
  ProfessionalAssignmentService,
  ResourceAllocationService,
  SessionTrackingService,
} from '../../platform/beauty/application/services';
import type {
  AppointmentRepository,
  Clock,
  IdGenerator,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
} from '../../platform/beauty/application/ports';
import type {
  AppointmentRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationRecord,
  SessionRecord,
  TimeInterval,
} from '../../platform/beauty/contracts';
import { validateInterval } from '../../platform/beauty/contracts';

const BEAUTY_SPA_BOOKING_MODES = ['BOOKING', 'WALK_IN'] as const;
const BEAUTY_SPA_RESOURCE_TYPES = ['ROOM', 'BED', 'DEVICE', 'SUITE', 'OTHER'] as const;
const BEAUTY_SPA_PAYMENT_STATUSES = ['NOT_COLLECTED', 'DEPOSIT_COLLECTED', 'PAID', 'FINANCE_HANDOFF_REQUIRED'] as const;
const BEAUTY_SPA_INVENTORY_HANDOFFS = ['NOT_REQUIRED', 'INVENTORY_HANDOFF_REQUIRED'] as const;
const BEAUTY_SPA_PAYROLL_HANDOFFS = ['PAYROLL_HANDOFF_REQUIRED'] as const;

export type BeautySpaBookingMode = (typeof BEAUTY_SPA_BOOKING_MODES)[number];

export interface SpaStaffAvailabilityPort {
  isAvailable(scope: {
    tenantId: string;
    branchId: string;
    professionalId: string;
    interval: TimeInterval;
  }): Promise<boolean>;
}

export interface SpaWaitlistPort {
  add(request: {
    tenantId: string;
    branchId: string;
    customerId: string;
    serviceId: string;
    interval: TimeInterval;
    reason: string;
    bookingMode: BeautySpaBookingMode;
  }): Promise<{ waitlistId: string; position: number }>;
}

export interface BeautySpaResourceRequirement {
  resourceId: string;
  resourceType: (typeof BEAUTY_SPA_RESOURCE_TYPES)[number];
  segmentId?: string;
  capacityUnits?: number;
}

export interface BookBeautySpaServiceInput {
  tenantId: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  interval: TimeInterval;
  leadProfessionalId: string;
  supportProfessionalIds?: string[];
  resources: BeautySpaResourceRequirement[];
  actorId: string;
  bookingMode: BeautySpaBookingMode;
}

export interface BookBeautySpaServiceOutput {
  appointment: AppointmentRecord;
  serviceCommitmentId: string;
  assignments: ProfessionalAssignmentRecord[];
  allocations: ResourceAllocationRecord[];
  waitlist?: { waitlistId: string; position: number; reason: string };
}

export interface BeautySpaOperationalOutcome {
  checkedOutBy: string;
  customerHistoryNote: string;
  packageSessionUsed: boolean;
  paymentStatus: 'NOT_COLLECTED' | 'DEPOSIT_COLLECTED' | 'PAID' | 'FINANCE_HANDOFF_REQUIRED';
  inventoryHandoff: 'NOT_REQUIRED' | 'INVENTORY_HANDOFF_REQUIRED';
  payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED';
  auditTags: string[];
}

export interface CompleteBeautySpaSessionInput {
  session: SessionRecord;
  performerId: string;
  outcome: BeautySpaOperationalOutcome;
}

export class BeautySpaV2Error extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BeautySpaV2Error';
  }
}

/**
 * Product orchestration for Bella Beauty Spa v2.
 *
 * It composes frozen Beauty OS services. Product-specific behavior is limited
 * to chain workflow sequencing and handoff classification.
 */
export class BeautySpaV2Service {
  private readonly appointmentService: AppointmentService;
  private readonly assignmentService: ProfessionalAssignmentService;
  private readonly allocationService: ResourceAllocationService;
  private readonly sessionService: SessionTrackingService;

  public constructor(
    private readonly appointmentRepo: AppointmentRepository,
    private readonly assignmentRepo: ProfessionalAssignmentRepository,
    private readonly allocationRepo: ResourceAllocationRepository,
    sessionRepo: SessionRepository,
    availability: ResourceAvailabilityPort,
    private readonly staffAvailability: SpaStaffAvailabilityPort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly waitlist?: SpaWaitlistPort,
  ) {
    this.appointmentService = new AppointmentService(appointmentRepo, ids);
    this.assignmentService = new ProfessionalAssignmentService(assignmentRepo, ids, clock);
    this.allocationService = new ResourceAllocationService(allocationRepo, availability, ids, clock);
    this.sessionService = new SessionTrackingService(sessionRepo, clock);
  }

  public async bookService(input: BookBeautySpaServiceInput): Promise<BookBeautySpaServiceOutput> {
    this.assertBookableInput(input);
    await this.assertStaffAvailable(input);

    const serviceCommitmentId = this.ids.next('spa-commitment');
    const appointment = await this.appointmentService.create({
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      serviceId: input.serviceId,
      interval: input.interval,
    });

    const assignments: ProfessionalAssignmentRecord[] = [];

    try {
      await this.createAcceptedAssignments(input, serviceCommitmentId, assignments);
      const allocations = await this.allocateActiveResources(input, serviceCommitmentId);
      return { appointment, serviceCommitmentId, assignments, allocations };
    } catch (error) {
      await this.appointmentRepo.update({ ...appointment, status: 'CANCELLED' });
      await this.markAssignmentsDisrupted(assignments, input.actorId, 'BOOKING_ORCHESTRATION_FAILED');
      throw error;
    }
  }

  public async bookOrWaitlist(input: BookBeautySpaServiceInput): Promise<BookBeautySpaServiceOutput> {
    try {
      return await this.bookService(input);
    } catch (error) {
      const reason = this.getWaitlistReason(error);
      if (!reason || !this.waitlist) {
        throw error;
      }

      const waitlist = await this.waitlist.add({
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        serviceId: input.serviceId,
        interval: input.interval,
        bookingMode: input.bookingMode,
        reason,
      });

      return {
        appointment: this.buildWaitlistedAppointment(input),
        serviceCommitmentId: this.ids.next('spa-waitlist-commitment'),
        assignments: [],
        allocations: [],
        waitlist: { ...waitlist, reason },
      };
    }
  }

  public async completeSession(input: CompleteBeautySpaSessionInput): Promise<SessionRecord> {
    this.assertSessionOutcome(input);
    const started = await this.sessionService.start(input.session, input.performerId);
    return this.sessionService.complete(started, JSON.stringify(input.outcome));
  }

  private assertBookableInput(input: BookBeautySpaServiceInput): void {
    if (!isOneOf(BEAUTY_SPA_BOOKING_MODES, input.bookingMode)) {
      throw new BeautySpaV2Error('INVALID_BOOKING_MODE', 'Beauty Spa v2 bookings require a supported booking mode.');
    }

    if (input.resources.some((resource) => !isOneOf(BEAUTY_SPA_RESOURCE_TYPES, resource.resourceType))) {
      throw new BeautySpaV2Error('INVALID_RESOURCE_TYPE', 'Beauty Spa v2 bookings require supported resource types.');
    }

    const requiredIds: unknown[] = [
      input.tenantId,
      input.branchId,
      input.customerId,
      input.serviceId,
      input.leadProfessionalId,
      input.actorId,
      ...(input.supportProfessionalIds ?? []),
      ...input.resources.map((resource) => resource.resourceId),
    ];
    if (requiredIds.some(isMissingString)) {
      throw new BeautySpaV2Error('REQUIRED_ID_MISSING', 'Beauty Spa v2 bookings require tenant, branch, customer, service, staff, actor, and resource IDs.');
    }

    if (validateInterval(input.interval)) {
      throw new BeautySpaV2Error('INVALID_INTERVAL', 'Beauty Spa v2 bookings require a valid start and end time.');
    }

    if (input.resources.length === 0) {
      throw new BeautySpaV2Error('RESOURCE_REQUIRED', 'Beauty Spa v2 bookings require at least one room, bed, suite, or device resource.');
    }

    const professionalIds = [input.leadProfessionalId, ...(input.supportProfessionalIds ?? [])];
    if (new Set(professionalIds).size !== professionalIds.length) {
      throw new BeautySpaV2Error('DUPLICATE_STAFF_ASSIGNMENT', 'Beauty Spa v2 bookings cannot assign the same staff member more than once.');
    }

    const resourceIds = input.resources.map((resource) => resource.resourceId);
    if (new Set(resourceIds).size !== resourceIds.length) {
      throw new BeautySpaV2Error('DUPLICATE_RESOURCE_REQUIREMENT', 'Beauty Spa v2 bookings cannot require the same resource more than once.');
    }

    if (input.resources.some((resource) => (
      resource.capacityUnits !== undefined
      && (!Number.isFinite(resource.capacityUnits) || resource.capacityUnits <= 0)
    ))) {
      throw new BeautySpaV2Error('INVALID_RESOURCE_CAPACITY', 'Beauty Spa v2 resource capacity units must be greater than zero.');
    }
  }

  private async assertStaffAvailable(input: BookBeautySpaServiceInput): Promise<void> {
    const professionalIds = [input.leadProfessionalId, ...(input.supportProfessionalIds ?? [])];
    for (const professionalId of professionalIds) {
      const available = await this.staffAvailability.isAvailable({
        tenantId: input.tenantId,
        branchId: input.branchId,
        professionalId,
        interval: input.interval,
      });
      if (!available) {
        throw new BeautySpaV2Error('STAFF_TIME_BRANCH_CONFLICT', 'Staff is not available for the requested branch and interval.');
      }
    }
  }

  private assertSessionOutcome(input: CompleteBeautySpaSessionInput): void {
    const requiredSessionIds: unknown[] = [
      input.session.id,
      input.session.tenantId,
      input.session.appointmentId,
      input.session.serviceCommitmentId,
    ];
    if (requiredSessionIds.some(isMissingString)) {
      throw new BeautySpaV2Error('REQUIRED_SESSION_ID_MISSING', 'Beauty Spa v2 session completion requires session, tenant, appointment, and service commitment IDs.');
    }
    if (isMissingString(input.performerId)) {
      throw new BeautySpaV2Error('REQUIRED_ID_MISSING', 'Beauty Spa v2 session completion requires a performer ID.');
    }
    if (typeof input.outcome.packageSessionUsed !== 'boolean') {
      throw new BeautySpaV2Error('INVALID_CHECKOUT_OUTCOME', 'Beauty Spa v2 session completion requires a boolean package session flag.');
    }
    if (!isOneOf(BEAUTY_SPA_PAYMENT_STATUSES, input.outcome.paymentStatus)) {
      throw new BeautySpaV2Error('INVALID_CHECKOUT_OUTCOME', 'Beauty Spa v2 session completion requires a supported payment status.');
    }
    if (!isOneOf(BEAUTY_SPA_INVENTORY_HANDOFFS, input.outcome.inventoryHandoff)) {
      throw new BeautySpaV2Error('INVALID_CHECKOUT_OUTCOME', 'Beauty Spa v2 session completion requires a supported inventory handoff.');
    }
    if (!isOneOf(BEAUTY_SPA_PAYROLL_HANDOFFS, input.outcome.payrollHandoff)) {
      throw new BeautySpaV2Error('INVALID_CHECKOUT_OUTCOME', 'Beauty Spa v2 session completion requires a supported payroll handoff.');
    }
    if (isMissingString(input.outcome.checkedOutBy)) {
      throw new BeautySpaV2Error('CHECKOUT_ACTOR_REQUIRED', 'Beauty Spa v2 session completion requires a checkout actor.');
    }
    if (isMissingString(input.outcome.customerHistoryNote)) {
      throw new BeautySpaV2Error('CUSTOMER_HISTORY_REQUIRED', 'Beauty Spa v2 session completion requires a customer history note.');
    }
    if (
      !Array.isArray(input.outcome.auditTags)
      || input.outcome.auditTags.length === 0
      || input.outcome.auditTags.some(isMissingString)
    ) {
      throw new BeautySpaV2Error('AUDIT_TAGS_REQUIRED', 'Beauty Spa v2 session completion requires non-empty audit tags.');
    }
  }

  private async createAcceptedAssignments(
    input: BookBeautySpaServiceInput,
    serviceCommitmentId: string,
    assignments: ProfessionalAssignmentRecord[],
  ): Promise<void> {
    const professionalIds = [input.leadProfessionalId, ...(input.supportProfessionalIds ?? [])];

    for (const professionalId of professionalIds) {
      const proposed = await this.assignmentService.propose({
        tenantId: input.tenantId,
        serviceCommitmentId,
        professionalId,
      });
      assignments.push(proposed);
      const accepted = await this.assignmentService.decide(proposed, 'ACCEPTED', input.actorId);
      assignments[assignments.length - 1] = accepted;
    }
  }

  private async allocateActiveResources(
    input: BookBeautySpaServiceInput,
    serviceCommitmentId: string,
  ): Promise<ResourceAllocationRecord[]> {
    const allocations: ResourceAllocationRecord[] = [];

    try {
      for (const resource of input.resources) {
        const proposed = await this.allocationService.allocate({
          tenantId: input.tenantId,
          serviceCommitmentId,
          segmentId: resource.segmentId ?? `${serviceCommitmentId}-${resource.resourceType.toLowerCase()}`,
          resourceId: resource.resourceId,
          interval: input.interval,
          capacityUnits: resource.capacityUnits ?? 1,
        });
        const active = await this.allocationRepo.update({ ...proposed, status: 'ACTIVE' });
        allocations.push(active);
      }
    } catch (error) {
      await this.markAllocationsDisrupted(allocations, input.actorId, 'BOOKING_RESOURCE_ALLOCATION_FAILED');
      throw error;
    }

    return allocations;
  }

  private async markAllocationsDisrupted(
    allocations: ResourceAllocationRecord[],
    actorId: string,
    reason: string,
  ): Promise<void> {
    for (const allocation of allocations) {
      const disrupted = await this.allocationRepo.update({
        ...allocation,
        status: 'DISRUPTED',
        actorId,
        reason,
      });
      await this.allocationRepo.appendHistory({
        id: this.ids.next('allocation-history'),
        tenantId: disrupted.tenantId,
        allocationId: disrupted.id,
        replacementAllocationId: null,
        oldResourceId: disrupted.resourceId,
        newResourceId: disrupted.resourceId,
        segmentId: disrupted.segmentId,
        eventType: 'BOOKING_ALLOCATION_ROLLED_BACK',
        reason,
        actorId,
        occurredAt: this.clock.now(),
      });
    }
  }

  private async markAssignmentsDisrupted(
    assignments: ProfessionalAssignmentRecord[],
    actorId: string,
    reason: string,
  ): Promise<void> {
    for (const assignment of assignments) {
      const disrupted = await this.assignmentRepo.update({
        ...assignment,
        status: 'DISRUPTED',
        actorId,
        reason,
        decidedAt: this.clock.now(),
      });
      await this.assignmentRepo.appendHistory({
        id: this.ids.next('assignment-history'),
        tenantId: disrupted.tenantId,
        assignmentId: disrupted.id,
        fromProfessionalId: disrupted.professionalId,
        toProfessionalId: disrupted.professionalId,
        eventType: 'BOOKING_ASSIGNMENT_ROLLED_BACK',
        reason,
        actorId,
        occurredAt: this.clock.now(),
      });
    }
  }

  private getWaitlistReason(error: unknown): string | null {
    if (error instanceof BeautySpaV2Error && error.code === 'STAFF_TIME_BRANCH_CONFLICT') {
      return error.code;
    }
    if (error instanceof BeautyApplicationError && error.code === 'RESOURCE_CAPACITY_CONFLICT') {
      return error.code;
    }
    return null;
  }

  private buildWaitlistedAppointment(input: BookBeautySpaServiceInput): AppointmentRecord {
    return {
      id: this.ids.next('spa-waitlisted-appointment'),
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      serviceId: input.serviceId,
      interval: input.interval,
      status: 'PENDING',
    };
  }
}

function isOneOf<const TValues extends readonly string[]>(
  values: TValues,
  value: string,
): value is TValues[number] {
  return values.includes(value);
}

function isMissingString(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}
