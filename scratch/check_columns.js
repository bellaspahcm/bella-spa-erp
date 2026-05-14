const { createClient } = require('@supabase/supabase-js');

async function checkColumns() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
  );

  console.log('Checking Revenue Columns...');
  const { data, error } = await supabase.from('revenue').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Columns found:', Object.keys(data[0] || {}));
  }
}

checkColumns();
