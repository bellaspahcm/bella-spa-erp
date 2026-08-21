/**
 * Create E2E test users for Runtime Security Gate
 * 
 * Purpose: Ensure test fixtures have actual auth.users UUIDs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceKey);

async function createE2EUsers() {
  console.log('🔧 Creating E2E test users for Runtime fixtures...\n');

  const tenants = [
    { 
      email: 'test-tenant-a@e2e.bella.test', 
      tenant: 'test-e2e-tenant-a', 
      name: 'E2E Test User A',
      password: 'test-password-a-secure-123'
    },
    { 
      email: 'test-tenant-b@e2e.bella.test', 
      tenant: 'test-e2e-tenant-b', 
      name: 'E2E Test User B',
      password: 'test-password-b-secure-123'
    },
    { 
      email: 'test-attacker@e2e.bella.test', 
      tenant: 'test-e2e-tenant-attacker', 
      name: 'E2E Test Attacker',
      password: 'test-password-attacker-secure-123'
    },
  ];

  const results: Record<string, string> = {};

  for (const t of tenants) {
    // Check if exists
    const { data: existing } = await client.auth.admin.listUsers();
    const existingUser = existing.users.find(u => u.email === t.email);

    if (existingUser) {
      console.log(`✅ User already exists: ${t.email}`);
      console.log(`   UUID: ${existingUser.id}`);
      results[t.tenant] = existingUser.id;
    } else {
      const { data, error: createError } = await client.auth.admin.createUser({
        email: t.email,
        password: t.password,
        email_confirm: true,
        user_metadata: {
          test_tenant: t.tenant,
          name: t.name,
          e2e_test: true,
        }
      });

      if (createError) {
        console.error(`❌ Error creating ${t.email}:`, createError);
      } else if (data.user) {
        console.log(`✅ Created user ${t.email}`);
        console.log(`   UUID: ${data.user.id}`);
        results[t.tenant] = data.user.id;
      }
    }
  }

  // Output fixture code
  console.log('\n\n📋 Updated E2E_TENANTS fixture:\n');
  console.log('export const E2E_TENANTS = {');
  console.log('  TENANT_A: {');
  console.log(`    tenantId: 'test-e2e-tenant-a',`);
  console.log(`    tenantName: 'E2E Test Tenant A',`);
  console.log(`    userId: '${results['test-e2e-tenant-a']}',  // ✅ Real UUID`);
  console.log('  } as E2ETenant,');
  console.log('  ');
  console.log('  TENANT_B: {');
  console.log(`    tenantId: 'test-e2e-tenant-b',`);
  console.log(`    tenantName: 'E2E Test Tenant B',`);
  console.log(`    userId: '${results['test-e2e-tenant-b']}',  // ✅ Real UUID`);
  console.log('  } as E2ETenant,');
  console.log('  ');
  console.log('  TENANT_ATTACKER: {');
  console.log(`    tenantId: 'test-e2e-tenant-attacker',`);
  console.log(`    tenantName: 'E2E Test Attacker',`);
  console.log(`    userId: '${results['test-e2e-tenant-attacker']}',  // ✅ Real UUID`);
  console.log('  } as E2ETenant,');
  console.log('} as const;');
}

createE2EUsers().catch(console.error);
