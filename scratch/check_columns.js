const { createClient } = require('@supabase/supabase-js');

async function checkColumns() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'PLACEHOLDER_SUPABASE_ANON_KEY'
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
