/**
 * Seed Bella Auto Analytics Data (For Charts)
 * Creates realistic dated records for last 6 months
 * Usage: npx tsx scripts/seed-bella-auto-analytics-data.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('📊 Seeding Bella Auto Analytics Data...\n');

  // Find tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', 'bella_auto_stress')
    .single();

  if (tenantError || !tenant) {
    console.error('❌ Tenant bella_auto_stress not found');
    process.exit(1);
  }

  const tenantId = tenant.id;
  console.log(`✅ Found tenant: ${tenantId}\n`);

  // Get existing variants
  const { data: variants } = await supabase
    .from('auto_variants')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(20);

  if (!variants || variants.length === 0) {
    console.error('❌ No variants found. Run seed-bella-auto-stress-test.ts first');
    process.exit(1);
  }

  const variantIds = variants.map(v => v.id);
  console.log(`✅ Using ${variantIds.length} variants\n`);

  // Loop through last 6 months
  let totalCreated = 0;

  for (let monthOffset = 0; monthOffset <= 5; monthOffset++) {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - monthOffset);
    targetDate.setDate(1);
    targetDate.setHours(0, 0, 0, 0);

    const vehiclesToCreate = 100 + (monthOffset * 20); // More in recent months
    const vehiclesToDeliver = 50 + (monthOffset * 10);

    console.log(`📅 Month ${6 - monthOffset} (${targetDate.toISOString().substring(0, 7)}):`);
    console.log(`   Creating ${vehiclesToCreate} vehicles (${vehiclesToDeliver} delivered)`);

    const vehicles = [];
    for (let i = 1; i <= vehiclesToCreate; i++) {
      const createdAt = new Date(targetDate);
      createdAt.setDate(createdAt.getDate() + (i % 28));

      const updatedAt = new Date(createdAt);
      updatedAt.setDate(updatedAt.getDate() + 1);

      vehicles.push({
        tenant_id: tenantId,
        variant_id: variantIds[i % variantIds.length],
        vin: `AN${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, '0')}${String(i).padStart(9, '0')}`,
        chassis_number: `CH${monthOffset}-${i}`,
        engine_number: `EN${monthOffset}-${i}`,
        color_exterior: ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue'][i % 6],
        color_interior: 'Black',
        model_year: 2024,
        list_price: 500000000 + (i % 10) * 50000000,
        cost_price: 450000000 + (i % 10) * 45000000,
        status: i <= vehiclesToDeliver ? 'delivered' : ['warehouse', 'showroom', 'allocated'][i % 3],
        location_note: 'Analytics seed location',
        created_at: createdAt.toISOString(),
        updated_at: updatedAt.toISOString(),
      });
    }

    // Insert in batches of 500
    const batchSize = 500;
    for (let j = 0; j < vehicles.length; j += batchSize) {
      const batch = vehicles.slice(j, j + batchSize);
      const { error } = await supabase
        .from('auto_vehicles')
        .insert(batch);

      if (error) {
        console.error(`   ❌ Batch ${Math.floor(j / batchSize) + 1} failed:`, error.message);
      } else {
        totalCreated += batch.length;
        console.log(`   ✅ Batch ${Math.floor(j / batchSize) + 1} inserted: ${batch.length} vehicles`);
      }
    }
  }

  console.log(`\n✅ Analytics data created: ${totalCreated} vehicles\n`);

  // Verify results
  console.log('📊 Verification:\n');
  const { data: summary, error: summaryError } = await supabase.rpc('get_auto_inventory_trend', {
    p_tenant_id: tenantId
  });

  if (summaryError) {
    console.error('❌ Verification failed:', summaryError.message);
  } else if (summary) {
    console.log('   Month | Nhập | Xuất | Tồn');
    console.log('   ------|------|------|-----');
    summary.forEach((row: any) => {
      console.log(`   ${row.month.padEnd(5)} | ${String(row.nhap).padStart(4)} | ${String(row.xuat).padStart(4)} | ${String(row.ton).padStart(4)}`);
    });
  }

  console.log('\n🎉 Done! Hard refresh browser (Ctrl+Shift+R) to see charts with data.');
}

main();
