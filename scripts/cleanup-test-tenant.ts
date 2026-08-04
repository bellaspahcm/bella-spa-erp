import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanup() {
  const tenantId = '6fbf594f-0da9-44be-9269-d24e42bcf50a';
  
  console.log('🗑️  Deleting existing test data for tenant:', tenantId);
  
  // Delete in reverse order (foreign keys)
  console.log('  Deleting touchpoints...');
  await supabase.from('auto_touchpoints').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting journey events...');
  await supabase.from('auto_journey_events').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting customer journeys...');
  await supabase.from('auto_customer_journeys').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting customers...');
  await supabase.from('customers').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting vehicles...');
  await supabase.from('auto_vehicles').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting variants...');
  await supabase.from('auto_variants').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting models...');
  await supabase.from('auto_models').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting brands...');
  await supabase.from('auto_brands').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting journey stages...');
  await supabase.from('auto_journey_stages').delete().eq('tenant_id', tenantId);
  
  console.log('  Deleting tenant...');
  await supabase.from('tenants').delete().eq('id', tenantId);
  
  console.log('✅ Cleanup complete - ready for fresh 50K seed');
}

cleanup();
