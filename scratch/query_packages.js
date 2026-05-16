const fs = require('fs');
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = envStr.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('packages').select('*').then(r => console.log(JSON.stringify(r.data, null, 2)));
