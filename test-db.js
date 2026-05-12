const { createClient } = require('@supabase/supabase-js'); 
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY'); 
async function run() { 
  const res1 = await supabase.from('session_logs').select('*', { count: 'exact', head: true }).eq('assigned_date', '2026-05-12'); 
  console.log('Session response:', JSON.stringify(res1)); 
  
  const res2 = await supabase.from('revenue').select('amount'); 
  console.log('Revenue response:', JSON.stringify(res2)); 
} 
run();
