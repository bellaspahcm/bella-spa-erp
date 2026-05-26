// Debug script. Run: node -r dotenv/config scripts/debug/test-db-policies.js dotenv_config_path=.env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('❌ Missing env vars in .env.local'); process.exit(1); }
const supabase = createClient(url, key);

async function run() {
  console.log('Querying db_policies view...');
  const { data, error } = await supabase
    .from('db_policies')
    .select('*');
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Total Policies:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
