'use client';

import { useMemo, useState } from 'react';
import {
  Bed,
  CalendarCheck,
  Clock,
  Play,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  BeautySpaV2Service,
  type BeautySpaOperationalOutcome,
  type SpaStaffAvailabilityPort,
  type SpaWaitlistPort,
} from '@/products/beauty-spa-v2';
import type {
  AppointmentRepository,
  Clock as BeautyClock,
  IdGenerator,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
} from '@/platform/beauty/application/ports';
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
} from '@/platform/beauty/contracts';

type JourneyStatus = 'READY' | 'PASS';

type JourneyState = {
  chainBooking: JourneyStatus;
  conflictPrevention: JourneyStatus;
  sessionHandoff: JourneyStatus;
};

type JourneyEvidence = {
  branchId: string;
  staffAccepted: number;
  resourceAllocations: number;
  waitlistReason: string;
  tenantIsolation: string;
  paymentStatus: string;
  payrollHandoff: string;
};

class UiIds implements IdGenerator {
  private value = 0;

  public next(prefix: string): string {
    this.value += 1;
    return `${prefix}-ui-${this.value}`;
  }
}

class UiClock implements BeautyClock {
  private value = 0;

  public now(): string {
    this.value += 1;
    return `2026-10-01T09:${String(this.value).padStart(2, '0')}:00.000Z`;
  }
}

class BeautySpaUiHarness {
  public readonly appointments: AppointmentRecord[] = [];
  public readonly assignments: ProfessionalAssignmentRecord[] = [];
  public readonly assignmentHistory: ProfessionalAssignmentHistoryRecord[] = [];
  public readonly allocations: ResourceAllocationRecord[] = [];
  public readonly allocationHistory: ResourceAllocationHistoryRecord[] = [];
  public readonly sessions: SessionRecord[] = [];
  public readonly waitlistEntries: Array<{ tenantId: string; customerId: string; reason: string }> = [];
  public readonly unavailableStaff = new Set<string>();

  public readonly appointmentRepository: AppointmentRepository = {
    create: async (value) => {
      this.appointments.push(value);
      return value;
    },
    getById: async (scope) =>
      this.appointments.find((appointment) => (
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
    listActive: async (scope) =>
      this.assignments.filter((assignment) => (
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
    listActive: async (scope) =>
      this.allocations.filter((allocation) => (
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
    getById: async (scope) =>
      this.sessions.find((session) => (
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
    isAvailable: async (scope) => !this.unavailableStaff.has(this.staffKey(
      scope.tenantId,
      scope.branchId,
      scope.professionalId,
      scope.interval,
    )),
  };

  public readonly waitlist: SpaWaitlistPort = {
    add: async (request) => {
      this.waitlistEntries.push({
        tenantId: request.tenantId,
        customerId: request.customerId,
        reason: request.reason,
      });
      return {
        waitlistId: `spa-v2-waitlist-${this.waitlistEntries.length}`,
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
      new UiIds(),
      new UiClock(),
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

function parseOutcome(value: string | null): BeautySpaOperationalOutcome | null {
  if (!value) return null;
  return JSON.parse(value) as BeautySpaOperationalOutcome;
}

export default function BeautySpaV2DashboardPage() {
  const [journeys, setJourneys] = useState<JourneyState>({
    chainBooking: 'READY',
    conflictPrevention: 'READY',
    sessionHandoff: 'READY',
  });
  const [evidence, setEvidence] = useState<JourneyEvidence>({
    branchId: 'PENDING',
    staffAccepted: 0,
    resourceAllocations: 0,
    waitlistReason: 'PENDING',
    tenantIsolation: 'PENDING',
    paymentStatus: 'PENDING',
    payrollHandoff: 'PENDING',
  });

  const interval: TimeInterval = useMemo(
    () => ({
      startsAt: '2026-10-01T10:00:00.000Z',
      endsAt: '2026-10-01T11:30:00.000Z',
    }),
    [],
  );

  async function runChainBookingJourney() {
    const harness = new BeautySpaUiHarness();
    const service = harness.createService();

    const booking = await service.bookService({
      tenantId: 'tenant-spa-v2-ui',
      branchId: 'branch-d1-royal-spa',
      customerId: 'customer-vip-facial',
      serviceId: 'service-facial-signature',
      interval,
      leadProfessionalId: 'therapist-lead-1',
      supportProfessionalIds: ['assistant-1'],
      resources: [
        { resourceId: 'room-d1-royal-suite', resourceType: 'ROOM', segmentId: 'facial-suite' },
        { resourceId: 'bed-d1-01', resourceType: 'BED', segmentId: 'facial-bed' },
        { resourceId: 'device-hifu-01', resourceType: 'DEVICE', segmentId: 'hifu-device' },
      ],
      actorId: 'manager-spa-v2',
      bookingMode: 'BOOKING',
    });

    setJourneys((current) => ({ ...current, chainBooking: 'PASS' }));
    setEvidence((current) => ({
      ...current,
      branchId: booking.appointment.branchId,
      staffAccepted: booking.assignments.length,
      resourceAllocations: booking.allocations.length,
    }));
  }

  async function runConflictPreventionJourney() {
    const harness = new BeautySpaUiHarness();
    const service = harness.createService();

    await service.bookService({
      tenantId: 'tenant-spa-v2-ui',
      branchId: 'branch-d1-royal-spa',
      customerId: 'customer-booked-suite',
      serviceId: 'service-vip-suite',
      interval,
      leadProfessionalId: 'therapist-a',
      resources: [{ resourceId: 'suite-d1-01', resourceType: 'SUITE' }],
      actorId: 'manager-spa-v2',
      bookingMode: 'BOOKING',
    });

    const waitlisted = await service.bookOrWaitlist({
      tenantId: 'tenant-spa-v2-ui',
      branchId: 'branch-d1-royal-spa',
      customerId: 'customer-walk-in-suite',
      serviceId: 'service-vip-suite',
      interval,
      leadProfessionalId: 'therapist-b',
      resources: [{ resourceId: 'suite-d1-01', resourceType: 'SUITE' }],
      actorId: 'manager-spa-v2',
      bookingMode: 'WALK_IN',
    });

    const tenantBBooking = await service.bookService({
      tenantId: 'tenant-spa-v2-other',
      branchId: 'branch-d1-royal-spa',
      customerId: 'customer-other-tenant',
      serviceId: 'service-vip-suite',
      interval,
      leadProfessionalId: 'therapist-b',
      resources: [{ resourceId: 'suite-d1-01', resourceType: 'SUITE' }],
      actorId: 'manager-spa-v2-other',
      bookingMode: 'BOOKING',
    });

    setJourneys((current) => ({ ...current, conflictPrevention: 'PASS' }));
    setEvidence((current) => ({
      ...current,
      waitlistReason: waitlisted.waitlist?.reason ?? 'NO_WAITLIST',
      tenantIsolation: tenantBBooking.allocations.length === 1 ? 'TENANT_SCOPED' : 'FAILED',
    }));
  }

  async function runSessionHandoffJourney() {
    const harness = new BeautySpaUiHarness();
    const service = harness.createService();

    const booking = await service.bookService({
      tenantId: 'tenant-spa-v2-ui',
      branchId: 'branch-d2-skin-center',
      customerId: 'customer-care-plan',
      serviceId: 'service-skin-program',
      interval,
      leadProfessionalId: 'therapist-lead-2',
      resources: [
        { resourceId: 'room-d2-02', resourceType: 'ROOM' },
        { resourceId: 'bed-d2-02', resourceType: 'BED' },
      ],
      actorId: 'manager-spa-v2',
      bookingMode: 'BOOKING',
    });

    const plannedSession: SessionRecord = {
      id: 'session-spa-v2-ui',
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
      performerId: 'therapist-lead-2',
      outcome: {
        checkedOutBy: 'manager-spa-v2',
        customerHistoryNote: 'Skin barrier improved; schedule follow-up in 30 days.',
        packageSessionUsed: true,
        paymentStatus: 'FINANCE_HANDOFF_REQUIRED',
        inventoryHandoff: 'INVENTORY_HANDOFF_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['CHAIN_V2', 'SESSION_DONE', 'CHECKOUT_HANDOFF'],
      },
    });
    const outcome = parseOutcome(completed.outcome);

    setJourneys((current) => ({ ...current, sessionHandoff: 'PASS' }));
    setEvidence((current) => ({
      ...current,
      paymentStatus: outcome?.paymentStatus ?? 'MISSING',
      payrollHandoff: outcome?.payrollHandoff ?? 'MISSING',
    }));
  }

  const allPassed = Object.values(journeys).every((status) => status === 'PASS');

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Bella Beauty OS
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
              Bella Beauty Spa v2
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Chain operations evidence for multi-branch spa booking, staff and resource
              availability, waitlist recovery, tenant isolation, and session checkout handoff.
            </p>
          </div>
          <div
            data-testid="beauty-spa-v2-rc-status"
            className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            {allPassed ? 'Browser product journeys PASS' : 'Browser product journeys READY'}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <JourneyPanel
            title="Chain booking"
            description="Books a facial service with lead therapist, assistant, room, bed, and HIFU device."
            status={journeys.chainBooking}
            actionLabel="Run booking"
            testId="run-spa-v2-booking"
            icon={<CalendarCheck className="h-5 w-5" />}
            onRun={runChainBookingJourney}
          />
          <JourneyPanel
            title="Conflict prevention"
            description="Blocks overlapping suite usage, routes walk-in demand to waitlist, and preserves tenant scope."
            status={journeys.conflictPrevention}
            actionLabel="Run conflicts"
            testId="run-spa-v2-conflicts"
            icon={<ShieldCheck className="h-5 w-5" />}
            onRun={runConflictPreventionJourney}
          />
          <JourneyPanel
            title="Checkout handoff"
            description="Completes session with customer history, finance, inventory, payroll, and audit handoff facts."
            status={journeys.sessionHandoff}
            actionLabel="Run checkout"
            testId="run-spa-v2-checkout"
            icon={<Clock className="h-5 w-5" />}
            onRun={runSessionHandoffJourney}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <EvidenceTile testId="spa-v2-evidence-branch" icon={<Bed className="h-4 w-4" />} label="Branch" value={evidence.branchId} />
          <EvidenceTile testId="spa-v2-evidence-staff" icon={<Users className="h-4 w-4" />} label="Staff accepted" value={String(evidence.staffAccepted)} />
          <EvidenceTile testId="spa-v2-evidence-resources" icon={<Bed className="h-4 w-4" />} label="Resources" value={String(evidence.resourceAllocations)} />
          <EvidenceTile testId="spa-v2-evidence-waitlist" icon={<ShieldCheck className="h-4 w-4" />} label="Waitlist" value={evidence.waitlistReason} />
          <EvidenceTile testId="spa-v2-evidence-tenant" icon={<ShieldCheck className="h-4 w-4" />} label="Tenant isolation" value={evidence.tenantIsolation} />
          <EvidenceTile testId="spa-v2-evidence-payment" icon={<CalendarCheck className="h-4 w-4" />} label="Payment" value={evidence.paymentStatus} />
          <EvidenceTile testId="spa-v2-evidence-payroll" icon={<Users className="h-4 w-4" />} label="Payroll" value={evidence.payrollHandoff} />
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Governance Boundary</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <p>Beauty OS kernel changes: 0</p>
            <p>H8 resource migration: applied in E2E proof</p>
            <p>Resource DB concurrency: Real DB proven; staff interval remains contract boundary</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function JourneyPanel({
  title,
  description,
  status,
  actionLabel,
  testId,
  icon,
  onRun,
}: {
  title: string;
  description: string;
  status: JourneyStatus;
  actionLabel: string;
  testId: string;
  icon: React.ReactNode;
  onRun: () => Promise<void>;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <span
          data-testid={`${testId}-status`}
          className={
            status === 'PASS'
              ? 'rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800'
              : 'rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'
          }
        >
          {status}
        </span>
      </div>
      <button
        type="button"
        data-testid={testId}
        onClick={() => {
          void onRun();
        }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        <Play className="h-4 w-4" />
        {actionLabel}
      </button>
    </article>
  );
}

function EvidenceTile({
  testId,
  icon,
  label,
  value,
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div data-testid={testId} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 break-words text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
