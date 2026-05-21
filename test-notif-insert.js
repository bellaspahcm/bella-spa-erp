const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNotif() {
  const tenantId = "0e66365b-42b0-420e-acca-f7d7692e125e";
  console.log('Testing insert to app_notifications...');
  const { data, error } = await supabase.from('app_notifications').insert([{
    tenant_id: tenantId,
    type: 'new_booking',
    title: 'Khách hàng đặt lịch mới',
    message: `Test Notif`,
    data: { test: 1 }
  }]);
  
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success:', data);
  }
}

testNotif();
