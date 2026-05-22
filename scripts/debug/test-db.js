const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0');

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
