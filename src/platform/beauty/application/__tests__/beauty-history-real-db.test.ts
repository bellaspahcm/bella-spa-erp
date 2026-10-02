import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import type { BeautyH8Database } from '@/platform/beauty/infrastructure';

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

function expectAppendOnlyRejection(error: { message: string } | null, operation: string): void {
  expect(error?.message ?? '').toMatch(/Beauty OS history tables are append-only|append-only/i);
  if (!error) {
    throw new Error(`${operation} unexpectedly succeeded against append-only Beauty OS history.`);
  }
}

describeWithRealSupabase('Beauty OS history Real DB contract proof', () => {
  const marker = `beauty-history-contract-${Date.now()}`;

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

  it('allows valid inserts and rejects update/delete for canonical history tables', async () => {
    const tenantA = await insertTenant('tenant-a');
    const tenantB = await insertTenant('tenant-b');
    const customerA = await insertCustomer(tenantA, 'customer-a');
    const branchId = randomUUID();
    const serviceId = randomUUID();
    const serviceCommitmentId = randomUUID();
    const actorId = randomUUID();
    const professionalId = randomUUID();
    const resourceId = randomUUID();
    const segmentId = randomUUID();
    const appointmentId = randomUUID();
    const assignmentId = randomUUID();
    const allocationId = randomUUID();
    const assignmentHistoryId = randomUUID();
    const allocationHistoryId = randomUUID();

    const { error: appointmentError } = await beautyClient
      .from('beauty_appointments')
      .insert({
        id: appointmentId,
        tenant_id: tenantA,
        branch_id: branchId,
        customer_id: customerA,
        service_id: serviceId,
        starts_at: '2026-10-02T16:00:00.000Z',
        ends_at: '2026-10-02T17:00:00.000Z',
        status: 'PENDING',
      });
    expect(appointmentError).toBeNull();

    const { error: assignmentError } = await beautyClient
      .from('beauty_professional_assignments')
      .insert({
        id: assignmentId,
        tenant_id: tenantA,
        service_commitment_id: serviceCommitmentId,
        professional_id: professionalId,
        status: 'PROPOSED',
      });
    expect(assignmentError).toBeNull();

    const { error: allocationError } = await beautyClient
      .from('beauty_resource_allocations')
      .insert({
        id: allocationId,
        tenant_id: tenantA,
        service_commitment_id: serviceCommitmentId,
        segment_id: segmentId,
        resource_id: resourceId,
        starts_at: '2026-10-02T16:00:00.000Z',
        ends_at: '2026-10-02T17:00:00.000Z',
        capacity_units: 1,
        status: 'PROPOSED',
      });
    expect(allocationError).toBeNull();

    const { error: assignmentHistoryError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .insert({
        id: assignmentHistoryId,
        tenant_id: tenantA,
        assignment_id: assignmentId,
        from_professional_id: null,
        to_professional_id: professionalId,
        event_type: 'E2E_APPEND_ONLY_PROOF',
        reason: marker,
        actor_id: actorId,
        occurred_at: '2026-10-02T16:01:00.000Z',
      });
    expect(assignmentHistoryError).toBeNull();

    const { error: allocationHistoryError } = await beautyClient
      .from('beauty_resource_allocation_history')
      .insert({
        id: allocationHistoryId,
        tenant_id: tenantA,
        allocation_id: allocationId,
        replacement_allocation_id: null,
        old_resource_id: null,
        new_resource_id: resourceId,
        segment_id: segmentId,
        event_type: 'E2E_APPEND_ONLY_PROOF',
        reason: marker,
        actor_id: actorId,
        occurred_at: '2026-10-02T16:02:00.000Z',
      });
    expect(allocationHistoryError).toBeNull();

    const { data: tenantReadback, error: tenantReadbackError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .select('id, tenant_id, event_type, reason')
      .eq('tenant_id', tenantA)
      .eq('id', assignmentHistoryId)
      .single();
    expect(tenantReadbackError).toBeNull();
    expect(tenantReadback).toEqual(expect.objectContaining({
      id: assignmentHistoryId,
      tenant_id: tenantA,
      event_type: 'E2E_APPEND_ONLY_PROOF',
      reason: marker,
    }));

    const { data: crossTenantReadback, error: crossTenantReadbackError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .select('id')
      .eq('tenant_id', tenantB)
      .eq('id', assignmentHistoryId);
    expect(crossTenantReadbackError).toBeNull();
    expect(crossTenantReadback).toEqual([]);

    const { error: assignmentUpdateError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .update({ reason: `${marker}-mutated` })
      .eq('id', assignmentHistoryId);
    expectAppendOnlyRejection(assignmentUpdateError, 'assignment history UPDATE');

    const { error: allocationUpdateError } = await beautyClient
      .from('beauty_resource_allocation_history')
      .update({ reason: `${marker}-mutated` })
      .eq('id', allocationHistoryId);
    expectAppendOnlyRejection(allocationUpdateError, 'allocation history UPDATE');

    const { error: assignmentDeleteError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .delete()
      .eq('id', assignmentHistoryId);
    expectAppendOnlyRejection(assignmentDeleteError, 'assignment history DELETE');

    const { error: allocationDeleteError } = await beautyClient
      .from('beauty_resource_allocation_history')
      .delete()
      .eq('id', allocationHistoryId);
    expectAppendOnlyRejection(allocationDeleteError, 'allocation history DELETE');

    console.warn(
      `[Beauty OS History Real DB proof] retained immutable fixture marker ${marker}; append-only rows are not runtime-cleaned by design.`,
    );
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
    return data!.id;
  }

  async function insertCustomer(tenantId: string, label: string): Promise<string> {
    const { data, error } = await seedClient
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name_mother: `${marker}-${label}`,
        phone: `06${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`,
        status: 'active',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    return data!.id;
  }
});
