/**
 * Check if test data exists for Booking Engine tests
 * Run: node scripts/check-booking-engine-test-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load .env.local
const envConfig = dotenv.parse(readFileSync('.env.local'));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTestData() {
  console.log('🔍 Checking test data for Booking Engine tests...\n');

  // Check tenants - prioritize Beauty Spa for testing
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name')
    .or('name.ilike.%Beauty Spa%,name.ilike.%Demo%')
    .limit(5);

  if (tenantsError) {
    console.error('❌ Tenants query failed:', tenantsError.message);
    return false;
  }

  if (!tenants || tenants.length === 0) {
    console.error('❌ No Beauty Spa or Demo tenants found!');
    return false;
  }

  // Prefer Beauty Spa tenant
  const beautySpa = tenants.find(t => t.name.toLowerCase().includes('beauty'));
  const testTenant = beautySpa || tenants[0];
  const testTenantId = testTenant.id;
  
  console.log(`✅ Tenants: ${tenants.length} found`);
  console.log(`   Using tenant: ${testTenant.name} (${testTenantId})\n`);

  // Check customers
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, phone, name_mother')
    .eq('tenant_id', testTenantId)
    .limit(1);

  if (customersError) {
    console.error('❌ Customers query failed:', customersError.message);
    return false;
  }

  if (!customers || customers.length === 0) {
    console.error('❌ No customers found!');
    console.log('   Solution: Create a customer or use demo data\n');
    return false;
  }

  console.log(`✅ Customers: ${customers.length} found`);
  console.log(`   Using customer: ${customers[0].name_mother} (${customers[0].phone})\n`);

  // Check packages
  const { data: packages, error: packagesError } = await supabase
    .from('packages')
    .select('id, name')
    .eq('tenant_id', testTenantId)
    .limit(1);

  if (packagesError) {
    console.error('❌ Packages query failed:', packagesError.message);
    return false;
  }

  if (!packages || packages.length === 0) {
    console.error('❌ No packages found!');
    return false;
  }

  console.log(`✅ Packages: ${packages.length} found`);
  console.log(`   Using package: ${packages[0].name}\n`);

  // Check bookings
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, booking_number, status')
    .eq('tenant_id', testTenantId)
    .limit(1);

  if (bookingsError) {
    console.error('❌ Bookings query failed:', bookingsError.message);
    return false;
  }

  if (!bookings || bookings.length === 0) {
    console.error('❌ No bookings found!');
    return false;
  }

  console.log(`✅ Bookings: ${bookings.length} found`);
  console.log(`   Using booking: ${bookings[0].booking_number} (${bookings[0].status})\n`);

  // Check KTV users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('tenant_id', testTenantId)
    .eq('role', 'ktv')
    .limit(1);

  if (usersError) {
    console.error('❌ Users query failed:', usersError.message);
    return false;
  }

  if (!users || users.length === 0) {
    console.error('❌ No KTV users found!');
    console.log('   Solution: Create a user with role="ktv"\n');
    return false;
  }

  console.log(`✅ Users (KTV): ${users.length} found`);
  console.log(`   Using KTV: ${users[0].full_name}\n`);

  // Check new tables
  console.log('🔍 Checking Booking Engine tables...\n');

  const tables = ['waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events'];
  let allTablesExist = true;

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    
    if (error) {
      console.error(`❌ Table "${table}" not found or not accessible`);
      console.error(`   Error: ${error.message}`);
      allTablesExist = false;
    } else {
      console.log(`✅ Table "${table}" exists and accessible`);
    }
  }

  console.log('\n');

  if (!allTablesExist) {
    console.error('⚠️  Some tables missing. Run migration first:');
    console.error('   supabase/migrations/20260709140002_booking_engine_schema_v3_final.sql\n');
    return false;
  }

  // All checks passed
  console.log('✅ ALL PREREQUISITES MET!\n');
  console.log('You can now run tests:');
  console.log('  npm run test:booking-engine\n');
  
  return true;
}

checkTestData()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
