/**
 * Setup booking_resources table via Supabase client
 * Run: node scripts/setup-booking-resources.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupBookingResources() {
  console.log('🚀 Setting up booking_resources table...\n');

  try {
    // Step 1: Test what resource_type values are allowed
    console.log('1️⃣ Testing resource_type constraint...');
    
    const testTypes = ['bed', 'giuong', 'phong', 'room', 'equipment', 'may'];
    let workingType = null;
    
    for (const type of testTypes) {
      const { error } = await supabase
        .from('booking_resources')
        .insert({
          tenant_id: '11111111-1111-1111-1111-111111111111',
          name: `__test_${type}__`,
          resource_type: type,
          status: 'available'
        });

      if (!error) {
        workingType = type;
        console.log(`   ✅ Found working type: '${type}'`);
        
        // Clean up
        await supabase
          .from('booking_resources')
          .delete()
          .eq('name', `__test_${type}__`);
        
        break;
      } else {
        console.log(`   ❌ '${type}': ${error.details || error.message}`);
      }
    }

    if (!workingType) {
      throw new Error('Could not find valid resource_type value. Check database constraints.');
    }

    // Step 2: Clear existing test data
    console.log('\n2️⃣ Clearing existing test data...');
    const { error: deleteError } = await supabase
      .from('booking_resources')
      .delete()
      .eq('tenant_id', '11111111-1111-1111-1111-111111111111');

    if (deleteError && deleteError.code !== 'PGRST116') {
      console.error('   ❌ Failed to delete:', deleteError.message);
    } else {
      console.log('   ✅ Cleared');
    }

    // Step 3: Map Vietnamese to working values
    console.log('\n3️⃣ Inserting seed data with working constraint values...');
    
    // Determine type mapping based on what worked
    const typeMap = {
      'bed': workingType === 'bed' ? 'bed' : (workingType === 'giuong' ? 'giuong' : workingType),
      'room': workingType === 'room' ? 'room' : (workingType === 'phong' ? 'phong' : workingType),
      'equipment': workingType === 'equipment' ? 'equipment' : (workingType === 'may' ? 'may' : workingType)
    };

    const resources = [
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Giường 1', resource_type: typeMap.bed, status: 'available', location_note: 'Phòng VIP 1' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Giường 2', resource_type: typeMap.bed, status: 'available', location_note: 'Phòng VIP 1' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Giường 3', resource_type: typeMap.bed, status: 'available', location_note: 'Phòng VIP 2' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Giường 4', resource_type: typeMap.bed, status: 'available', location_note: 'Phòng VIP 2' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Giường 5', resource_type: typeMap.bed, status: 'available', location_note: 'Phòng Thường' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Giường 6', resource_type: typeMap.bed, status: 'available', location_note: 'Phòng Thường' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Phòng Massage 1', resource_type: typeMap.room, status: 'available', location_note: 'Tầng 2' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Phòng Massage 2', resource_type: typeMap.room, status: 'available', location_note: 'Tầng 2' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Máy Triệt Lông 1', resource_type: typeMap.equipment, status: 'available', location_note: 'Phòng Laser' },
      { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Máy Triệt Lông 2', resource_type: typeMap.equipment, status: 'available', location_note: 'Phòng Laser' },
    ];

    const { data: inserted, error: insertError } = await supabase
      .from('booking_resources')
      .insert(resources)
      .select();

    if (insertError) {
      console.error('   ❌ Failed to insert:', insertError.message);
      throw insertError;
    }

    console.log(`   ✅ Inserted ${inserted.length} resources`);

    // Step 4: Verify
    console.log('\n4️⃣ Verifying...');
    const { data: allResources, error: verifyError } = await supabase
      .from('booking_resources')
      .select('*')
      .eq('tenant_id', '11111111-1111-1111-1111-111111111111')
      .order('resource_type')
      .order('name');

    if (verifyError) {
      console.error('   ❌ Failed to verify:', verifyError.message);
      throw verifyError;
    }

    console.log('   ✅ Verification successful!\n');
    console.log('📊 Resources created:');
    console.table(allResources.map(r => ({
      Name: r.name,
      Type: r.resource_type,
      Status: r.status,
      Location: r.location_note
    })));

    console.log('\n✅ Setup complete! Booking resources are ready to use.');
    console.log('💡 Refresh your Bookings page to see the resource dropdown.');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupBookingResources();
