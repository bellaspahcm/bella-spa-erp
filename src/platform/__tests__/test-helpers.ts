/**
 * Platform Test Helpers
 * 
 * Shared utilities for integration and E2E tests
 * Prevents common friction points discovered during Student E2E
 */

import { createClient } from '@/lib/supabase-server';

// ============================================================================
// UUID Constants (Prevents "invalid UUID" errors in tests)
// ============================================================================

/**
 * Standard test user UUID (for created_by, updated_by fields)
 * Use this instead of strings like 'test-system'
 */
export const TEST_USER_UUID = '00000000-0000-0000-0000-000000000001';

/**
 * Non-existent entity UUID (for FK validation tests)
 * Use this to test "entity not found" scenarios
 */
export const NON_EXISTENT_UUID = '99999999-9999-9999-9999-999999999999';

/**
 * Test tenant UUID (for tenant isolation tests)
 */
export const TEST_TENANT_UUID = '11111111-1111-1111-1111-111111111111';

/**
 * Alternative tenant UUID (for cross-tenant isolation tests)
 */
export const TEST_TENANT_2_UUID = '22222222-2222-2222-2222-222222222222';

// ============================================================================
// Tenant Seeding
// ============================================================================

/**
 * Ensure test tenant exists in database
 * Call this in beforeAll() to prevent FK errors
 */
export async function ensureTestTenantExists(tenantId: string = TEST_TENANT_UUID): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('tenants')
    .upsert({
      id: tenantId,
      name: 'Test Tenant',
      slug: 'test-tenant',
      subscription_status: 'active',
      subscription_plan: 'enterprise',
    }, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });

  if (error && !error.message.includes('duplicate')) {
    throw new Error(`Failed to seed test tenant: ${error.message}`);
  }
}

/**
 * Clean up test data for a specific tenant
 * Call this in afterAll() to prevent test pollution
 */
export async function cleanupTestTenant(tenantId: string = TEST_TENANT_UUID): Promise<void> {
  const supabase = await createClient();
  
  // Order matters: delete in reverse FK dependency order
  await supabase.from('students').delete().eq('tenant_id', tenantId);
  await supabase.from('persons').delete().eq('tenant_id', tenantId);
  // Add more tables as needed
  
  // Optionally delete tenant itself (only if it's a dedicated test tenant)
  if (tenantId === TEST_TENANT_UUID || tenantId === TEST_TENANT_2_UUID) {
    await supabase.from('tenants').delete().eq('id', tenantId);
  }
}

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Get date string for "today" in YYYY-MM-DD format
 * Consistent across tests regardless of local timezone
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date string N days from today
 */
export function getDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Get date string for first day of current month
 */
export function getFirstDayOfMonth(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

/**
 * Get date string for last day of current month
 */
export function getLastDayOfMonth(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return date.toISOString().split('T')[0];
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that error message contains expected substring
 * Useful for FK validation and business rule tests
 */
export function expectErrorMessage(error: unknown, expectedSubstring: string): void {
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain(expectedSubstring);
}

/**
 * Assert that operation rejects with specific error
 */
export async function expectReject<T>(
  promise: Promise<T>,
  expectedSubstring: string
): Promise<void> {
  await expect(promise).rejects.toThrow();
  try {
    await promise;
  } catch (error) {
    expectErrorMessage(error, expectedSubstring);
  }
}

// ============================================================================
// Database Verification
// ============================================================================

/**
 * Verify that a table exists in database
 * Useful for migration tests
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('pg_table_exists', { table_name: tableName });
  
  if (error) {
    throw new Error(`Failed to check table existence: ${error.message}`);
  }
  
  return data as boolean;
}

/**
 * Count rows in a table (with optional filters)
 * Useful for cleanup verification
 */
export async function countRows(
  tableName: string,
  filters?: Record<string, unknown>
): Promise<number> {
  const supabase = await createClient();
  
  let query = supabase.from(tableName).select('*', { count: 'exact', head: true });
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }
  
  const { count, error } = await query;
  
  if (error) {
    throw new Error(`Failed to count rows: ${error.message}`);
  }
  
  return count ?? 0;
}
