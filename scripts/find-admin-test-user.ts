#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🔍 Searching for admin test users...\n');
  
  // Search in users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, tenant_id, role, created_at')
    .or('email.ilike.%admin%,email.ilike.%test%,full_name.ilike.%admin%,full_name.ilike.%test%')
    .order('created_at', { ascending: false })
    .limit(20);

  if (usersError) {
    console.error('❌ Error searching users:', usersError);
  } else if (users && users.length > 0) {
    console.log(`✅ Found ${users.length} admin/test users:\n`);
    
    for (const user of users) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📧 Email: ${user.email || 'N/A'}`);
      console.log(`👤 Name:  ${user.full_name || 'N/A'}`);
      console.log(`🆔 ID:    ${user.id}`);
      console.log(`🏢 Tenant: ${user.tenant_id || 'N/A'}`);
      console.log(`🔑 Role:  ${user.role || 'N/A'}`);
      console.log(`📅 Created: ${new Date(user.created_at).toLocaleDateString('vi-VN')}`);
      
      // Get tenant info
      if (user.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name, status, enabled_modules')
          .eq('id', user.tenant_id)
          .single();
        
        if (tenant) {
          console.log(`🏪 Tenant Name: ${tenant.name}`);
          console.log(`📊 Status: ${tenant.status}`);
          console.log(`📦 Modules: ${JSON.stringify(tenant.enabled_modules)}`);
        }
      }
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } else {
    console.log('⚠️  No admin/test users found\n');
  }

  // Search in auth.users
  console.log('🔐 Checking Supabase Auth users...\n');
  
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
  } else if (authData && authData.users) {
    const adminTestAuthUsers = authData.users.filter(u => 
      u.email?.includes('admin') || 
      u.email?.includes('test') ||
      u.user_metadata?.full_name?.toLowerCase().includes('admin') ||
      u.user_metadata?.full_name?.toLowerCase().includes('test')
    );
    
    console.log(`✅ Found ${adminTestAuthUsers.length} admin/test auth users:\n`);
    
    for (const authUser of adminTestAuthUsers.slice(0, 10)) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📧 Email: ${authUser.email}`);
      console.log(`🆔 Auth ID: ${authUser.id}`);
      console.log(`📅 Created: ${new Date(authUser.created_at!).toLocaleDateString('vi-VN')}`);
      console.log(`🔓 Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  // Common test credentials
  console.log('💡 Common test user patterns:\n');
  console.log('  - admin@test.com');
  console.log('  - test@bellaspa.vn');
  console.log('  - admin@bellaspa.vn');
  console.log('  - test@example.com');
  console.log('  - Check .env.local for TEST_USER_EMAIL/PASSWORD\n');
}

main().catch(console.error);
