// Debug script. Run: node -r dotenv/config scripts/debug/test-rpc.js dotenv_config_path=.env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('❌ Missing env vars in .env.local'); process.exit(1); }
const supabase = createClient(url, key);

async function run() {
  const sql = `
    INSERT INTO public.users (email, full_name, role, status, tenant_id) 
    VALUES (
      'bellaspa.testadmin@gmail.com', 
      'Test Admin Full Chức Năng', 
      'admin', 
      'active', 
      '0e66365b-42b0-420e-acca-f7d7692e125e'
    ) 
    ON CONFLICT (email) 
    DO UPDATE SET 
      role = 'admin', 
      status = 'active',
      full_name = 'Test Admin Full Chức Năng';
  `;

  console.log('Running RPC execute_sql...');
  const { data, error } = await supabase.rpc('execute_sql', { query: sql });
  
  if (error) {
    console.log('RPC query failed, attempting execute_sql with sql param...');
    const { data: data2, error: error2 } = await supabase.rpc('execute_sql', { sql });
    if (error2) {
      console.error('RPC both attempts failed:', error2);
    } else {
      console.log('Successfully ran execute_sql via sql param! Data:', data2);
    }
  } else {
    console.log('Successfully ran execute_sql via query param! Data:', data);
  }
}

run();
