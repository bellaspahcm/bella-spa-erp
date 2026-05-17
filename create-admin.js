const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY');

async function run() {
  const email = 'bellaspa.testadmin@gmail.com';
  const tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e'; // Bella Spa tenant

  console.log('Inserting/updating public.users record for testadmin directly in project root...');
  const { data, error } = await supabase
    .from('users')
    .upsert({
      email,
      full_name: 'Test Admin Full Chức Năng',
      role: 'admin',
      status: 'active',
      tenant_id: tenantId,
    }, {
      onConflict: 'email'
    })
    .select();

  if (error) {
    console.error('Error inserting public.users record:', error);
  } else {
    console.log('Successfully inserted/updated public.users record:', JSON.stringify(data, null, 2));
  }
}

run();
