const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('packages').select('name');
  console.log(JSON.stringify({ data, error }, null, 2));
}

run();
