const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0');

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
