/**
 * Healthcare Platform Test Data Bootstrap
 * 
 * Creates real test tenants + minimal dependencies for integration tests.
 * 
 * Creates:
 * - 2 test tenants (Tenant A, Tenant B)
 * - 2 test patients (party_parties type=person)
 * - 2 test providers (party_parties type=person)
 * - Idempotent: Can run multiple times safely
 * 
 * Usage:
 *   node scripts/seed-healthcare-test-data.js
 */

require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fixed UUIDs for test data (idempotent)
const TEST_DATA = {
  tenants: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Healthcare Test Tenant A',
      status: 'active',
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      name: 'Healthcare Test Tenant B',
      status: 'active',
    },
  ],
  patients: [
    {
      id: '20000000-0000-0000-0000-000000000001',
      party_type: 'person',
      display_name: 'Test Patient A1',
      tenant_id: '10000000-0000-0000-0000-000000000001',
    },
    {
      id: '20000000-0000-0000-0000-000000000002',
      party_type: 'person',
      display_name: 'Test Patient A2',
      tenant_id: '10000000-0000-0000-0000-000000000001',
    },
    {
      id: '20000000-0000-0000-0000-000000000003',
      party_type: 'person',
      display_name: 'Test Patient B1',
      tenant_id: '10000000-0000-0000-0000-000000000002',
    },
  ],
  providers: [
    {
      id: '30000000-0000-0000-0000-000000000001',
      party_type: 'person',
      display_name: 'Dr. Test Provider A',
      tenant_id: '10000000-0000-0000-0000-000000000001',
    },
    {
      id: '30000000-0000-0000-0000-000000000002',
      party_type: 'person',
      display_name: 'Dr. Test Provider B',
      tenant_id: '10000000-0000-0000-0000-000000000002',
    },
  ],
};

async function seedTenants() {
  console.log('\n📦 Seeding test tenants...');
  
  for (const tenant of TEST_DATA.tenants) {
    const { data: existing } = await client
      .from('tenants')
      .select('id')
      .eq('id', tenant.id)
      .maybeSingle();
    
    if (existing) {
      console.log(`  ⏭️  Tenant ${tenant.name} already exists`);
      continue;
    }
    
    const { error } = await client
      .from('tenants')
      .insert(tenant);
    
    if (error) {
      console.error(`  ❌ Failed to create ${tenant.name}:`, error.message);
    } else {
      console.log(`  ✅ Created tenant: ${tenant.name}`);
    }
  }
}

async function seedParties() {
  console.log('\n👥 Seeding test parties (patients + providers)...');
  
  const allParties = [...TEST_DATA.patients, ...TEST_DATA.providers];
  
  for (const party of allParties) {
    const { data: existing } = await client
      .from('party_parties')
      .select('id')
      .eq('id', party.id)
      .maybeSingle();
    
    if (existing) {
      console.log(`  ⏭️  Party ${party.display_name} already exists`);
      continue;
    }
    
    const { error } = await client
      .from('party_parties')
      .insert(party);
    
    if (error) {
      console.error(`  ❌ Failed to create ${party.display_name}:`, error.message);
    } else {
      console.log(`  ✅ Created party: ${party.display_name}`);
    }
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying test data setup...');
  
  const { count: tenantCount } = await client
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .in('id', TEST_DATA.tenants.map(t => t.id));
  
  const { count: partyCount } = await client
    .from('party_parties')
    .select('*', { count: 'exact', head: true })
    .in('id', [...TEST_DATA.patients, ...TEST_DATA.providers].map(p => p.id));
  
  console.log(`  Tenants: ${tenantCount}/${TEST_DATA.tenants.length}`);
  console.log(`  Parties: ${partyCount}/${TEST_DATA.patients.length + TEST_DATA.providers.length}`);
  
  if (tenantCount === TEST_DATA.tenants.length && 
      partyCount === TEST_DATA.patients.length + TEST_DATA.providers.length) {
    console.log('\n✅ Test data bootstrap complete!');
    console.log('\n📋 Test Constants (copy to integration test):');
    console.log(`  TENANT_A = '${TEST_DATA.tenants[0].id}'`);
    console.log(`  TENANT_B = '${TEST_DATA.tenants[1].id}'`);
    console.log(`  PATIENT_A1 = '${TEST_DATA.patients[0].id}'`);
    console.log(`  PATIENT_B1 = '${TEST_DATA.patients[2].id}'`);
    console.log(`  PROVIDER_A = '${TEST_DATA.providers[0].id}'`);
    console.log(`  PROVIDER_B = '${TEST_DATA.providers[1].id}'`);
    return true;
  } else {
    console.log('\n⚠️ Test data incomplete. Check errors above.');
    return false;
  }
}

async function main() {
  console.log('🚀 Healthcare Platform Test Data Bootstrap');
  console.log('==========================================');
  
  try {
    await seedTenants();
    await seedParties();
    const success = await verifySetup();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

main();
