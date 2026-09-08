import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRetailDataDistribution() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 RETAIL DATA DISTRIBUTION AUDIT\n');

  const tables = [
    'retail_products',
    'retail_inventory_movements',
    'retail_product_variants',
    'retail_product_batches'
  ];

  for (const table of tables) {
    console.log(`\n━━━ ${table.toUpperCase()} ━━━\n`);
    
    const { data: rows, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' });

    if (error) {
      console.log(`❌ Error querying ${table}:`, error.message);
      continue;
    }

    console.log(`Total rows: ${count || rows?.length || 0}`);

    if (!rows || rows.length === 0) {
      console.log('✅ Table is EMPTY');
      continue;
    }

    // Group by tenant
    const byTenant: Record<string, number> = {};
    rows.forEach((row: any) => {
      const tid = row.tenant_id || 'NULL';
      byTenant[tid] = (byTenant[tid] || 0) + 1;
    });

    console.log('\nData by tenant:');
    Object.entries(byTenant).forEach(([tid, count]) => {
      console.log(`  ${tid}: ${count} rows`);
    });

    // Show sample data for each tenant
    console.log('\nSample data (first 3 rows):');
    const sample = rows.slice(0, 3);
    console.table(sample.map((r: any) => ({
      tenant_id: r.tenant_id?.substring(0, 8) + '...',
      id: r.id?.substring(0, 8) + '...',
      sku: r.sku || r.batch_number || 'N/A',
      created_at: r.created_at?.substring(0, 10)
    })));
  }

  // Check if Bella Spa Headquarter tenant has retail data
  console.log('\n━━━ BELLA SPA HEADQUARTER CHECK ━━━\n');
  const bellaSpaTenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', bellaSpaTenantId);

    if (!error && data && data.length > 0) {
      console.log(`⚠️  ${table}: ${data.length} rows in Bella Spa Headquarter tenant`);
      console.table(data.slice(0, 3));
    } else {
      console.log(`✅ ${table}: No data in Bella Spa Headquarter tenant`);
    }
  }

  // Check test tenant
  console.log('\n━━━ TEST TENANT CHECK ━━━\n');
  const testTenantId = '00000000-0000-0000-0000-000000000001';

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', testTenantId);

    if (!error && data && data.length > 0) {
      console.log(`📊 ${table}: ${data.length} rows in test tenant`);
    } else {
      console.log(`✅ ${table}: No data in test tenant (expected)`);
    }
  }
}

checkRetailDataDistribution().catch(console.error);
