/**
 * Assign current user to Bella Auto Stress tenant
 * Run after seed-bella-auto-stress-test.ts
 * 
 * Usage: npx tsx scripts/assign-user-to-bella-auto-tenant.ts YOUR_EMAIL
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TENANT_NAME = 'bella_auto_stress';

async function main() {
  const userEmail = process.argv[2];
  
  if (!userEmail) {
    console.error('❌ Usage: npx tsx scripts/assign-user-to-bella-auto-tenant.ts YOUR_EMAIL');
    console.error('   Example: npx tsx scripts/assign-user-to-bella-auto-tenant.ts admin@example.com');
    process.exit(1);
  }

  console.log('🔍 Finding tenant and user...\n');

  // Find tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('name', TENANT_NAME)
    .single();

  if (tenantError || !tenant) {
    console.error(`❌ Tenant "${TENANT_NAME}" not found. Run seed-bella-auto-stress-test.ts first.`);
    process.exit(1);
  }

  console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})`);

  // Find user by email
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Failed to list users:', authError.message);
    process.exit(1);
  }

  const authUser = authUsers.users.find(u => u.email === userEmail);

  if (!authUser) {
    console.error(`❌ User with email "${userEmail}" not found`);
    console.log('\n📋 Available users:');
    authUsers.users.forEach(u => console.log(`   - ${u.email} (${u.id})`));
    process.exit(1);
  }

  console.log(`✅ Found auth user: ${authUser.email} (${authUser.id})`);

  // Check if user profile exists
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id, tenant_id, full_name')
    .eq('id', authUser.id)
    .single();

  if (existingProfile) {
    console.log(`\n📝 Updating existing user profile...`);
    console.log(`   Old tenant_id: ${existingProfile.tenant_id}`);
    console.log(`   New tenant_id: ${tenant.id}`);

    const { error: updateError } = await supabase
      .from('users')
      .update({ tenant_id: tenant.id })
      .eq('id', authUser.id);

    if (updateError) {
      console.error('❌ Failed to update user:', updateError.message);
      process.exit(1);
    }

    console.log(`✅ User profile updated successfully!`);
  } else {
    console.log(`\n📝 Creating new user profile...`);

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        tenant_id: tenant.id,
        full_name: authUser.email?.split('@')[0] || 'Admin',
        role: 'admin',
        status: 'active',
      });

    if (insertError) {
      console.error('❌ Failed to create user profile:', insertError.message);
      process.exit(1);
    }

    console.log(`✅ User profile created successfully!`);
  }

  console.log('\n🎉 Done! You can now login and see Bella Auto data.');
  console.log(`   Email: ${userEmail}`);
  console.log(`   Tenant: ${tenant.name}`);
  console.log(`   Dashboard: /dashboard/bella-auto`);
}

main();
