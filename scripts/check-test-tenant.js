/**
 * Check actual tenant_id for Gate 1/2 test data
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Checking test tenant...\n');
  
  // Check tenants
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(5);
  
  if (tenantError) {
    console.error('❌ Failed to fetch tenants:', tenantError.message);
    process.exit(1);
  }
  
  console.log(`Found ${tenants.length} tenants:`);
  tenants.forEach(t => {
    console.log(`  - ${t.name}: ${t.id}`);
  });
  
  // Check leave requests
  console.log('\n🔍 Checking leave requests...\n');
  
  for (const tenant of tenants) {
    const { data: requests, error: reqError } = await supabase
      .from('leave_requests')
      .select('id, tenant_id, employee_id, status, days')
      .eq('tenant_id', tenant.id)
      .limit(5);
    
    if (!reqError && requests && requests.length > 0) {
      console.log(`Tenant: ${tenant.name} (${tenant.id})`);
      console.log(`  Found ${requests.length} leave requests:`);
      requests.forEach(r => {
        console.log(`    - ${r.id}: ${r.days} days, status: ${r.status}`);
      });
      console.log('');
    }
  }
}

main().catch(console.error);
