// Script tạo/sửa tài khoản testadmin trong public.users
// Chạy: node -r dotenv/config create-admin.js dotenv_config_path=.env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const email = 'bellaspa.testadmin@gmail.com';
  const tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e'; // Bella Spa tenant

  console.log('Inserting/updating public.users record for testadmin...');
  const { data, error } = await supabase
    .from('users')
    .upsert({
      email,
      full_name: 'Test Admin Full Chức Năng',
      role: 'admin',
      status: 'active',
      tenant_id: tenantId,
    }, {
      onConflict: 'email'
    })
    .select();

  if (error) {
    console.error('Error inserting public.users record:', error);
  } else {
    console.log('Successfully inserted/updated public.users record:', JSON.stringify(data, null, 2));
  }
}

run();
