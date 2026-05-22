const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY');

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
