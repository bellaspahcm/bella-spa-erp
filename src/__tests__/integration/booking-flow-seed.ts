/**
 * Test Database Seeding Script for Booking Flow Integration Tests
 * 
 * Purpose:
 * - Populate test database with realistic data
 * - Create tenants, KTVs, customers, services for testing
 * - Idempotent: Can run multiple times safely
 * 
 * Usage:
 * ```typescript
 * import { seedTestDatabase, cleanupTestDatabase } from './booking-flow-seed';
 * 
 * beforeAll(async () => {
 *   await seedTestDatabase();
 * });
 * 
 * afterAll(async () => {
 *   await cleanupTestDatabase();
 * });
 * ```
 * 
 * @module integration/booking-flow-seed
 */

import { createClient } from '@supabase/supabase-js';

// Test database configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
}

// Create Supabase client with service role (bypasses RLS)
export const testSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test data IDs (fixed UUIDs for predictable testing)
export const TEST_IDS = {
  tenant: '00000000-0000-0000-0000-000000000001',
  
  ktvs: {
    alice: '00000000-0000-0000-0000-000000000101', // Senior KTV, high rating
    bob: '00000000-0000-0000-0000-000000000102',   // Mid-level KTV
    carol: '00000000-0000-0000-0000-000000000103', // Junior KTV
    david: '00000000-0000-0000-0000-000000000104', // Senior KTV, low rating
    emma: '00000000-0000-0000-0000-000000000105',  // Fully booked KTV
  },
  
  customers: {
    vip: '00000000-0000-0000-0000-000000000201',
    loyal: '00000000-0000-0000-0000-000000000202',
    new: '00000000-0000-0000-0000-000000000203',
    emma_customer: '00000000-0000-0000-0000-000000000299',
    concurrency_customer: '00000000-0000-0000-0000-000000000205',
  },
  
  services: {
    massage: '00000000-0000-0000-0000-000000000301',
    facial: '00000000-0000-0000-0000-000000000302',
    combo: '00000000-0000-0000-0000-000000000303',
  },
  
  packages: {
    standard: '00000000-0000-0000-0000-000000000401',
    vip: '00000000-0000-0000-0000-000000000402',
  },
} as const;

/**
 * Seed test database with all required data
 * 
 * Creates:
 * - 1 test tenant
 * - 5 KTVs with varying profiles
 * - 3 customers (VIP, loyal, new)
 * - 3 services
 * - 2 packages
 * - Some existing bookings for conflict testing
 */
export async function seedTestDatabase(): Promise<void> {
  console.log('[Seed] Starting test database seeding...');

  try {
    // 1. Create test tenant
    const { error: tenantError } = await testSupabase.from('tenants').upsert({
      id: TEST_IDS.tenant,
      name: 'Bella Test Spa',
      status: 'active',
      address: '123 Test Street',
      contact_name: 'Test Manager',
      contact_phone: '0123456789',
      metadata: {
        capacity_config: {
          minBreakMinutes: 15,
          workingHoursStart: '00:00',
          workingHoursEnd: '23:59',
          bufferPercentage: 10,
          enablePeakHours: true,
          peakHoursStart: '12:00',
          peakHoursEnd: '18:00',
          peakHoursMaxBookings: 6,
          enforceBreakTimes: true,
        }
      },
    });
    if (tenantError) throw tenantError;
    console.log('[Seed] ✅ Tenant created');

    // 1.1 Create packages/services
    const packagesToSeed = [
      {
        id: TEST_IDS.services.massage,
        name: 'Body Massage',
        description: 'Standard massage service',
        full_price: 500000,
        total_sessions: 1,
        status: 'active',
        tenant_id: TEST_IDS.tenant,
        module_key: 'baby_care',
        service_kind: 'single_service',
        default_duration_minutes: 90,
        requires_resource: false,
        before_after_required: false,
      },
      {
        id: TEST_IDS.services.facial,
        name: 'Facial Care',
        description: 'Facial care service',
        full_price: 300000,
        total_sessions: 1,
        status: 'active',
        tenant_id: TEST_IDS.tenant,
        module_key: 'baby_care',
        service_kind: 'single_service',
        default_duration_minutes: 90,
        requires_resource: false,
        before_after_required: false,
      },
      {
        id: TEST_IDS.services.combo,
        name: 'Baby Care Combo',
        description: 'Combo package for baby care',
        full_price: 1500000,
        total_sessions: 5,
        status: 'active',
        tenant_id: TEST_IDS.tenant,
        module_key: 'baby_care',
        service_kind: 'treatment_package',
        default_duration_minutes: 90,
        requires_resource: false,
        before_after_required: false,
      },
      {
        id: TEST_IDS.packages.standard,
        name: 'Standard Package',
        description: 'Standard baby care package',
        full_price: 3000000,
        total_sessions: 10,
        status: 'active',
        tenant_id: TEST_IDS.tenant,
        module_key: 'baby_care',
        service_kind: 'treatment_package',
        default_duration_minutes: 90,
        requires_resource: false,
        before_after_required: false,
      },
      {
        id: TEST_IDS.packages.vip,
        name: 'VIP Package',
        description: 'VIP baby care package',
        full_price: 5000000,
        total_sessions: 15,
        status: 'active',
        tenant_id: TEST_IDS.tenant,
        module_key: 'baby_care',
        service_kind: 'treatment_package',
        default_duration_minutes: 90,
        requires_resource: false,
        before_after_required: false,
      },
    ];

    const { error: packagesError } = await testSupabase.from('packages').upsert(packagesToSeed);
    if (packagesError) throw packagesError;
    console.log('[Seed] ✅ Packages created');

    // 2. Create KTVs with diverse profiles
    const ktvs = [
      {
        id: TEST_IDS.ktvs.alice,
        email: 'alice@test.com',
        full_name: 'Alice Nguyen',
        phone: '0901234567',
        role: 'ktv',
        position_tier: 'senior',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          skills: ['Massage', 'Deep Tissue Massage', 'Swedish Massage'],
          specializations: ['Massage', 'Deep Tissue Massage'],
          avg_rating: 4.8,
          years_of_service: 5,
          max_daily_bookings: 8,
        }
      },
      {
        id: TEST_IDS.ktvs.bob,
        email: 'bob@test.com',
        full_name: 'Bob Tran',
        phone: '0901234568',
        role: 'ktv',
        position_tier: 'junior',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          skills: ['Massage', 'Facial', 'Manicure'],
          specializations: ['Facial'],
          avg_rating: 4.5,
          years_of_service: 2,
          max_daily_bookings: 8,
        }
      },
      {
        id: TEST_IDS.ktvs.carol,
        email: 'carol@test.com',
        full_name: 'Carol Le',
        phone: '0901234569',
        role: 'ktv',
        position_tier: 'junior',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          skills: ['Massage', 'Manicure'],
          specializations: [],
          avg_rating: 4.2,
          years_of_service: 1,
          max_daily_bookings: 8,
        }
      },
      {
        id: TEST_IDS.ktvs.david,
        email: 'david@test.com',
        full_name: 'David Pham',
        phone: '0901234570',
        role: 'ktv',
        position_tier: 'senior',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          skills: ['Massage', 'Deep Tissue Massage'],
          specializations: ['Massage'],
          avg_rating: 3.2,
          years_of_service: 4,
          max_daily_bookings: 8,
        }
      },
      {
        id: TEST_IDS.ktvs.emma,
        email: 'emma@test.com',
        full_name: 'Emma Vo',
        phone: '0901234571',
        role: 'ktv',
        position_tier: 'junior',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          skills: ['Massage', 'Swedish Massage'],
          specializations: ['Massage'],
          avg_rating: 4.7,
          years_of_service: 3,
          max_daily_bookings: 8,
        }
      },
    ];

    const { error: ktvsError } = await testSupabase.from('users').upsert(ktvs);
    if (ktvsError) throw ktvsError;
    console.log('[Seed] ✅ KTVs created (5 users)');

    // 3. Create customers
    const customers = [
      {
        id: TEST_IDS.customers.vip,
        phone: '0987654321',
        name_mother: 'VIP Customer Nguyen',
        name_baby: 'Baby VIP',
        dob_baby: '2025-06-15',
        address: '456 VIP Street',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          tier: 'vip',
        },
      },
      {
        id: TEST_IDS.customers.loyal,
        phone: '0987654322',
        name_mother: 'Loyal Customer Tran',
        name_baby: 'Baby Loyal',
        dob_baby: '2025-08-20',
        address: '789 Loyal Avenue',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          tier: 'loyal',
        },
      },
      {
        id: TEST_IDS.customers.new,
        phone: '0987654323',
        name_mother: 'New Customer Le',
        name_baby: 'Baby New',
        dob_expected: '2026-09-01',
        address: '321 New Road',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          tier: 'new',
        },
      },
      {
        id: TEST_IDS.customers.emma_customer,
        phone: '0987654329',
        name_mother: 'Emma Customer Vo',
        name_baby: 'Baby Emma',
        dob_baby: '2025-06-15',
        address: '77 Emma Street',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          tier: 'loyal',
        },
      },
      {
        id: TEST_IDS.customers.concurrency_customer,
        phone: '0987654325',
        name_mother: 'Concurrency Customer',
        name_baby: 'Baby Concurrency',
        dob_baby: '2025-06-15',
        address: '55 Concurrency Street',
        tenant_id: TEST_IDS.tenant,
        status: 'active',
        metadata: {
          tier: 'loyal',
        },
      },
    ];

    const { error: customersError } = await testSupabase.from('customers').upsert(customers);
    if (customersError) throw customersError;
    console.log('[Seed] ✅ Customers created (4 customers)');

    // 4. Seed existing bookings for Emma (to make her fully booked)
    const today = new Date().toISOString().split('T')[0];
    const emmaBookings = [];
    
    for (let i = 0; i < 8; i++) {
      const hour = 8 + (i * 2); // 08:00, 10:00, 12:00, ... 22:00
      emmaBookings.push({
        id: `00000000-0000-0000-0000-0000000005${String(i).padStart(2, '0')}`,
        booking_id: `00000000-0000-0000-0000-0000000004${String(i).padStart(2, '0')}`,
        assigned_date: today,
        assigned_time: `${String(hour).padStart(2, '0')}:00`,
        completed_by_ktv_id: TEST_IDS.ktvs.emma,
        standard_duration: 90,
        status: 'pending',
        tenant_id: TEST_IDS.tenant,
        session_number: i + 1,
      });
    }

    // Create dummy parent bookings for Emma's sessions
    const emmaParentBookings = emmaBookings.map((session, i) => ({
      id: session.booking_id,
      booking_number: `TEST-EMMA-${String(i + 1).padStart(3, '0')}`,
      customer_id: TEST_IDS.customers.emma_customer,
      package_id: TEST_IDS.packages.standard,
      status: 'booked',
      tenant_id: TEST_IDS.tenant,
      total_sessions: 1,
      completed_sessions: 0,
    }));

    const { error: parentBookingsError } = await testSupabase.from('bookings').upsert(emmaParentBookings);
    if (parentBookingsError) throw parentBookingsError;

    const { error: sessionsError } = await testSupabase.from('session_logs').upsert(emmaBookings);
    if (sessionsError) throw sessionsError;
    console.log(`[Seed] ✅ Emma's bookings created (8 sessions on ${today})`);

    console.log('[Seed] ✅ Test database seeding completed successfully!');
  } catch (error) {
    console.error('[Seed] ❌ Error seeding test database:', error);
    throw error;
  }
}

/**
 * Clean up test database (remove all test data)
 * 
 * Deletes:
 * - Session logs
 * - Bookings
 * - Customers
 * - Users (KTVs)
 * - Tenant
 * 
 * Order matters due to foreign key constraints.
 */
export async function cleanupTestDatabase(): Promise<void> {
  console.log('[Cleanup] Starting test database cleanup...');

  try {
    // Delete in reverse order of creation (respect FK constraints)
    
    // 1. Delete session logs
    const { error: logsError } = await testSupabase
      .from('session_logs')
      .delete()
      .eq('tenant_id', TEST_IDS.tenant);
    if (logsError) throw logsError;
    console.log('[Cleanup] ✅ Session logs deleted');

    // 2. Delete bookings
    const { error: bookingsError } = await testSupabase
      .from('bookings')
      .delete()
      .eq('tenant_id', TEST_IDS.tenant);
    if (bookingsError) throw bookingsError;
    console.log('[Cleanup] ✅ Bookings deleted');

    // 2.1 Delete packages
    const { error: packagesError } = await testSupabase
      .from('packages')
      .delete()
      .eq('tenant_id', TEST_IDS.tenant);
    if (packagesError) throw packagesError;
    console.log('[Cleanup] ✅ Packages deleted');

    // 3. Delete customers
    const { error: customersError } = await testSupabase
      .from('customers')
      .delete()
      .eq('tenant_id', TEST_IDS.tenant);
    if (customersError) throw customersError;
    console.log('[Cleanup] ✅ Customers deleted');

    // 4. Delete users (KTVs)
    const { error: usersError } = await testSupabase
      .from('users')
      .delete()
      .eq('tenant_id', TEST_IDS.tenant);
    if (usersError) throw usersError;
    console.log('[Cleanup] ✅ Users deleted');

    // 5. Delete tenant
    const { error: tenantError } = await testSupabase
      .from('tenants')
      .delete()
      .eq('id', TEST_IDS.tenant);
    if (tenantError) throw tenantError;
    console.log('[Cleanup] ✅ Tenant deleted');

    console.log('[Cleanup] ✅ Test database cleanup completed successfully!');
  } catch (error) {
    console.error('[Cleanup] ❌ Error cleaning up test database:', error);
    throw error;
  }
}

/**
 * Create a test booking (helper for integration tests)
 * 
 * @param customerId - Customer ID
 * @param ktvId - KTV ID (optional - will auto-assign if not provided)
 * @param date - Booking date (YYYY-MM-DD)
 * @param time - Booking time (HH:mm)
 * @returns Created booking and session log IDs
 */
export async function createTestBooking(params: {
  customerId: string;
  ktvId?: string;
  date: string;
  time: string;
  durationMinutes?: number;
  serviceType?: string;
}): Promise<{
  bookingId: string;
  sessionId: string;
}> {
  const bookingId = `test-booking-${Date.now()}`;
  const sessionId = `test-session-${Date.now()}`;

  // Create parent booking
  const { error: bookingError } = await testSupabase.from('bookings').insert({
    id: bookingId,
    booking_number: `TEST-${Date.now()}`,
    customer_id: params.customerId,
    package_id: params.serviceType === 'Facial' ? TEST_IDS.services.facial : TEST_IDS.services.massage,
    status: 'booked',
    tenant_id: TEST_IDS.tenant,
    total_sessions: 1,
    completed_sessions: 0,
  });

  if (bookingError) {
    throw new Error(`Failed to create test booking: ${bookingError.message}`);
  }

  // Create session log
  const { error: sessionError } = await testSupabase.from('session_logs').insert({
    id: sessionId,
    booking_id: bookingId,
    assigned_date: params.date,
    assigned_time: params.time,
    completed_by_ktv_id: params.ktvId || null,
    standard_duration: params.durationMinutes || 90,
    status: 'pending',
    tenant_id: TEST_IDS.tenant,
    session_number: 1,
  });

  if (sessionError) {
    throw new Error(`Failed to create test session: ${sessionError.message}`);
  }

  return { bookingId, sessionId };
}

/**
 * Assert that a booking exists in database
 * 
 * @param bookingId - Booking ID to check
 * @throws Error if booking not found
 */
export async function assertBookingExists(bookingId: string): Promise<void> {
  const { data, error } = await testSupabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
}

/**
 * Get current booking count for a KTV on a specific date
 * 
 * @param ktvId - KTV ID
 * @param date - Date (YYYY-MM-DD)
 * @returns Number of bookings
 */
export async function getKtvBookingCount(ktvId: string, date: string): Promise<number> {
  const { data, error } = await testSupabase
    .from('session_logs')
    .select('id')
    .eq('completed_by_ktv_id', ktvId)
    .eq('assigned_date', date)
    .in('status', ['pending', 'confirmed', 'in_progress']);

  if (error) {
    throw new Error(`Failed to get KTV booking count: ${error.message}`);
  }

  return data?.length || 0;
}
