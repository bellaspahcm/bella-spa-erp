const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0');

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
