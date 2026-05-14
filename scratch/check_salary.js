const { createClient } = require('@supabase/supabase-js');

async function checkSalary() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'PLACEHOLDER_SUPABASE_ANON_KEY'
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
