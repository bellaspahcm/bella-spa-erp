/**
 * Check tenant UUIDs in runtime_tenant_registry
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceKey);

async function checkTenantUUIDs() {
  console.log('🔍 Checking tenant UUIDs in runtime_tenant_registry...\n');

  const testTenantNames = [
    'test-e2e-tenant-a',
    'test-e2e-tenant-b',
    'test-e2e-tenant-attacker',
  ];

  for (const name of testTenantNames) {
    const { data, error } = await client
      .from('runtime_tenant_registry')
      .select('id, tenant_name')
      .eq('tenant_name', name)
      .single();

    if (error) {
      console.log(`❌ Tenant "${name}": NOT FOUND`);
      console.log(`   Error: ${error.message}`);
    } else if (data) {
      console.log(`✅ Tenant "${name}"`);
      console.log(`   UUID: ${data.id}`);
    }
    console.log('');
  }

  // Also check tenants table
  console.log('=== Checking public.tenants table ===\n');
  for (const name of testTenantNames) {
    const { data, error } = await client
      .from('tenants')
      .select('id, name')
      .eq('name', name)
      .single();

    if (error) {
      console.log(`❌ Tenant "${name}": NOT FOUND in public.tenants`);
    } else if (data) {
      console.log(`✅ Tenant "${name}" in public.tenants`);
      console.log(`   UUID: ${data.id}`);
    }
    console.log('');
  }
}

checkTenantUUIDs().catch(console.error);
