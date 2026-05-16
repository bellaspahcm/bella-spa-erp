const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = 'PLACEHOLDER_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('packages').select('name');
  console.log(JSON.stringify({ data, error }, null, 2));
}

run();
