const { createClient } = require('@supabase/supabase-js');

async function checkData() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
  );

  console.log('Checking Revenue...');
  const { data: rev, error: revErr } = await supabase.from('revenue').select('*').limit(5);
  if (revErr) console.error(revErr);
  else console.log('Revenue sample:', JSON.stringify(rev, null, 2));

  console.log('\nChecking Expenses...');
  const { data: exp, error: expErr } = await supabase.from('expenses').select('*').limit(5);
  if (expErr) console.error(expErr);
  else console.log('Expenses sample:', JSON.stringify(exp, null, 2));
  
  console.log('\nChecking Sessions...');
  const { data: sess, error: sessErr } = await supabase.from('session_logs').select('assigned_date, status').limit(10);
  if (sessErr) console.error(sessErr);
  else console.log('Sessions sample:', JSON.stringify(sess, null, 2));
}

checkData();
