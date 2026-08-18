/**
 * E2E Test Setup Helper for Phase 3C
 * 
 * Centralized setup and teardown utilities for end-to-end Runtime tests.
 * 
 * Key differences from Phase 3B:
 * - Uses anon key + tenant JWT (not service_role)
 * - Includes Finance OS mock setup
 * - Includes RLS verification helpers
 * 
 * @see BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedClient } from './test-jwt-helper';
import { FinanceOSMock, financeOSMock } from './finance-os-mock';
import { E2ETenant, E2E_TENANTS } from './e2e-fixtures';

export interface E2ETestContext {
  tenantAClient: SupabaseClient;
  tenantBClient: SupabaseClient;
  attackerClient: SupabaseClient;
  serviceRoleClient: SupabaseClient;
  financeOSMock: FinanceOSMock;
}

/**
 * Setup E2E test environment
 * 
 * Creates authenticated clients for each test tenant with proper JWT context.
 * 
 * @returns Test context with pre-configured clients
 */
export function setupE2ETest(): E2ETestContext {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not found in environment');
  }

  // Tenant-authenticated clients (RLS enforced)
  const tenantAClient = createAuthenticatedClient(
    E2E_TENANTS.TENANT_A.tenantId,
    E2E_TENANTS.TENANT_A.userId
  );

  const tenantBClient = createAuthenticatedClient(
    E2E_TENANTS.TENANT_B.tenantId,
    E2E_TENANTS.TENANT_B.userId
  );

  const attackerClient = createAuthenticatedClient(
    E2E_TENANTS.TENANT_ATTACKER.tenantId,
    E2E_TENANTS.TENANT_ATTACKER.userId
  );

  // Service role client (RLS bypass, for test cleanup)
  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey);

  // Reset Finance OS mock
  financeOSMock.reset();

  return {
    tenantAClient,
    tenantBClient,
    attackerClient,
    serviceRoleClient,
    financeOSMock,
  };
}

/**
 * Cleanup test data for specific tenant
 * 
 * Uses service_role to bypass RLS for cleanup.
 */
export async function cleanupTenantData(
  serviceRoleClient: SupabaseClient,
  tenantId: string
): Promise<void> {
  // Delete in order to respect foreign key constraints
  await serviceRoleClient
    .from('runtime_quarantine')
    .delete()
    .eq('tenant_id', tenantId);

  await serviceRoleClient
    .from('runtime_outbox')
    .delete()
    .eq('tenant_id', tenantId);

  await serviceRoleClient
    .from('runtime_idempotency_registry')
    .delete()
    .eq('tenant_id', tenantId);

  await serviceRoleClient
    .from('runtime_audit_log')
    .delete()
    .eq('tenant_id', tenantId);

  // Note: Do NOT delete from runtime_tenant_registry
  // Tenants persist across tests for RLS policy verification
}

/**
 * Cleanup all E2E test data
 */
export async function cleanupAllE2EData(
  serviceRoleClient: SupabaseClient
): Promise<void> {
  await cleanupTenantData(serviceRoleClient, E2E_TENANTS.TENANT_A.tenantId);
  await cleanupTenantData(serviceRoleClient, E2E_TENANTS.TENANT_B.tenantId);
  await cleanupTenantData(serviceRoleClient, E2E_TENANTS.TENANT_ATTACKER.tenantId);
}

/**
 * Ensure test tenants exist in registry
 * 
 * Creates test tenants if they don't exist. Uses service_role for setup.
 */
export async function ensureTestTenantsExist(
  serviceRoleClient: SupabaseClient
): Promise<void> {
  const tenants = [
    E2E_TENANTS.TENANT_A,
    E2E_TENANTS.TENANT_B,
    E2E_TENANTS.TENANT_ATTACKER,
  ];

  for (const tenant of tenants) {
    const { data: existing } = await serviceRoleClient
      .from('runtime_tenant_registry')
      .select('tenant_id')
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (!existing) {
      await serviceRoleClient
        .from('runtime_tenant_registry')
        .insert({
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          is_active: true,
          created_at: new Date().toISOString(),
        });
    }
  }
}

/**
 * Verify RLS policy enforcement
 * 
 * Attempts cross-tenant query and expects empty result (not error).
 * 
 * @param client - Authenticated client (tenant context)
 * @param tableName - Table to query
 * @param otherTenantId - Tenant ID that should NOT be accessible
 * @returns True if RLS correctly blocks access
 */
export async function verifyRLSEnforcement(
  client: SupabaseClient,
  tableName: string,
  otherTenantId: string
): Promise<boolean> {
  const { data, error } = await client
    .from(tableName)
    .select('*')
    .eq('tenant_id', otherTenantId);

  // RLS should return empty array, not error
  // Error would indicate RLS policy issue
  if (error) {
    console.error(`RLS verification failed with error:`, error);
    return false;
  }

  // Empty result means RLS correctly filtered records
  return data.length === 0;
}

/**
 * Verify tenant isolation across all Runtime tables
 */
export async function verifyTenantIsolation(
  client: SupabaseClient,
  tenantId: string,
  otherTenantId: string
): Promise<{ table: string; isolated: boolean }[]> {
  const tables = [
    'runtime_audit_log',
    'runtime_idempotency_registry',
    'runtime_outbox',
    'runtime_quarantine',
  ];

  const results = [];

  for (const table of tables) {
    const isolated = await verifyRLSEnforcement(client, table, otherTenantId);
    results.push({ table, isolated });
  }

  return results;
}

/**
 * Get environment configuration summary for test reports
 */
export function getTestEnvironmentInfo(): {
  supabaseUrl: string;
  hasServiceRoleKey: boolean;
  hasAnonKey: boolean;
  hasJWTSecret: boolean;
  rlsEnabled: boolean;
} {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasJWTSecret: !!process.env.SUPABASE_JWT_SECRET,
    rlsEnabled: true, // Assume RLS enabled in Phase 3C
  };
}
