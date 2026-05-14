const { createClient } = require('@supabase/supabase-js');

async function checkAllColumns() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'PLACEHOLDER_SUPABASE_ANON_KEY'
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
