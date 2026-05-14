const { createClient } = require('@supabase/supabase-js');

async function checkSalary() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
  );

  console.log('--- KTVs ---');
  const { data: ktvs } = await supabase.from('users').select('id, full_name, role').eq('role', 'ktv');
  console.log(ktvs);

  console.log('--- Salary Records ---');
  const { data: records } = await supabase.from('salary_records').select('*');
  console.log(records);

  console.log('--- Expenses ---');
  const { data: expenses } = await supabase.from('expenses').select('*').eq('category', 'salary');
  console.log(expenses);
}

checkSalary();
