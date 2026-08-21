/**
 * Provision E2E test users into public.users with tenant mapping
 * 
 * Purpose: Complete test user setup for Runtime Security Gate
 * Contract: auth.users → public.users → tenant_id mapping
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceKey);

async function provisionTestUsers() {
  console.log('🔧 Provisioning E2E test users into public.users...\n');

  const testUsers = [
    {
      id: '1176579a-50cc-48b2-800f-5bd5f24d6288',
      email: 'test-tenant-a@e2e.bella.test',
      full_name: 'E2E Test User A',
      role: 'admin',
      tenant_id: 'test-e2e-tenant-a',
    },
    {
      id: '40ef93da-3381-4b16-a30e-eed7072bce72',
      email: 'test-tenant-b@e2e.bella.test',
      full_name: 'E2E Test User B',
      role: 'admin',
      tenant_id: 'test-e2e-tenant-b',
    },
    {
      id: '73a1837f-4970-4c27-939f-ef7a4ee864ed',
      email: 'test-attacker@e2e.bella.test',
      full_name: 'E2E Test Attacker',
      role: 'admin',
      tenant_id: 'test-e2e-tenant-attacker',
    },
  ];

  for (const user of testUsers) {
    // Check if exists
    const { data: existing } = await client
      .from('users')
      .select('id, tenant_id')
      .eq('id', user.id)
      .single();

    if (existing) {
      console.log(`✅ User already exists: ${user.email}`);
      console.log(`   Tenant ID: ${existing.tenant_id}`);
    } else {
      const { data, error } = await client
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          tenant_id: user.tenant_id,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating ${user.email}:`, error);
      } else {
        console.log(`✅ Created public.users record: ${user.email}`);
        console.log(`   UUID: ${data.id}`);
        console.log(`   Tenant: ${data.tenant_id}`);
      }
    }
  }

  console.log('\n=== Verification ===');
  for (const user of testUsers) {
    const { data } = await client
      .from('users')
      .select('id, email, tenant_id')
      .eq('id', user.id)
      .single();

    if (data) {
      console.log(`✅ ${data.email}: tenant_id = ${data.tenant_id}`);
    }
  }

  console.log('\n✅ Test user provisioning complete');
}

provisionTestUsers().catch(console.error);
