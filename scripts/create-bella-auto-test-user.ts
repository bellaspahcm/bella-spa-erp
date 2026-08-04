#!/usr/bin/env tsx
/**
 * Create Bella Auto Test User
 * Email: auto.test@bellaspa.vn
 * Password: BellaAuto2026!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const TEST_EMAIL = 'auto.test@bellaspa.vn';
const TEST_PASSWORD = 'BellaAuto2026!';
const PILOT_TENANT_ID = '60b2af9f-82b0-44d3-b0ff-1beabd65258e';

async function main() {
  console.log('🚗 Creating Bella Auto Test User\n');
  
  // 1. Check if user already exists
  console.log('🔍 Step 1: Check existing user');
  
  const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
  const existingUser = existingAuthUser?.users.find(u => u.email === TEST_EMAIL);
  
  if (existingUser) {
    console.log(`✅ User already exists: ${TEST_EMAIL}`);
    console.log(`   Auth ID: ${existingUser.id}`);
    console.log(`   Created: ${new Date(existingUser.created_at!).toLocaleDateString('vi-VN')}`);
    
    // Check if already in users table
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, tenant_id, role, full_name')
      .eq('id', existingUser.id)
      .single();
    
    if (dbUser) {
      console.log(`   Tenant: ${dbUser.tenant_id}`);
      console.log(`   Role: ${dbUser.role}`);
      console.log(`   Name: ${dbUser.full_name}`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BELLA AUTO TEST USER CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📧 Email:    ${TEST_EMAIL}`);
    console.log(`🔑 Password: ${TEST_PASSWORD}`);
    console.log(`🆔 User ID:  ${existingUser.id}`);
    console.log(`🏢 Tenant:   ${dbUser?.tenant_id || 'Not set'}`);
    console.log(`\n🌐 Login:    https://bella-spa-erp.vercel.app/login`);
    console.log(`🚗 Dashboard: https://bella-spa-erp.vercel.app/dashboard/bella-auto\n`);
    
    return;
  }
  
  // 2. Create auth user
  console.log('👤 Step 2: Create Supabase Auth user');
  
  const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Bella Auto Test User',
    }
  });
  
  if (authError || !newAuthUser.user) {
    console.error('❌ Failed to create auth user:', authError);
    process.exit(1);
  }
  
  console.log(`✅ Created auth user: ${newAuthUser.user.id}`);
  
  // 3. Create users table entry
  console.log('\n📋 Step 3: Create users table entry');
  
  const { data: newDbUser, error: dbError } = await supabase
    .from('users')
    .insert({
      id: newAuthUser.user.id,
      email: TEST_EMAIL,
      full_name: 'Bella Auto Test User',
      tenant_id: PILOT_TENANT_ID,
      role: 'admin',
    })
    .select()
    .single();
  
  if (dbError) {
    console.error('❌ Failed to create users entry:', dbError);
    
    // Cleanup auth user
    await supabase.auth.admin.deleteUser(newAuthUser.user.id);
    console.log('🗑️  Rolled back auth user creation');
    process.exit(1);
  }
  
  console.log(`✅ Created users entry with admin role`);
  
  // 4. Verify tenant access
  console.log('\n🏢 Step 4: Verify tenant access');
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, enabled_modules, metadata')
    .eq('id', PILOT_TENANT_ID)
    .single();
  
  if (tenant) {
    console.log(`✅ Tenant: ${tenant.name}`);
    console.log(`   Modules: ${JSON.stringify(tenant.enabled_modules)}`);
    console.log(`   Capabilities: ${JSON.stringify(tenant.metadata?.bella_auto_capabilities || [])}`);
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ BELLA AUTO TEST USER CREATED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📧 Email:    ${TEST_EMAIL}`);
  console.log(`🔑 Password: ${TEST_PASSWORD}`);
  console.log(`🆔 User ID:  ${newAuthUser.user.id}`);
  console.log(`🏢 Tenant:   ${PILOT_TENANT_ID}`);
  console.log(`👑 Role:     admin`);
  console.log(`\n🌐 Login:    https://bella-spa-erp.vercel.app/login`);
  console.log(`🚗 Dashboard: https://bella-spa-erp.vercel.app/dashboard/bella-auto`);
  console.log(`\n🧪 Test with:`);
  console.log(`   1. Login with credentials above`);
  console.log(`   2. Navigate to Bella Auto dashboard`);
  console.log(`   3. Test temporal query (5 years ago)`);
  console.log(`   4. Test VIN search & filters\n`);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
