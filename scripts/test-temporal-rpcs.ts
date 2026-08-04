import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testTemporalRPCs() {
  const tenantId = '20fed1f5-6bcb-465e-9e90-5442d3b3e9e6';
  
  console.log('🧪 Testing Phase 12 Temporal RPCs\n');
  console.log('='.repeat(60));
  
  // Test 1: Get current inventory
  console.log('\n📊 Test 1: get_temporal_vehicle_inventory (current time)');
  const start1 = Date.now();
  const { data: current, error: err1 } = await supabase.rpc('get_temporal_vehicle_inventory', {
    p_tenant_id: tenantId,
    p_as_of_time: new Date().toISOString(),
  });
  const duration1 = Date.now() - start1;
  
  if (err1) {
    console.log(`❌ FAIL (${duration1}ms): ${err1.message}`);
  } else {
    console.log(`✅ PASS (${duration1}ms): Retrieved ${current?.length || 0} vehicles`);
  }
  
  // Test 2: Get inventory from 1 year ago
  console.log('\n📊 Test 2: get_temporal_vehicle_inventory (1 year ago)');
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const start2 = Date.now();
  const { data: historical, error: err2 } = await supabase.rpc('get_temporal_vehicle_inventory', {
    p_tenant_id: tenantId,
    p_as_of_time: oneYearAgo.toISOString(),
  });
  const duration2 = Date.now() - start2;
  
  if (err2) {
    console.log(`❌ FAIL (${duration2}ms): ${err2.message}`);
  } else {
    console.log(`✅ PASS (${duration2}ms): Retrieved ${historical?.length || 0} vehicles from ${oneYearAgo.toISOString().split('T')[0]}`);
  }
  
  // Test 3: Get inventory from 5 years ago
  console.log('\n📊 Test 3: get_temporal_vehicle_inventory (5 years ago)');
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const start3 = Date.now();
  const { data: ancient, error: err3 } = await supabase.rpc('get_temporal_vehicle_inventory', {
    p_tenant_id: tenantId,
    p_as_of_time: fiveYearsAgo.toISOString(),
  });
  const duration3 = Date.now() - start3;
  
  if (err3) {
    console.log(`❌ FAIL (${duration3}ms): ${err3.message}`);
  } else {
    console.log(`✅ PASS (${duration3}ms): Retrieved ${ancient?.length || 0} vehicles from ${fiveYearsAgo.toISOString().split('T')[0]}`);
  }
  
  // Test 4: Get vehicle status history (if we have a vehicle ID)
  if (current && current.length > 0) {
    const vehicleId = current[0].id;
    console.log(`\n📊 Test 4: get_vehicle_status_history (vehicle: ${vehicleId})`);
    const start4 = Date.now();
    const { data: history, error: err4 } = await supabase.rpc('get_vehicle_status_history', {
      p_tenant_id: tenantId,
      p_vehicle_id: vehicleId,
      p_start_time: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_time: new Date().toISOString(),
    });
    const duration4 = Date.now() - start4;
    
    if (err4) {
      console.log(`❌ FAIL (${duration4}ms): ${err4.message}`);
    } else {
      console.log(`✅ PASS (${duration4}ms): Retrieved ${history?.length || 0} status changes (last 90 days)`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Temporal RPC testing complete!\n');
}

testTemporalRPCs();
