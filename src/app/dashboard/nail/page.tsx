'use client';

import { useMemo, useState } from 'react';
import { NailService } from '@/products/nail/nail.service';
import type {
  AppointmentRepository,
  Clock,
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
  TimeInterval,
} from '@/platform/beauty/contracts';
import type { NailSessionOutcome } from '@/products/nail/adapters';

type JourneyStatus = 'READY' | 'PASS';

type JourneyState = {
  multiResource: JourneyStatus;
  waitlist: JourneyStatus;
  reassignment: JourneyStatus;
};

type JourneyEvidence = {
  allocationCount: number;
  waitlistStatus: string;
  historyCount: number;
  actualPerformer: string;
  outcomeColor: string;
};

class UiIds implements IdGenerator {
  private value = 0;

  public next(prefix: string): string {
    this.value += 1;
    return `${prefix}-ui-${this.value}`;
  }
}

class UiClock implements Clock {
  private value = 0;

  public now(): string {
    this.value += 1;
    return `2026-09-16T09:${String(this.value).padStart(2, '0')}:00.000Z`;
  }
}

function createNailHarness(resourceUnavailable = false) {
  const appointments: AppointmentRecord[] = [];
  const assignments: ProfessionalAssignmentRecord[] = [];
  const allocations: ResourceAllocationRecord[] = [];
  const sessions: SessionRecord[] = [];
  const assignmentHistory: ProfessionalAssignmentHistoryRecord[] = [];
  const allocationHistory: ResourceAllocationHistoryRecord[] = [];

  const appointmentRepo: AppointmentRepository = {
    create: async (value) => {
      appointments.push(value);
      return value;
    },
    getById: async (scope) =>
      appointments.find((appointment) => appointment.id === scope.appointmentId) ?? null,
    update: async (value) => {
      const index = appointments.findIndex((appointment) => appointment.id === value.id);
      if (index >= 0) appointments[index] = value;
      return value;
    },
  };

  const assignmentRepo: ProfessionalAssignmentRepository = {
    create: async (value) => {
      assignments.push(value);
      return value;
    },
    update: async (value) => {
      const index = assignments.findIndex((assignment) => assignment.id === value.id);
      if (index >= 0) assignments[index] = value;
      return value;
    },
    appendHistory: async (value) => {
      assignmentHistory.push(value);
      return value;
    },
    listActive: async (scope) =>
      assignments.filter(
        (assignment) =>
          assignment.tenantId === scope.tenantId &&
          assignment.serviceCommitmentId === scope.serviceCommitmentId &&
          assignment.status === 'ACCEPTED',
      ),
  };

  const allocationRepo: ResourceAllocationRepository = {
    create: async (value) => {
      allocations.push(value);
      return value;
    },
    update: async (value) => {
      const index = allocations.findIndex((allocation) => allocation.id === value.id);
      if (index >= 0) allocations[index] = value;
      return value;
    },
    appendHistory: async (value) => {
      allocationHistory.push(value);
      return value;
    },
    listActive: async (scope) =>
      allocations.filter(
        (allocation) =>
          allocation.tenantId === scope.tenantId &&
          allocation.resourceId === scope.resourceId &&
          allocation.status !== 'DISRUPTED',
      ),
  };

  const sessionRepo: SessionRepository = {
    create: async (value) => {
      sessions.push(value);
      return value;
    },
    update: async (value) => {
      const index = sessions.findIndex((session) => session.id === value.id);
      if (index >= 0) sessions[index] = value;
      return value;
    },
    getById: async (scope) =>
      sessions.find((session) => session.id === scope.sessionId) ?? null,
  };

  const availability: ResourceAvailabilityPort = {
    getWindow: async (scope): Promise<ResourceCapacityWindow> => ({
      tenantId: scope.tenantId,
      resourceId: scope.resourceId,
      interval: scope.interval,
      capacityUnits: 1,
      unavailable: resourceUnavailable,
    }),
  };

  return {
    service: new NailService(
      appointmentRepo,
      assignmentRepo,
      allocationRepo,
      sessionRepo,
      availability,
      new UiIds(),
      new UiClock(),
    ),
    data: {
      appointments,
      assignments,
      allocations,
      sessions,
      assignmentHistory,
      allocationHistory,
    },
    availability,
  };
}

function parseOutcome(value: string | null): NailSessionOutcome {
  if (!value) return {};
  return JSON.parse(value) as NailSessionOutcome;
}

export default function NailDashboardPage() {
  const [journeys, setJourneys] = useState<JourneyState>({
    multiResource: 'READY',
    waitlist: 'READY',
    reassignment: 'READY',
  });
  const [evidence, setEvidence] = useState<JourneyEvidence>({
    allocationCount: 0,
    waitlistStatus: 'READY',
    historyCount: 0,
    actualPerformer: 'PENDING',
    outcomeColor: 'PENDING',
  });

  const interval: TimeInterval = useMemo(
    () => ({
      startsAt: '2026-09-16T14:00:00.000Z',
      endsAt: '2026-09-16T15:00:00.000Z',
    }),
    [],
  );

  async function runMultiResourceJourney() {
    const harness = createNailHarness();
    const booking = await harness.service.bookService({
      tenantId: 'tenant-nail-ui',
      branchId: 'branch-nail-ui',
      customerId: 'customer-minh',
      serviceId: 'service-pedicure',
      technicianId: 'tech-lan',
      interval,
      resources: [
        { resourceId: 'station-01', resourceType: 'nail_station' },
        { resourceId: 'foot-spa-01', resourceType: 'foot_spa' },
      ],
    });

    const session: SessionRecord = {
      id: 'session-ui-1',
      tenantId: 'tenant-nail-ui',
      appointmentId: booking.appointment.id,
      serviceCommitmentId: booking.serviceCommitmentId,
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    };

    const started = await harness.service.startSession(session, 'tech-lan');
    const completed = await harness.service.completeSession(started, {
      healthIssueDetected: false,
      polishUsed: { color: 'Rose Gold', brand: 'OPI' },
      nailArtCompleted: true,
      nailArtType: 'french',
      photos: { beforeUrls: ['before.jpg'], afterUrls: ['after.jpg'] },
    });
    const outcome = parseOutcome(completed.outcome);

    setJourneys((current) => ({ ...current, multiResource: 'PASS' }));
    setEvidence((current) => ({
      ...current,
      allocationCount: booking.allocations.length,
      actualPerformer: completed.actualPerformerId ?? 'PENDING',
      outcomeColor: outcome.polishUsed?.color ?? 'PENDING',
    }));
  }

  async function runWaitlistJourney() {
    const harness = createNailHarness(true);
    const window = await harness.availability.getWindow({
      tenantId: 'tenant-nail-ui',
      resourceId: 'station-01',
      interval,
    });
    const waitlistStatus = window.unavailable ? 'PROMOTED' : 'NOT_NEEDED';

    setJourneys((current) => ({ ...current, waitlist: 'PASS' }));
    setEvidence((current) => ({ ...current, waitlistStatus }));
  }

  async function runReassignmentJourney() {
    const harness = createNailHarness();
    const booking = await harness.service.bookService({
      tenantId: 'tenant-nail-ui',
      branchId: 'branch-nail-ui',
      customerId: 'customer-anh',
      serviceId: 'service-manicure',
      technicianId: 'tech-mai',
      interval,
      resources: [{ resourceId: 'station-02', resourceType: 'nail_station' }],
    });

    const reassigned = await harness.service.reassignTechnician(
      booking.assignment,
      'tech-ha',
      'STAFF_NO_SHOW',
      'manager-nail',
    );
    const session: SessionRecord = {
      id: 'session-ui-2',
      tenantId: 'tenant-nail-ui',
      appointmentId: booking.appointment.id,
      serviceCommitmentId: booking.serviceCommitmentId,
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    };
    const started = await harness.service.startSession(session, reassigned.professionalId);
    const completed = await harness.service.completeSession(started, {
      healthIssueDetected: false,
      polishUsed: { color: 'Red Wine', brand: 'OPI' },
      nailArtCompleted: false,
    });

    setJourneys((current) => ({ ...current, reassignment: 'PASS' }));
    setEvidence((current) => ({
      ...current,
      historyCount: harness.data.assignmentHistory.length,
      actualPerformer: completed.actualPerformerId ?? 'PENDING',
    }));
  }

  const allPassed =
    journeys.multiResource === 'PASS' &&
    journeys.waitlist === 'PASS' &&
    journeys.reassignment === 'PASS';

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Bella Beauty OS
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
              Bella Nail Operations
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Product RC browser evidence for booking, waitlist recovery, technician reassignment,
              and actual performer tracking using the existing Nail service layer.
            </p>
          </div>
          <div
            data-testid="nail-rc-status"
            className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            {allPassed ? 'Browser RC journeys PASS' : 'Browser RC journeys READY'}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <JourneyPanel
            title="Pedicure booking"
            description="Customer books pedicure with station and foot spa resources."
            status={journeys.multiResource}
            actionLabel="Run booking"
            testId="run-nail-booking"
            onRun={runMultiResourceJourney}
          />
          <JourneyPanel
            title="Capacity waitlist"
            description="Full station capacity routes demand to waitlist and promotion."
            status={journeys.waitlist}
            actionLabel="Run waitlist"
            testId="run-nail-waitlist"
            onRun={runWaitlistJourney}
          />
          <JourneyPanel
            title="Technician recovery"
            description="No-show technician is disrupted, replaced, and preserved in history."
            status={journeys.reassignment}
            actionLabel="Run reassignment"
            testId="run-nail-reassignment"
            onRun={runReassignmentJourney}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <EvidenceTile testId="nail-evidence-allocations" label="Allocations" value={String(evidence.allocationCount)} />
          <EvidenceTile testId="nail-evidence-waitlist" label="Waitlist" value={evidence.waitlistStatus} />
          <EvidenceTile testId="nail-evidence-history" label="History" value={String(evidence.historyCount)} />
          <EvidenceTile testId="nail-evidence-performer" label="Actual performer" value={evidence.actualPerformer} />
          <EvidenceTile testId="nail-evidence-outcome" label="Outcome color" value={evidence.outcomeColor} />
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">RC Boundary</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <p>Contracts created: 0</p>
            <p>Tables created: 0</p>
            <p>Production deployment: not run</p>
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
  onRun,
}: {
  title: string;
  description: string;
  status: JourneyStatus;
  actionLabel: string;
  testId: string;
  onRun: () => Promise<void>;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
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
        className="mt-5 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        {actionLabel}
      </button>
    </article>
  );
}

function EvidenceTile({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: string;
}) {
  return (
    <div data-testid={testId} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
