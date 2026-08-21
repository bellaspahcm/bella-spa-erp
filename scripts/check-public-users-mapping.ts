/**
 * RCA #5: Check if test users exist in public.users with tenant_id
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceKey);

async function checkPublicUsersMapping() {
  console.log('🔍 RCA #5: Checking public.users tenant mapping...\n');

  const testUserIds = [
    '1176579a-50cc-48b2-800f-5bd5f24d6288', // Tenant A
    '40ef93da-3381-4b16-a30e-eed7072bce72', // Tenant B
    '73a1837f-4970-4c27-939f-ef7a4ee864ed', // Attacker
  ];

  console.log('=== Test User IDs ===');
  testUserIds.forEach((id, i) => {
    const label = ['Tenant A', 'Tenant B', 'Attacker'][i];
    console.log(`${label}: ${id}`);
  });

  console.log('\n=== Checking public.users table ===');
  
  for (const userId of testUserIds) {
    const { data, error } = await client
      .from('users')
      .select('id, email, tenant_id, full_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.log(`❌ User ${userId}: NOT FOUND in public.users`);
      console.log(`   Error: ${error.message}`);
    } else if (data) {
      console.log(`✅ User ${userId}:`);
      console.log(`   Email: ${data.email || 'N/A'}`);
      console.log(`   Tenant ID: ${data.tenant_id || '❌ NULL'}`);
      console.log(`   Full Name: ${data.full_name || 'N/A'}`);
    }
    console.log('');
  }

  console.log('=== Analysis ===');
  console.log('get_auth_tenant_id() queries: SELECT tenant_id FROM public.users WHERE id = auth.uid()');
  console.log('If user NOT in public.users → tenant_id = NULL');
  console.log('If user IN public.users but tenant_id IS NULL → tenant_id = NULL');
  console.log('\nTest users created in auth.users but may not exist in public.users');
}

checkPublicUsersMapping().catch(console.error);
