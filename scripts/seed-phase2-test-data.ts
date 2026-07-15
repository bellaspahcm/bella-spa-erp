/**
 * Quick Seed Script for Phase 2 Local Testing
 * 
 * Creates isolated test data for June 2026:
 * - 1 test KTV with attendance records
 * - Sessions with packages
 * - KPI and rating data
 * 
 * Safe to run multiple times (will clean up existing test data first)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_' + 'KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data IDs (prefixed to avoid conflict with real data)
const TEST_PREFIX = 'phase2-test';
const TEST_KTV_ID = `${TEST_PREFIX}-ktv-001`;
const TEST_CUSTOMER_ID = `${TEST_PREFIX}-customer-001`;
const TEST_PACKAGE_ID = `${TEST_PREFIX}-package-001`;

async function cleanupTestData() {
  console.log('🧹 Cleaning up existing test data...');
  
  // Delete in reverse dependency order
  await supabase.from('session_reviews').delete().like('ktv_id', `${TEST_PREFIX}%`);
  await supabase.from('kpi_records').delete().like('ktv_id', `${TEST_PREFIX}%`);
  await supabase.from('attendance').delete().like('user_id', `${TEST_PREFIX}%`);
  await supabase.from('sessions').delete().like('completed_by_ktv_id', `${TEST_PREFIX}%`);
  await supabase.from('bookings').delete().like('customer_id', `${TEST_PREFIX}%`);
  await supabase.from('salary_records').delete().like('ktv_id', `${TEST_PREFIX}%`);
  await supabase.from('packages').delete().like('id', `${TEST_PREFIX}%`);
  await supabase.from('customers').delete().like('id', `${TEST_PREFIX}%`);
  await supabase.from('users').delete().like('id', `${TEST_PREFIX}%`);
  
  console.log('✓ Cleanup complete');
}

async function getTenantId(): Promise<string | null> {
  // Get Bella Spa tenant (production database)
  const { data } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(10);
  
  if (!data || data.length === 0) {
    console.error('   ❌ No tenants found in database');
    return null;
  }
  
  // Show available tenants and ask user to confirm
  console.log('   Available tenants:');
  data.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.name} (${t.id})`);
  });
  
  // Use first tenant (assuming it's Bella Spa)
  const tenantId = data[0].id;
  console.log(`\n   ⚠️  Will use tenant: ${data[0].name} (${tenantId})`);
  console.log(`   ⚠️  Test data will have prefix "${TEST_PREFIX}-" to avoid conflicts`);
  
  return tenantId;
}

async function seedTestData() {
  console.log('\n🌱 Seeding Phase 2 test data...\n');
  
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error('No tenant available');
  }
  
  // 1. Create test KTV
  console.log('\n1️⃣  Creating test KTV...');
  const { error: ktvError } = await supabase.from('users').insert({
    id: TEST_KTV_ID,
    email: `${TEST_PREFIX}@test.local`,
    full_name: 'Test KTV Phase 2',
    role: 'ktv',
    tenant_id: tenantId,
    base_salary: 4000000, // 4M VND base
    created_at: new Date().toISOString(),
  });
  
  if (ktvError) throw ktvError;
  console.log('   ✓ KTV created:', TEST_KTV_ID);
  
  // 2. Create test customer
  console.log('\n2️⃣  Creating test customer...');
  const { error: customerError } = await supabase.from('customers').insert({
    id: TEST_CUSTOMER_ID,
    full_name: 'Test Customer',
    phone: '0900000000',
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  });
  
  if (customerError) throw customerError;
  console.log('   ✓ Customer created:', TEST_CUSTOMER_ID);
  
  // 3. Create test package
  console.log('\n3️⃣  Creating test package...');
  const { error: packageError } = await supabase.from('packages').insert({
    id: TEST_PACKAGE_ID,
    name: 'Test Package - Combo VIP',
    description: 'Test package for Phase 2',
    session_multiplier: 2.0, // VIP package
    price: 10000000,
    module: 'baby_care',
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  });
  
  if (packageError) throw packageError;
  console.log('   ✓ Package created:', TEST_PACKAGE_ID);
  
  // 4. Create booking
  console.log('\n4️⃣  Creating test booking...');
  const bookingId = `${TEST_PREFIX}-booking-001`;
  const { error: bookingError } = await supabase.from('bookings').insert({
    id: bookingId,
    customer_id: TEST_CUSTOMER_ID,
    package_id: TEST_PACKAGE_ID,
    package_name: 'Test Package - Combo VIP',
    ktv_commission: 200000, // 200k per session
    total_amount: 10000000,
    status: 'completed',
    tenant_id: tenantId,
    created_at: '2026-06-01T10:00:00Z',
  });
  
  if (bookingError) throw bookingError;
  console.log('   ✓ Booking created:', bookingId);
  
  // 5. Create sessions (10 sessions in June 2026)
  console.log('\n5️⃣  Creating test sessions...');
  const sessions = [];
  for (let i = 1; i <= 10; i++) {
    sessions.push({
      id: `${TEST_PREFIX}-session-${String(i).padStart(3, '0')}`,
      booking_id: bookingId,
      completed_by_ktv_id: TEST_KTV_ID,
      status: 'completed' as const,
      is_confirmed: true,
      rating: i % 2 === 0 ? 5 : 4, // Alternating 5-star and 4-star
      completed_at: `2026-06-${String(i + 5).padStart(2, '0')}T14:00:00Z`,
      tenant_id: tenantId,
    });
  }
  
  const { error: sessionsError } = await supabase.from('sessions').insert(sessions);
  if (sessionsError) throw sessionsError;
  console.log(`   ✓ Created ${sessions.length} sessions`);
  
  // 6. Create attendance records (15 working days in June)
  console.log('\n6️⃣  Creating attendance records...');
  const attendanceRecords = [];
  for (let day = 1; day <= 26; day++) {
    // Skip Sundays (days 7, 14, 21, 28...)
    if (day % 7 === 0) continue;
    
    // 1 late day, 2 absent days, rest present
    let status: 'present' | 'late' | 'absent' = 'present';
    if (day === 10) status = 'late';
    if (day === 15 || day === 20) status = 'absent';
    
    attendanceRecords.push({
      user_id: TEST_KTV_ID,
      date: `2026-06-${String(day).padStart(2, '0')}`,
      status,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
    });
  }
  
  const { error: attendanceError } = await supabase.from('attendance').insert(attendanceRecords);
  if (attendanceError) throw attendanceError;
  console.log(`   ✓ Created ${attendanceRecords.length} attendance records`);
  
  // 7. Create KPI record
  console.log('\n7️⃣  Creating KPI record...');
  const { error: kpiError } = await supabase.from('kpi_records').insert({
    ktv_id: TEST_KTV_ID,
    month_year: '2026-06',
    kpi_amount: 500000, // 500k KPI bonus
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  });
  
  if (kpiError) throw kpiError;
  console.log('   ✓ KPI record created: 500,000 VND');
  
  // 8. Create session reviews
  console.log('\n8️⃣  Creating session reviews...');
  const reviews = sessions.map((session, i) => ({
    session_id: session.id,
    ktv_id: TEST_KTV_ID,
    rating: session.rating,
    tenant_id: tenantId,
    created_at: session.completed_at,
  }));
  
  const { error: reviewsError } = await supabase.from('session_reviews').insert(reviews);
  if (reviewsError) throw reviewsError;
  console.log(`   ✓ Created ${reviews.length} reviews (avg rating: 4.5)`);
  
  console.log('\n✅ Test data seeded successfully!\n');
  console.log('📊 Summary:');
  console.log(`   • KTV: Test KTV Phase 2 (${TEST_KTV_ID})`);
  console.log(`   • Base salary: 4,000,000 VND`);
  console.log(`   • Sessions: 10 (with 2.0x multiplier = 20 quy đổi)`);
  console.log(`   • Attendance: ${attendanceRecords.length} days (1 late, 2 absent)`);
  console.log(`   • KPI bonus: 500,000 VND`);
  console.log(`   • Avg rating: 4.5 stars`);
  console.log(`   • Expected session bonus: ~2,000,000 VND (200k × 10)`);
  console.log(`   • Expected rating bonus: ~450,000 VND`);
  console.log(`   • Expected attendance deduction: ~300,000 VND (late + absent)`);
  console.log('\n🧪 Now go to: http://localhost:3000/dashboard/salary');
  console.log('   Search for "Test KTV Phase 2" and check console logs for [PHASE_2_ACTIVE]');
}

async function main() {
  try {
    await cleanupTestData();
    await seedTestData();
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
