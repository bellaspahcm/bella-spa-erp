#!/usr/bin/env tsx
/**
 * Create Bella Hospital Test User and Seed Clinical Demo Data
 * Email: hospital.test@bellaspa.vn
 * Password: BellaHospital2026!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const TEST_EMAIL = 'hospital.test@bellaspa.vn';
const TEST_PASSWORD = 'BellaHospital2026!';
const HEALTHCARE_TENANT_ID = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d'; // Bella Clinic/Hospital Tenant

async function main() {
  console.log('🏥 Setting up Bella Hospital Test User & Demo Data\n');

  // 1. Ensure Tenant exists with enabled modules
  console.log('🏢 Step 1: Ensure healthcare tenant exists');
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', HEALTHCARE_TENANT_ID)
    .maybeSingle();

  if (!existingTenant) {
    console.log(`   Creating tenant with ID: ${HEALTHCARE_TENANT_ID}`);
    const { error: insertTenantError } = await supabase
      .from('tenants')
      .insert({
        id: HEALTHCARE_TENANT_ID,
        name: 'Bella Dental & General Hospital',
        status: 'active',
        enabled_modules: {
          babycare: false,
          beauty_spa: false,
          bella_healthcare: true,
          hospital_inpatient: true,
        },
      });

    if (insertTenantError) {
      console.error('❌ Failed to create tenant:', insertTenantError);
      process.exit(1);
    }
    console.log('   Tenant created successfully.');
  } else {
    console.log(`   Tenant exists: ${existingTenant.name}`);
    // Ensure modules are correct
    await supabase
      .from('tenants')
      .update({
        enabled_modules: {
          babycare: false,
          beauty_spa: false,
          bella_healthcare: true,
          hospital_inpatient: true,
        },
      })
      .eq('id', HEALTHCARE_TENANT_ID);
  }

  // 2. Check if user already exists in Auth
  console.log('\n🔍 Step 2: Check existing Auth user');
  const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
  const existingUser = existingAuthUser?.users.find(u => u.email === TEST_EMAIL);

  let userId = '';

  if (existingUser) {
    console.log(`   User already exists: ${TEST_EMAIL}`);
    userId = existingUser.id;
  } else {
    console.log('   Creating new auth user...');
    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'Bella Hospital Admin',
      }
    });

    if (authError || !newAuthUser.user) {
      console.error('❌ Failed to create auth user:', authError);
      process.exit(1);
    }
    console.log(`   Created auth user: ${newAuthUser.user.id}`);
    userId = newAuthUser.user.id;
  }

  // 3. Create or update profile in users table
  console.log('\n📋 Step 3: Upsert users table profile');
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!dbUser) {
    const { error: insertUserError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: TEST_EMAIL,
        full_name: 'Bella Hospital Admin',
        tenant_id: HEALTHCARE_TENANT_ID,
        role: 'admin',
        status: 'active',
      });

    if (insertUserError) {
      console.error('❌ Failed to insert user profile:', insertUserError);
      process.exit(1);
    }
    console.log('   Inserted admin user profile.');
  } else {
    await supabase
      .from('users')
      .update({
        role: 'admin',
        tenant_id: HEALTHCARE_TENANT_ID,
        status: 'active',
      })
      .eq('id', userId);
    console.log('   Updated existing admin user profile.');
  }

  // 4. Ensure admin role mapping in user_roles
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({
      user_id: userId,
      role_name: 'admin',
      tenant_id: HEALTHCARE_TENANT_ID,
    }, { onConflict: 'user_id,role_name,tenant_id' });

  if (roleError) {
    console.warn('⚠️ Warning: Failed to upsert user_roles, but continuing...', roleError.message);
  }

  // 5. Seed clinical data using the existing script
  console.log('\n⚙️ Step 4: Seeding clinical datasets (COA, Doctors, Expenses, Journals)');
  try {
    const output = execSync('node scripts/seed-healthcare-demo.mjs', { encoding: 'utf8' });
    console.log(output);
  } catch (seedErr) {
    console.error('❌ Failed to run seed-healthcare-demo.mjs:', seedErr);
    process.exit(1);
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ BELLA HOSPITAL TEST ACCOUNT & SEED COMPLETED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📧 Email:    ${TEST_EMAIL}`);
  console.log(`🔑 Password: ${TEST_PASSWORD}`);
  console.log(`🆔 User ID:  ${userId}`);
  console.log(`🏢 Tenant:   ${HEALTHCARE_TENANT_ID}`);
  console.log(`👑 Role:     admin`);
  console.log(`\n🌐 Login:    https://bella-spa-erp.vercel.app/login`);
  console.log(`🏥 Dashboard: https://bella-spa-erp.vercel.app/dashboard/hospital\n`);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
