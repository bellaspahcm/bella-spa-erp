
const { createClient } = require('@supabase/supabase-js');

async function checkProject() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
  );

  console.log('--- TABLES ---');
  const { data: tables, error: tableError } = await supabase.rpc('get_tables_info'); 
  // If RPC not available, try a common table
  
  const { data: tenants, error: tError } = await supabase.from('tenants').select('*').limit(5);
  if (tError) {
    console.log('Tenants error (maybe table missing):', tError.message);
  } else {
    console.log('Tenants found:', tenants);
  }

  const { data: users, error: uError } = await supabase.from('users').select('*').limit(1);
  if (uError) {
    console.log('Users error:', uError.message);
  } else {
    console.log('Sample User:', users);
  }
}

checkProject();
