const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY');

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
