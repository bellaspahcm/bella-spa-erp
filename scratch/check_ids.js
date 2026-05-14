
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTenants() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: tenants, error: tError } = await supabase.from('tenants').select('id, name');
  console.log('Tenants:', tenants);
  if (tError) console.error('Tenant error:', tError);

  const { data: users, error: uError } = await supabase.from('users').select('id, email, tenant_id').limit(1);
  console.log('Sample User:', users);
  if (uError) console.error('User error:', uError);
}

checkTenants();
