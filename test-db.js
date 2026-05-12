const { createClient } = require('@supabase/supabase-js'); 
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'); 
async function run() { 
  const res1 = await supabase.from('session_logs').select('*', { count: 'exact', head: true }).eq('assigned_date', '2026-05-12'); 
  console.log('Session response:', JSON.stringify(res1)); 
  
  const res2 = await supabase.from('revenue').select('amount'); 
  console.log('Revenue response:', JSON.stringify(res2)); 
} 
run();
