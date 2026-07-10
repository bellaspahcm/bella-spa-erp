/**
 * Seed test data for Beauty Spa tenant (demo environment)
 * Run: node scripts/seed-beauty-spa-test-data.mjs
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedBeautySpaTestData() {
  console.log('🌱 Seeding test data for Beauty Spa tenant...\n');

  // Find Beauty Spa tenant
  const { data: beautySpa, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .ilike('name', '%beauty%spa%')
    .limit(1)
    .single();

  if (tenantError || !beautySpa) {
    console.error('❌ Beauty Spa tenant not found!');
    console.error('   Error:', tenantError?.message);
    console.log('\n💡 Available tenants:');
    const { data: allTenants } = await supabase.from('tenants').select('name');
    allTenants?.forEach(t => console.log(`   - ${t.name}`));
    process.exit(1);
  }

  console.log(`✅ Found Beauty Spa: ${beautySpa.name}`);
  console.log(`   Tenant ID: ${beautySpa.id}\n`);

  const tenantId = beautySpa.id;

  // Check if test customer already exists
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id, phone, name_mother')
    .eq('tenant_id', tenantId)
    .eq('phone', '+84999000001')
    .single();

  if (existingCustomer) {
    console.log('ℹ️  Test customer already exists:');
    console.log(`   Name: ${existingCustomer.name_mother}`);
    console.log(`   Phone: ${existingCustomer.phone}`);
    console.log(`   ID: ${existingCustomer.id}\n`);
  } else {
    // Create test customer
    console.log('👤 Creating test customer...');
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        phone: '+84999000001',
        name_mother: 'Test Beauty Customer',
        status: 'active',
      })
      .select()
      .single();

    if (customerError) {
      console.error('❌ Failed to create customer:', customerError.message);
      process.exit(1);
    }

    console.log(`✅ Created customer: ${newCustomer.name_mother}`);
    console.log(`   Phone: ${newCustomer.phone}`);
    console.log(`   ID: ${newCustomer.id}\n`);
  }

  // Check if package exists
  const { data: existingPackage } = await supabase
    .from('packages')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (existingPackage) {
    console.log('✅ Package exists:');
    console.log(`   Name: ${existingPackage.name}`);
    console.log(`   ID: ${existingPackage.id}\n`);
  } else {
    // Create test package
    console.log('📦 Creating test package...');
    const { data: newPackage, error: packageError } = await supabase
      .from('packages')
      .insert({
        tenant_id: tenantId,
        name: 'Test Beauty Package',
        price: 1000000,
        sessions: 10,
        status: 'active',
      })
      .select()
      .single();

    if (packageError) {
      console.error('❌ Failed to create package:', packageError.message);
      process.exit(1);
    }

    console.log(`✅ Created package: ${newPackage.name}`);
    console.log(`   Price: ${newPackage.price}`);
    console.log(`   ID: ${newPackage.id}\n`);
  }

  // Check if KTV user exists
  const { data: existingKtv } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('tenant_id', tenantId)
    .eq('role', 'ktv')
    .limit(1)
    .single();

  if (existingKtv) {
    console.log('✅ KTV user exists:');
    console.log(`   Name: ${existingKtv.full_name}`);
    console.log(`   Role: ${existingKtv.role}`);
    console.log(`   ID: ${existingKtv.id}\n`);
  } else {
    // Create test KTV user
    console.log('👷 Creating test KTV user...');
    const { data: newKtv, error: ktvError } = await supabase
      .from('users')
      .insert({
        tenant_id: tenantId,
        email: 'test-ktv-beauty@test.com',
        full_name: 'Test Beauty KTV',
        role: 'ktv',
        status: 'active',
      })
      .select()
      .single();

    if (ktvError) {
      console.error('❌ Failed to create KTV:', ktvError.message);
      process.exit(1);
    }

    console.log(`✅ Created KTV: ${newKtv.full_name}`);
    console.log(`   Email: ${newKtv.email}`);
    console.log(`   ID: ${newKtv.id}\n`);
  }

  // Check if booking exists
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, booking_number, status')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (existingBooking) {
    console.log('✅ Booking exists:');
    console.log(`   Number: ${existingBooking.booking_number}`);
    console.log(`   Status: ${existingBooking.status}`);
    console.log(`   ID: ${existingBooking.id}\n`);
  } else {
    console.log('⚠️  No bookings found (optional for tests)\n');
  }

  // Final summary
  console.log('✅ SEEDING COMPLETE!\n');
  console.log('Test data ready for Beauty Spa tenant.');
  console.log('You can now run tests:');
  console.log('  npm run test:booking-engine\n');
}

seedBeautySpaTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
