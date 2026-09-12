/**
 * Create a test customer for reservation workflow testing
 * Does NOT clean up - keeps customer for subsequent tests
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTestCustomer() {
  console.log('\n🏗️  Creating Test Customer for Reservation Workflow\n');
  console.log('═'.repeat(70));

  // Get first tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenant) {
    console.error('\n❌ No tenants found');
    process.exit(1);
  }

  const testCustomer = {
    tenant_id: tenant.id,
    name: 'Reservation Test Customer',
    phone: '0901111111',
    email: 'reservation-test@example.com'
  };

  // Check if already exists
  const { data: existing } = await supabase
    .from('re_customers')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('phone', testCustomer.phone)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    console.log('\n✅ Test customer already exists');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Name: ${existing.name}`);
    console.log(`   Phone: ${existing.phone}`);
    console.log(`   Tenant: ${existing.tenant_id.slice(0, 8)}...`);
    console.log('\n💡 Using existing customer for reservation tests\n');
    process.exit(0);
  }

  // Create new
  const { data: created, error } = await supabase
    .from('re_customers')
    .insert(testCustomer)
    .select()
    .single();

  if (error) {
    console.error('\n❌ Failed to create customer:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Test customer created successfully!');
  console.log(`   ID: ${created.id}`);
  console.log(`   Name: ${created.name}`);
  console.log(`   Phone: ${created.phone}`);
  console.log(`   Email: ${created.email}`);
  console.log(`   Tenant: ${created.tenant_id.slice(0, 8)}...`);
  console.log('\n💡 Customer ready for reservation workflow testing\n');
  console.log('═'.repeat(70) + '\n');

  process.exit(0);
}

createTestCustomer().catch(console.error);
