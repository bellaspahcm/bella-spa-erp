/**
 * E2E Salary Test Database Helper
 * 
 * Utilities for setting up and tearing down test data for salary E2E tests.
 * Provides functions to create tenants, KTVs, packages, sessions, attendance, etc.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  Missing Supabase environment variables for E2E tests');
  console.warn('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.warn('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  console.warn('   Make sure .env.local is properly configured or set environment variables manually');
  // Don't throw error immediately, let tests decide if they need these
}

// Lazy-load Supabase client to allow environment variables to be set first
let supabaseAdmin: SupabaseClient | null = null;

function ensureSupabaseClient(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!url || !key) {
    throw new Error('Cannot create Supabase client: Missing environment variables');
  }
  
  supabaseAdmin = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  return supabaseAdmin;
}

// Test data constants
// Use fixed UUIDs for deterministic testing (not random, for reproducibility)
const TEST_PREFIX = 'e2e-salary-test';
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000009'; // Fixed UUID for test tenant

// ============================================================================
// TYPES
// ============================================================================

export type TestKTVProfile = {
  id: string;
  full_name: string;
  email: string;
  role: 'ktv';
  base_salary: number;
  resignation_date: string | null;
  tenant_id: string;
};

export type TestPackage = {
  id: string;
  name: string;
  description: string;
  session_multiplier: number;
  price: number;
  tenant_id: string;
  module: 'baby_care';
};

export type TestSessionLog = {
  id: string;
  booking_id: string;
  completed_by_ktv_id: string;
  status: 'completed';
  is_confirmed: boolean;
  rating: number;
  completed_at: string;
  tenant_id: string;
};

export type TestBooking = {
  id: string;
  customer_id: string;
  package_id: string;
  ktv_commission: number;
  package_name: string;
  total_amount: number;
  tenant_id: string;
  status: 'completed';
};

export type TestAttendance = {
  id: string;
  user_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  tenant_id: string;
};

export type TestKpiRecord = {
  id: string;
  ktv_id: string;
  month_year: string;
  bonus_amount: number;
  rank: number;
  total_sessions: number;
  tenant_id: string;
};

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Delete all test data from database
 */
export async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');

  try {
    const supabase = ensureSupabaseClient();
    
    // Delete in correct order to respect foreign keys
    const tables = [
      'salary_adjustments',
      'salary_records',
      'expenses',
      'kpi_records',
      'attendance',
      'session_reviews',
      'session_logs',
      'bookings',
      'packages',
      'customers',
      'users',
      'tenants',
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table as never)
        .delete()
        .like('id', `${TEST_PREFIX}%`);

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (OK)
        console.warn(`Warning deleting ${table}:`, error.message);
      }
    }

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

/**
 * Create test tenant
 */
export async function createTestTenant(): Promise<string> {
  const supabase = ensureSupabaseClient();
  const tenantData = {
    id: TEST_TENANT_ID,
    name: 'E2E Test Tenant',
    enabled_modules: { baby_care: true }, // JSONB: correct format
    status: 'active',
    salary_config: {
      kpi_bonus_enabled: true,
      rating_bonus_enabled: true,
      auto_deduction_enabled: true,
    },
  };

  const { data, error } = await supabase
    .from('tenants')
    .upsert(tenantData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create tenant: ${error.message}`);
  }

  console.log('✅ Created test tenant:', data.id);
  return data.id;
}

/**
 * Create test KTV users
 */
export async function createTestKTVs(profiles: TestKTVProfile[]): Promise<TestKTVProfile[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .upsert(profiles.map(p => ({
      ...p,
      phone: `0900000${profiles.indexOf(p)}`,
      created_at: new Date().toISOString(),
    })))
    .select();

  if (error) {
    throw new Error(`Failed to create KTVs: ${error.message}`);
  }

  console.log(`✅ Created ${data.length} test KTVs`);
  return data as TestKTVProfile[];
}

/**
 * Create test packages with session multipliers
 */
export async function createTestPackages(packages: TestPackage[]): Promise<TestPackage[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('packages')
    .upsert(packages.map(p => ({
      ...p,
      created_at: new Date().toISOString(),
      // Removed: is_active, duration_minutes (not in schema)
    })))
    .select();

  if (error) {
    throw new Error(`Failed to create packages: ${error.message}`);
  }

  console.log(`✅ Created ${data.length} test packages`);
  return data as TestPackage[];
}

/**
 * Create test customer
 */
export async function createTestCustomer(tenantId: string): Promise<string> {
  const customerData = {
    id: '00000000-0000-0000-0000-000000000201', // UUID for test customer
    name_mother: 'Test Customer', // REQUIRED: changed from full_name
    phone: '0900000999', // REQUIRED
    tenant_id: tenantId, // REQUIRED
    // Removed: email (doesn't exist in schema)
  };

  const { data, error } = await supabaseAdmin
    .from('customers')
    .upsert(customerData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }

  console.log('✅ Created test customer:', data.id);
  return data.id;
}

/**
 * Create test bookings
 */
export async function createTestBookings(
  customerId: string,
  packageId: string,
  tenantId: string,
  count: number,
  commissionPerSession: number,
  packageName: string
): Promise<TestBooking[]> {
  const bookings = Array.from({ length: count }, (_, i) => ({
    id: `${TEST_PREFIX}-booking-${packageId}-${i + 1}`,
    customer_id: customerId,
    package_id: packageId,
    ktv_commission: commissionPerSession,
    package_name: packageName,
    total_amount: commissionPerSession * 2,
    tenant_id: tenantId,
    status: 'completed' as const,
    booking_date: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .upsert(bookings)
    .select();

  if (error) {
    throw new Error(`Failed to create bookings: ${error.message}`);
  }

  console.log(`✅ Created ${data.length} test bookings`);
  return data as TestBooking[];
}

/**
 * Create test session logs
 */
export async function createTestSessionLogs(sessions: Omit<TestSessionLog, 'tenant_id'>[], tenantId: string): Promise<TestSessionLog[]> {
  const { data, error } = await supabaseAdmin
    .from('session_logs')
    .upsert(sessions.map(s => ({
      ...s,
      tenant_id: tenantId,
      created_at: s.completed_at,
    })))
    .select();

  if (error) {
    throw new Error(`Failed to create session logs: ${error.message}`);
  }

  console.log(`✅ Created ${data.length} test session logs`);
  return data as TestSessionLog[];
}

/**
 * Create test attendance records
 */
export async function createTestAttendance(records: Omit<TestAttendance, 'id' | 'tenant_id'>[], tenantId: string): Promise<TestAttendance[]> {
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .upsert(records.map((r, i) => ({
      id: `${TEST_PREFIX}-attendance-${i + 1}`,
      ...r,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
    })))
    .select();

  if (error) {
    throw new Error(`Failed to create attendance: ${error.message}`);
  }

  console.log(`✅ Created ${data.length} test attendance records`);
  return data as TestAttendance[];
}

/**
 * Create test KPI records
 */
export async function createTestKpiRecords(records: Omit<TestKpiRecord, 'id' | 'tenant_id'>[], tenantId: string): Promise<TestKpiRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('kpi_records')
    .upsert(records.map((r, i) => ({
      id: `${TEST_PREFIX}-kpi-${i + 1}`,
      ...r,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
    })))
    .select();

  if (error) {
    throw new Error(`Failed to create KPI records: ${error.message}`);
  }

  console.log(`✅ Created ${data.length} test KPI records`);
  return data as TestKpiRecord[];
}

/**
 * Create session reviews for rating calculation
 */
export async function createTestSessionReviews(
  sessionIds: string[],
  ratings: number[],
  tenantId: string
): Promise<void> {
  if (sessionIds.length !== ratings.length) {
    throw new Error('Session IDs and ratings arrays must have same length');
  }

  const reviews = sessionIds.map((sessionId, i) => ({
    id: `${TEST_PREFIX}-review-${i + 1}`,
    session_log_id: sessionId,
    rating: ratings[i],
    status: 'published' as const,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('session_reviews')
    .upsert(reviews);

  if (error) {
    throw new Error(`Failed to create session reviews: ${error.message}`);
  }

  console.log(`✅ Created ${reviews.length} test session reviews`);
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get salary record for KTV
 */
export async function getSalaryRecord(ktvId: string, monthYear: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('salary_records')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get salary record: ${error.message}`);
  }

  return data;
}

/**
 * Get all session logs for KTV
 */
export async function getSessionLogs(ktvId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('session_logs')
    .select('*')
    .eq('completed_by_ktv_id', ktvId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to get session logs: ${error.message}`);
  }

  return data;
}

/**
 * Get salary expense for KTV
 */
export async function getSalaryExpense(ktvId: string, monthYear: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('category', 'salary')
    .eq('tenant_id', tenantId)
    .like('notes', `%${ktvId}%`)
    .like('notes', `%${monthYear}%`)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get salary expense: ${error.message}`);
  }

  return data;
}

/**
 * Get admin client for direct queries
 */
export function getAdminClient(): SupabaseClient {
  return ensureSupabaseClient();
}

/**
 * Get test tenant ID
 */
export function getTestTenantId(): string {
  return TEST_TENANT_ID;
}

/**
 * Get test prefix
 */
export function getTestPrefix(): string {
  return TEST_PREFIX;
}

/**
 * Check if environment is configured for E2E tests
 * @throws Error if environment is not properly configured
 */
export function assertTestEnvironment(): void {
  if (!SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable. Cannot run E2E tests.');
  }
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Cannot run E2E tests.');
  }
  console.log('✓ Environment configured for E2E tests');
}
