/**
 * List all users in the system
 * Usage: npx tsx scripts/list-users.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('🔍 Listing all users...\n');

  const { data: authUsers, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Failed to list users:', error.message);
    process.exit(1);
  }

  if (authUsers.users.length === 0) {
    console.log('❌ No users found in system');
    process.exit(0);
  }

  console.log(`📋 Found ${authUsers.users.length} user(s):\n`);

  for (const user of authUsers.users) {
    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, tenant_id')
      .eq('id', user.id)
      .single();

    // Get tenant name
    let tenantName = 'No tenant';
    if (profile?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', profile.tenant_id)
        .single();
      tenantName = tenant?.name || 'Unknown tenant';
    }

    console.log(`   📧 ${user.email || 'No email'}`);
    console.log(`      ID: ${user.id}`);
    console.log(`      Name: ${profile?.full_name || 'N/A'}`);
    console.log(`      Tenant: ${tenantName}`);
    console.log('');
  }

  // Check if bella_auto_stress tenant exists
  const { data: bellaAutoTenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('name', 'bella_auto_stress')
    .single();

  if (bellaAutoTenant) {
    console.log('✅ Target tenant "bella_auto_stress" exists');
    console.log(`   ID: ${bellaAutoTenant.id}\n`);

    // Check vehicle count
    const { count } = await supabase
      .from('auto_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', bellaAutoTenant.id);

    console.log(`   Vehicles: ${count || 0}`);
  } else {
    console.log('⚠️  Target tenant "bella_auto_stress" NOT found');
    console.log('   Run: npx tsx scripts/seed-bella-auto-stress-test.ts\n');
  }

  console.log('💡 To assign user, run:');
  console.log('   npx tsx scripts/assign-user-to-bella-auto-tenant.ts YOUR_EMAIL');
}

main();
