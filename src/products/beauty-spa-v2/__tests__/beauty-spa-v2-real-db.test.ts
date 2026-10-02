import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import type {
  Clock,
  IdGenerator,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
} from '@/platform/beauty/application/ports';
import type {
  ResourceAllocationHistoryRecord,
  ResourceAllocationRecord,
  ResourceCapacityWindow,
  SessionRecord,
  TimeInterval,
} from '@/platform/beauty/contracts';
import {
  SupabaseBeautyAppointmentRepository,
  SupabaseBeautyProfessionalAssignmentRepository,
  SupabaseBeautyResourceAllocationRepository,
  SupabaseBeautySessionRepository,
  type BeautyH8Database,
} from '@/platform/beauty/infrastructure';

import {
  BeautySpaV2Service,
  type SpaStaffAvailabilityPort,
} from '../service';

jest.setTimeout(120_000);

type SeedClient = SupabaseClient<Database>;
type BeautyClient = SupabaseClient<BeautyH8Database>;

function hasRealSupabaseAdminEnv(): boolean {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

class UuidIds implements IdGenerator {
  public next(): string {
    return randomUUID();
  }
}

class IncrementingClock implements Clock {
  private readonly base = Date.parse('2026-10-02T03:00:00.000Z');
  private ticks = 0;

  public now(): string {
    this.ticks += 1;
    return new Date(this.base + this.ticks * 60_000).toISOString();
  }
}

class FixedAvailability implements ResourceAvailabilityPort {
  public async getWindow(scope: { tenantId: string; resourceId: string; interval: TimeInterval }): Promise<ResourceCapacityWindow> {
    return {
      tenantId: scope.tenantId,
      resourceId: scope.resourceId,
      interval: scope.interval,
      capacityUnits: 1,
      unavailable: false,
    };
  }
}

class AlwaysAvailableStaff implements SpaStaffAvailabilityPort {
  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function isRejected<T>(result: PromiseSettledResult<T>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

class TwoPartyBarrier {
  private arrivals = 0;
  private readonly released: Promise<void>;
  private release: (() => void) | null = null;

  public constructor(private readonly label: string) {
    this.released = new Promise((resolve) => {
      this.release = resolve;
    });
  }

  public async wait(): Promise<void> {
    this.arrivals += 1;
    if (this.arrivals === 2) {
      this.release?.();
    }

    await Promise.race([
      this.released,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error(`${this.label} barrier timed out`)), 10_000);
      }),
    ]);
  }
}

class BarrieredResourceAllocationRepository implements ResourceAllocationRepository {
  private readonly barrier = new TwoPartyBarrier('Beauty V2 concurrent resource activation');

  public constructor(
    private readonly inner: ResourceAllocationRepository,
    private readonly resourceId: string,
  ) {}

  public create(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord> {
    return this.inner.create(allocation);
  }

  public async update(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord> {
    if (allocation.resourceId === this.resourceId && allocation.status === 'ACTIVE') {
      await this.barrier.wait();
    }
    return this.inner.update(allocation);
  }

  public appendHistory(history: ResourceAllocationHistoryRecord): Promise<ResourceAllocationHistoryRecord> {
    return this.inner.appendHistory(history);
  }

  public listActive(scope: { tenantId: string; resourceId: string }): Promise<ResourceAllocationRecord[]> {
    return this.inner.listActive(scope);
  }
}

describeWithRealSupabase('Bella Beauty Spa v2 Real DB business proof', () => {
  const marker = `beauty-v2-real-db-${Date.now()}`;
  const created = {
    tenants: [] as string[],
    customers: [] as string[],
  };

  let seedClient: SeedClient;
  let beautyClient: BeautyClient;

  beforeAll(() => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    seedClient = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    beautyClient = createSupabaseClient<BeautyH8Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  async function cleanup(label: string, result: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await result;
    if (error) {
      throw new Error(`${label} cleanup failed: ${error.message}`);
    }
  }

  afterAll(async () => {
    if (!beautyClient || !seedClient) return;

    for (const tenantId of created.tenants) {
      await cleanup('beauty_resource_allocation_history', beautyClient.from('beauty_resource_allocation_history').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_professional_assignment_history', beautyClient.from('beauty_professional_assignment_history').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_sessions', beautyClient.from('beauty_sessions').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_resource_allocations', beautyClient.from('beauty_resource_allocations').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_professional_assignments', beautyClient.from('beauty_professional_assignments').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_appointments', beautyClient.from('beauty_appointments').delete().eq('tenant_id', tenantId));
    }

    if (created.customers.length > 0) {
      await cleanup('customers', seedClient.from('customers').delete().in('id', created.customers));
    }
    if (created.tenants.length > 0) {
      console.warn(
        `[Beauty Spa V2 Real DB cleanup] retained tenant fixture(s) after owned Beauty/customer rows cleanup: ${created.tenants.join(', ')}`,
      );
    }
  });

  async function insertTenant(label: string): Promise<string> {
    const { data, error } = await seedClient
      .from('tenants')
      .insert({
        name: `${marker}-${label}`,
        status: 'active',
        product_key: 'bella_spa',
        enabled_modules: {
          beauty_spa: true,
          babycare: false,
          payroll: true,
        },
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.tenants.push(data!.id);
    return data!.id;
  }

  async function insertCustomer(tenantId: string, label: string): Promise<string> {
    const { data, error } = await seedClient
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name_mother: `${marker}-${label}`,
        phone: `05${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`,
        status: 'active',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.customers.push(data!.id);
    return data!.id;
  }

  function createService(allocationRepo: ResourceAllocationRepository = new SupabaseBeautyResourceAllocationRepository(beautyClient)) {
    const appointmentRepo = new SupabaseBeautyAppointmentRepository(beautyClient);
    const assignmentRepo = new SupabaseBeautyProfessionalAssignmentRepository(beautyClient);
    const sessionRepo = new SupabaseBeautySessionRepository(beautyClient);
    const service = new BeautySpaV2Service(
      appointmentRepo,
      assignmentRepo,
      allocationRepo,
      sessionRepo,
      new FixedAvailability(),
      new AlwaysAvailableStaff(),
      new UuidIds(),
      new IncrementingClock(),
    );
    return { service, appointmentRepo, sessionRepo };
  }

  it('persists booking, read-back, tenant scoping, history, rollback, retry, and checkout evidence', async () => {
    const tenantA = await insertTenant('tenant-a');
    const tenantB = await insertTenant('tenant-b');
    const customerA = await insertCustomer(tenantA, 'customer-a');
    const { service, appointmentRepo, sessionRepo } = createService();

    const interval: TimeInterval = {
      startsAt: '2026-10-02T10:00:00.000Z',
      endsAt: '2026-10-02T11:00:00.000Z',
    };
    const branchId = randomUUID();
    const serviceId = randomUUID();
    const therapistId = randomUUID();
    const actorId = randomUUID();
    const occupiedResourceId = randomUUID();
    const retryResourceId = randomUUID();

    await service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: therapistId,
      resources: [{
        resourceId: occupiedResourceId,
        resourceType: 'ROOM',
        segmentId: randomUUID(),
      }],
      actorId,
      bookingMode: 'BOOKING',
    });

    await expect(service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: randomUUID(),
      resources: [
        {
          resourceId: retryResourceId,
          resourceType: 'BED',
          segmentId: randomUUID(),
        },
        {
          resourceId: occupiedResourceId,
          resourceType: 'ROOM',
          segmentId: randomUUID(),
        },
      ],
      actorId,
      bookingMode: 'WALK_IN',
    })).rejects.toMatchObject({ code: 'RESOURCE_CAPACITY_CONFLICT' });

    const { data: rolledBackRows, error: rollbackReadError } = await beautyClient
      .from('beauty_resource_allocations')
      .select('id, tenant_id, resource_id, status, reason, actor_id')
      .eq('tenant_id', tenantA)
      .eq('resource_id', retryResourceId);
    expect(rollbackReadError).toBeNull();
    expect(rolledBackRows).toEqual([
      expect.objectContaining({
        tenant_id: tenantA,
        resource_id: retryResourceId,
        status: 'DISRUPTED',
        reason: 'BOOKING_RESOURCE_ALLOCATION_FAILED',
        actor_id: actorId,
      }),
    ]);

    const { data: allocationHistory, error: allocationHistoryError } = await beautyClient
      .from('beauty_resource_allocation_history')
      .select('event_type, reason, actor_id')
      .eq('tenant_id', tenantA)
      .eq('event_type', 'BOOKING_ALLOCATION_ROLLED_BACK');
    expect(allocationHistoryError).toBeNull();
    expect(allocationHistory).toEqual([
      expect.objectContaining({
        event_type: 'BOOKING_ALLOCATION_ROLLED_BACK',
        reason: 'BOOKING_RESOURCE_ALLOCATION_FAILED',
        actor_id: actorId,
      }),
    ]);

    const { data: assignmentHistory, error: assignmentHistoryError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .select('event_type, reason, actor_id')
      .eq('tenant_id', tenantA)
      .eq('event_type', 'BOOKING_ASSIGNMENT_ROLLED_BACK');
    expect(assignmentHistoryError).toBeNull();
    expect(assignmentHistory).toHaveLength(1);
    expect(assignmentHistory?.[0]).toEqual(expect.objectContaining({
      reason: 'BOOKING_ORCHESTRATION_FAILED',
      actor_id: actorId,
    }));

    const retried = await service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: therapistId,
      resources: [{
        resourceId: retryResourceId,
        resourceType: 'BED',
        segmentId: randomUUID(),
      }],
      actorId,
      bookingMode: 'BOOKING',
    });

    const crossTenantAppointment = await appointmentRepo.getById({
      tenantId: tenantB,
      appointmentId: retried.appointment.id,
    });
    expect(crossTenantAppointment).toBeNull();

    const { data: appointmentReadback, error: appointmentReadbackError } = await beautyClient
      .from('beauty_appointments')
      .select('id, tenant_id, customer_id, branch_id, service_id, status')
      .eq('tenant_id', tenantA)
      .eq('id', retried.appointment.id)
      .single();
    expect(appointmentReadbackError).toBeNull();
    expect(appointmentReadback).toEqual(expect.objectContaining({
      id: retried.appointment.id,
      tenant_id: tenantA,
      customer_id: customerA,
      branch_id: branchId,
      service_id: serviceId,
      status: 'PENDING',
    }));

    const plannedSession: SessionRecord = await sessionRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      appointmentId: retried.appointment.id,
      serviceCommitmentId: retried.serviceCommitmentId,
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    });

    const completed = await service.completeSession({
      session: plannedSession,
      performerId: therapistId,
      outcome: {
        checkedOutBy: actorId,
        customerHistoryNote: 'Real DB Beauty V2 checkout evidence persisted.',
        packageSessionUsed: true,
        paymentStatus: 'PAID',
        inventoryHandoff: 'NOT_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['BEAUTY_V2_REAL_DB', 'CHECKOUT_EVIDENCE'],
      },
    });
    expect(completed.status).toBe('COMPLETED');

    const crossTenantSession = await sessionRepo.getById({
      tenantId: tenantB,
      sessionId: plannedSession.id,
    });
    expect(crossTenantSession).toBeNull();

    const { data: completedSession, error: completedSessionError } = await beautyClient
      .from('beauty_sessions')
      .select('id, tenant_id, status, actual_performer_id, outcome')
      .eq('tenant_id', tenantA)
      .eq('id', plannedSession.id)
      .single();
    expect(completedSessionError).toBeNull();
    expect(completedSession).toEqual(expect.objectContaining({
      id: plannedSession.id,
      tenant_id: tenantA,
      status: 'COMPLETED',
      actual_performer_id: therapistId,
    }));

    const checkoutOutcome = JSON.parse(completedSession!.outcome ?? '{}') as {
      paymentStatus?: string;
      auditTags?: string[];
    };
    expect(checkoutOutcome.paymentStatus).toBe('PAID');
    expect(checkoutOutcome.auditTags).toEqual(expect.arrayContaining(['BEAUTY_V2_REAL_DB']));
  });

  it('proves Real DB rejects concurrent active allocations for the same resource and interval', async () => {
    const tenantA = await insertTenant('concurrency-tenant');
    const customerA = await insertCustomer(tenantA, 'concurrency-customer');
    const resourceId = randomUUID();
    const allocationRepo = new BarrieredResourceAllocationRepository(
      new SupabaseBeautyResourceAllocationRepository(beautyClient),
      resourceId,
    );
    const { service } = createService(allocationRepo);

    const interval: TimeInterval = {
      startsAt: '2026-10-02T14:00:00.000Z',
      endsAt: '2026-10-02T15:00:00.000Z',
    };
    const branchId = randomUUID();
    const serviceId = randomUUID();
    const actorId = randomUUID();

    const book = (label: string) => service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: randomUUID(),
      resources: [{
        resourceId,
        resourceType: 'ROOM',
        segmentId: randomUUID(),
      }],
      actorId,
      bookingMode: label === 'request-a' ? 'BOOKING' : 'WALK_IN',
    });

    const results = await Promise.allSettled([
      book('request-a'),
      book('request-b'),
    ]);

    const fulfilled = results.filter(isFulfilled);
    const rejected = results.filter(isRejected);
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toMatch(/resource allocation|conflict|overlap|constraint/i);

    const { data: activeRows, error: activeRowsError } = await beautyClient
      .from('beauty_resource_allocations')
      .select('id, tenant_id, resource_id, starts_at, ends_at, status')
      .eq('tenant_id', tenantA)
      .eq('resource_id', resourceId)
      .eq('status', 'ACTIVE');
    expect(activeRowsError).toBeNull();
    expect(activeRows).toHaveLength(1);
    const activeRow = activeRows![0];
    expect(activeRow).toEqual(expect.objectContaining({
      tenant_id: tenantA,
      resource_id: resourceId,
      status: 'ACTIVE',
    }));
    expect(new Date(activeRow.starts_at).toISOString()).toBe(interval.startsAt);
    expect(new Date(activeRow.ends_at).toISOString()).toBe(interval.endsAt);

    const { data: allRows, error: allRowsError } = await beautyClient
      .from('beauty_resource_allocations')
      .select('status')
      .eq('tenant_id', tenantA)
      .eq('resource_id', resourceId);
    expect(allRowsError).toBeNull();
    expect(allRows?.map((row) => row.status).sort()).toEqual(['ACTIVE', 'DISRUPTED']);
  });
});
