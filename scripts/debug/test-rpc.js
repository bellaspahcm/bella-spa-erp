const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0');

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
