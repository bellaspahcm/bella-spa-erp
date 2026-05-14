const { createClient } = require('@supabase/supabase-js');

async function checkAllColumns() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
  );

  const tables = ['expenses', 'session_reviews', 'session_logs'];
  for (const table of tables) {
    console.log(`Checking ${table} Columns...`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(error);
    } else {
      console.log(`${table} columns:`, Object.keys(data[0] || {}));
    }
    console.log('---');
  }
}

checkAllColumns();
