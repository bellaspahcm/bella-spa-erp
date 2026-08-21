/**
 * Check for existing test users in auth.users
 * 
 * Purpose: Find actual UUIDs for E2E test fixtures
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceKey);

async function checkTestUsers() {
  console.log('🔍 Checking for existing E2E test users...\n');

  // Query auth.users via admin API
  const { data: { users }, error } = await client.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error listing users:', error);
    return;
  }

  console.log(`Found ${users.length} total users\n`);

  // Look for test users
  const testUsers = users.filter(u => 
    u.email?.includes('test') || 
    u.email?.includes('e2e') ||
    u.user_metadata?.test_tenant
  );

  if (testUsers.length > 0) {
    console.log('✅ Test users found:');
    testUsers.forEach(u => {
      console.log(`   ID: ${u.id}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Metadata: ${JSON.stringify(u.user_metadata || {})}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No test users found. Need to create test users.');
    console.log('\nCreating test users for E2E fixtures...\n');

    // Create test users
    const tenants = [
      { email: 'test-tenant-a@e2e.bella.test', tenant: 'test-e2e-tenant-a', name: 'Test User A' },
      { email: 'test-tenant-b@e2e.bella.test', tenant: 'test-e2e-tenant-b', name: 'Test User B' },
      { email: 'test-attacker@e2e.bella.test', tenant: 'test-e2e-tenant-attacker', name: 'Test Attacker' },
    ];

    for (const t of tenants) {
      const { data, error: createError } = await client.auth.admin.createUser({
        email: t.email,
        email_confirm: true,
        user_metadata: {
          test_tenant: t.tenant,
          name: t.name,
        }
      });

      if (createError) {
        console.error(`❌ Error creating ${t.email}:`, createError);
      } else {
        console.log(`✅ Created user ${t.email}`);
        console.log(`   UUID: ${data.user?.id}`);
      }
    }
  }
}

checkTestUsers().catch(console.error);
