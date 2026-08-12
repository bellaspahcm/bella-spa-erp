require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTenant() {
  console.log('Fetching available tenants...\n');
  
  const { data, error } = await client
    .from('tenants')
    .select('id, name')
    .limit(5);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Available tenants:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data && data.length > 0) {
      console.log('\n📋 Use this tenant_id for smoke test:');
      console.log(`  tenant_id: '${data[0].id}'`);
      console.log(`  name: ${data[0].name}`);
    }
  }
}

getTenant();
