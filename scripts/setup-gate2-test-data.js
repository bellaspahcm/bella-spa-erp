/**
 * Setup Gate 2 Test Data
 * 
 * Creates test users and leave requests in "Test Beauty Spa" tenant (isolated)
 * Does NOT affect Bella Spa production data
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111'; // Test Beauty Spa

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🧪 Setting up Gate 2 test data...\n');
  console.log(`Tenant: Test Beauty Spa (${TEST_TENANT_ID})`);
  console.log('⚠️  This will NOT affect Bella Spa production data\n');
  
  // Step 1: Verify test tenant exists
  console.log('Step 1: Verify test tenant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', TEST_TENANT_ID)
    .single();
  
  if (tenantError || !tenant) {
    console.error('❌ Test tenant not found');
    process.exit(1);
  }
  
  console.log(`✅ Tenant found: ${tenant.name}\n`);
  
  // Step 2: Create test users
  console.log('Step 2: Create test users...');
  
  const testUsers = [
    {
      id: 'a0000001-0000-0000-0000-000000000001',
      email: 'gate2-user-1@test.bellaspa.local',
      full_name: 'Gate2 Test User 1',
      role: 'ktv',
      tenant_id: TEST_TENANT_ID,
      leave_balance: 15,
    },
    {
      id: 'a0000002-0000-0000-0000-000000000002',
      email: 'gate2-user-2@test.bellaspa.local',
      full_name: 'Gate2 Test User 2',
      role: 'ktv',
      tenant_id: TEST_TENANT_ID,
      leave_balance: 5,
    },
    {
      id: 'a0000003-0000-0000-0000-000000000003',
      email: 'gate2-admin@test.bellaspa.local',
      full_name: 'Gate2 Test Admin',
      role: 'admin',
      tenant_id: TEST_TENANT_ID,
      leave_balance: 20,
    },
  ];
  
  for (const user of testUsers) {
    const { error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'id' });
    
    if (error) {
      console.error(`❌ Failed to create user ${user.email}:`, error.message);
    } else {
      console.log(`  ✅ ${user.full_name} (${user.leave_balance} days)`);
    }
  }
  
  console.log('');
  
  // Step 3: Create test leave requests
  console.log('Step 3: Create test leave requests...');
  
  const testRequests = [
    {
      id: 'b0000001-0000-0000-0000-000000000001',
      employee_id: 'a0000001-0000-0000-0000-000000000001',
      tenant_id: TEST_TENANT_ID,
      leave_type: 'annual',
      start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      days: 5,
      reason: 'Gate 2 test request - sufficient balance',
      status: 'pending',
    },
    {
      id: 'b0000002-0000-0000-0000-000000000002',
      employee_id: 'a0000002-0000-0000-0000-000000000002',
      tenant_id: TEST_TENANT_ID,
      leave_type: 'annual',
      start_date: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      days: 5,
      reason: 'Gate 2 test request - insufficient balance',
      status: 'pending',
    },
  ];
  
  for (const request of testRequests) {
    const { error } = await supabase
      .from('leave_requests')
      .upsert(request, { onConflict: 'id' });
    
    if (error) {
      console.error(`❌ Failed to create request ${request.id}:`, error.message);
    } else {
      console.log(`  ✅ ${request.id}: ${request.days} days, ${request.start_date} → ${request.end_date}`);
    }
  }
  
  console.log('');
  
  // Step 4: Verify data
  console.log('Step 4: Verify test data...');
  
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, leave_balance')
    .eq('tenant_id', TEST_TENANT_ID)
    .in('id', ['a0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003']);
  
  const { data: requests, error: requestsError } = await supabase
    .from('leave_requests')
    .select('id, days, status')
    .eq('tenant_id', TEST_TENANT_ID)
    .in('id', ['b0000001-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002']);
  
  if (usersError || requestsError) {
    console.error('❌ Verification failed');
    process.exit(1);
  }
  
  console.log(`  Users: ${users?.length || 0} found`);
  console.log(`  Requests: ${requests?.length || 0} found\n`);
  
  if ((users?.length || 0) < 3 || (requests?.length || 0) < 2) {
    console.error('❌ Incomplete test data');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Gate 2 test data setup complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Test Data Summary:');
  console.log(`  Tenant: ${tenant.name} (isolated)`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Leave Requests: ${requests.length}`);
  console.log('');
  console.log('Next: Run Gate 2 validation');
  console.log('  node scripts/run-gate2-validation.js');
  console.log('');
}

main().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
