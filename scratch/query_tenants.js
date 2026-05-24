const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function queryTenants() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, status, created_at');

  if (error) {
    console.error('Error fetching tenants:', error);
  } else {
    console.log('--- DB TENANTS LIST ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('Total tenants in database:', data.length);
  }
}

queryTenants();
