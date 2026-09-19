/**
 * Ensure Haircut Shop test user exists in E2E database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const HAIRCUT_TENANT_ID = '743d7f1e-403f-4817-aaf2-3b5acf540154';
const HAIRCUT_USER_EMAIL = 'admin@haircutshop.test';
const HAIRCUT_USER_NAME = 'Haircut Shop Admin';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('🔍 Checking for Haircut Shop user...\n');

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, full_name, tenant_id')
    .eq('email', HAIRCUT_USER_EMAIL)
    .single();

  if (existingUser) {
    console.log('✅ User already exists:');
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Name: ${existingUser.full_name}`);
    console.log(`   Tenant ID: ${existingUser.tenant_id}`);
    
    if (existingUser.tenant_id !== HAIRCUT_TENANT_ID) {
      console.log('\n⚠️  WARNING: User tenant_id does not match Haircut tenant!');
      console.log(`   Expected: ${HAIRCUT_TENANT_ID}`);
      console.log(`   Actual: ${existingUser.tenant_id}`);
    }
    
    return;
  }

  console.log('ℹ️  User does not exist. Creating...\n');

  // Create user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      email: HAIRCUT_USER_EMAIL,
      full_name: HAIRCUT_USER_NAME,
      role: 'admin',
      status: 'active',
      tenant_id: HAIRCUT_TENANT_ID,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }

  console.log('✅ User created successfully:');
  console.log(`   ID: ${newUser.id}`);
  console.log(`   Email: ${newUser.email}`);
  console.log(`   Name: ${newUser.full_name}`);
  console.log(`   Tenant ID: ${newUser.tenant_id}`);
  console.log('\n📝 Note: Password authentication is handled by Supabase Auth');
  console.log('   For E2E tests, use mock_user_email cookie instead');
}

main().catch(console.error);
