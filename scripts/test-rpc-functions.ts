/**
 * Test Bella Auto RPC functions directly
 * Usage: npx tsx scripts/test-rpc-functions.ts TENANT_ID
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testRPCs(tenantId: string) {
  console.log(`🧪 Testing Bella Auto RPCs for tenant: ${tenantId}\n`);

  // Test 1: Inventory Trend
  console.log('1️⃣ Testing get_auto_inventory_trend...');
  const trend = await supabase.rpc('get_auto_inventory_trend', {
    p_tenant_id: tenantId
  });
  console.log('   Status:', trend.error ? '❌ ERROR' : '✅ SUCCESS');
  if (trend.error) {
    console.log('   Error:', JSON.stringify(trend.error, null, 2));
  } else {
    console.log('   Data rows:', trend.data?.length || 0);
    if (trend.data && trend.data.length > 0) {
      console.log('   Sample:', trend.data[0]);
    }
  }
  console.log('');

  // Test 2: Top Models
  console.log('2️⃣ Testing get_auto_top_models...');
  const topModels = await supabase.rpc('get_auto_top_models', {
    p_tenant_id: tenantId,
    p_limit: 5
  });
  console.log('   Status:', topModels.error ? '❌ ERROR' : '✅ SUCCESS');
  if (topModels.error) {
    console.log('   Error:', JSON.stringify(topModels.error, null, 2));
  } else {
    console.log('   Data rows:', topModels.data?.length || 0);
    if (topModels.data && topModels.data.length > 0) {
      console.log('   Sample:', topModels.data[0]);
    }
  }
  console.log('');

  // Test 3: Revenue by Month
  console.log('3️⃣ Testing get_auto_revenue_by_month...');
  const revenue = await supabase.rpc('get_auto_revenue_by_month', {
    p_tenant_id: tenantId
  });
  console.log('   Status:', revenue.error ? '❌ ERROR' : '✅ SUCCESS');
  if (revenue.error) {
    console.log('   Error:', JSON.stringify(revenue.error, null, 2));
  } else {
    console.log('   Data rows:', revenue.data?.length || 0);
    if (revenue.data && revenue.data.length > 0) {
      console.log('   Sample:', revenue.data[0]);
    }
  }
  console.log('');

  // Test 4: Weekly Deliveries
  console.log('4️⃣ Testing get_auto_weekly_deliveries...');
  const deliveries = await supabase.rpc('get_auto_weekly_deliveries', {
    p_tenant_id: tenantId
  });
  console.log('   Status:', deliveries.error ? '❌ ERROR' : '✅ SUCCESS');
  if (deliveries.error) {
    console.log('   Error:', JSON.stringify(deliveries.error, null, 2));
  } else {
    console.log('   Data rows:', deliveries.data?.length || 0);
    if (deliveries.data && deliveries.data.length > 0) {
      console.log('   Sample:', deliveries.data[0]);
    }
  }
  console.log('');

  // Summary
  console.log('📊 Summary:');
  const results = [trend, topModels, revenue, deliveries];
  const successCount = results.filter(r => !r.error).length;
  console.log(`   ${successCount}/4 RPCs working`);

  if (successCount === 4) {
    console.log('\n✅ All RPCs working! Dashboard should display data.');
  } else {
    console.log('\n❌ Some RPCs failed. Check errors above.');
  }
}

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    // Find bella_auto_stress tenant automatically
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'bella_auto_stress')
      .single();

    if (!tenant) {
      console.error('❌ Usage: npx tsx scripts/test-rpc-functions.ts TENANT_ID');
      console.error('   Or run seed script first to create bella_auto_stress tenant');
      process.exit(1);
    }

    console.log(`✅ Auto-detected tenant: bella_auto_stress (${tenant.id})\n`);
    await testRPCs(tenant.id);
  } else {
    await testRPCs(tenantId);
  }
}

main();
