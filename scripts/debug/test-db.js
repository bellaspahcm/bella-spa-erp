// Debug script. Run: node -r dotenv/config scripts/debug/test-db.js dotenv_config_path=.env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('❌ Missing env vars in .env.local'); process.exit(1); }
const supabase = createClient(url, key);

async function run() {
  console.log('Fetching all users from public.users...');
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, status');

  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Total users:', users.length);
    console.log(JSON.stringify(users, null, 2));
  }
}

run();
