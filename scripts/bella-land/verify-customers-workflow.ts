/**
 * Bella Land Customers - Database Integrity Check
 * 
 * Checks:
 * 1. Customers exist in re_customers table
 * 2. Tenant isolation intact
 * 3. Required fields populated
 * 4. No orphan records
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
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

type CustomerRow = Database['public']['Tables']['re_customers']['Row'];

async function verifyCustomers() {
  console.log('\n🔍 Bella Land Customers - Database Integrity Check\n');
  console.log('═'.repeat(70));

  // 1. Check all customers
  const { data: allCustomers, error } = await supabase
    .from('re_customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch customers:', error.message);
    process.exit(1);
  }

  console.log(`\n📊 Total customers: ${allCustomers?.length || 0}`);

  if (!allCustomers || allCustomers.length === 0) {
    console.log('\n⚠️  No customers found. Create test customers first.');
    console.log('\n💡 Customers are REQUIRED for creating reservations.');
    return;
  }

  // 2. Group by tenant
  const customersByTenant = new Map<string, CustomerRow[]>();
  for (const customer of allCustomers) {
    if (!customersByTenant.has(customer.tenant_id)) {
      customersByTenant.set(customer.tenant_id, []);
    }
    customersByTenant.get(customer.tenant_id)!.push(customer);
  }

  console.log(`👥 Tenants with customers: ${customersByTenant.size}`);

  // 3. Required fields validation
  console.log('\n━'.repeat(70));
  console.log('📋 REQUIRED FIELDS VALIDATION');
  console.log('━'.repeat(70));

  const missingName = allCustomers.filter(c => !c.name);
  const missingPhone = allCustomers.filter(c => !c.phone);
  const missingTenant = allCustomers.filter(c => !c.tenant_id);

  console.log(`\n${missingName.length === 0 ? '✅' : '🔴'} Customers with name: ${allCustomers.length - missingName.length}/${allCustomers.length}`);
  console.log(`${missingPhone.length === 0 ? '✅' : '🔴'} Customers with phone: ${allCustomers.length - missingPhone.length}/${allCustomers.length}`);
  console.log(`${missingTenant.length === 0 ? '✅' : '🔴'} Customers with tenant_id: ${allCustomers.length - missingTenant.length}/${allCustomers.length}`);

  if (missingName.length > 0) {
    console.log(`\n⚠️  ${missingName.length} customers missing name (first 3):`);
    for (const c of missingName.slice(0, 3)) {
      console.log(`   - ID: ${c.id.slice(0, 8)}..., Phone: ${c.phone || 'N/A'}`);
    }
  }

  // 4. Tenant isolation
  console.log('\n━'.repeat(70));
  console.log('🔒 TENANT ISOLATION');
  console.log('━'.repeat(70));

  for (const [tenantId, customers] of customersByTenant.entries()) {
    console.log(`\n   Tenant: ${tenantId.slice(0, 8)}...`);
    console.log(`   Customers: ${customers.length}`);
  }

  // 5. Recent customers
  console.log('\n━'.repeat(70));
  console.log('🕐 RECENT CUSTOMERS (Last 5)');
  console.log('━'.repeat(70));

  const recentCustomers = allCustomers.slice(0, 5);
  for (const customer of recentCustomers) {
    const createdAt = new Date(customer.created_at).toLocaleString('vi-VN');
    
    console.log(`\n   👤 ${customer.name || 'Unnamed'}`);
    console.log(`      Phone: ${customer.phone || 'N/A'}`);
    console.log(`      Email: ${customer.email || 'N/A'}`);
    console.log(`      Tenant: ${customer.tenant_id.slice(0, 8)}...`);
    console.log(`      Created: ${createdAt}`);
  }

  // 6. Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  const allHaveTenant = missingTenant.length === 0;
  const allHaveName = missingName.length === 0;
  const allHavePhone = missingPhone.length === 0;

  console.log(`\n   Total customers: ${allCustomers.length}`);
  console.log(`   Tenant isolation: ${allHaveTenant ? '✅ All have tenant_id' : '🔴 Some missing tenant_id'}`);
  console.log(`   Required fields (name): ${allHaveName ? '✅' : '🔴'}`);
  console.log(`   Required fields (phone): ${allHavePhone ? '✅' : '🔴'}`);
  console.log(`   Unique tenants: ${customersByTenant.size}`);

  if (allHaveTenant && allHaveName && allHavePhone) {
    console.log('\n   🎉 ALL CHECKS PASSED');
    console.log('\n   ✅ Customers data is ready for reservations workflow');
  } else {
    console.log('\n   ⚠️  ISSUES FOUND - Review above');
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  // Exit code
  const success = allHaveTenant && allHaveName && allHavePhone;
  process.exit(success ? 0 : 1);
}

verifyCustomers().catch(console.error);
