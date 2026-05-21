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
    message: `Test Notif 2`,
    data: {
      customer_id: "9481aed8-af9e-4e32-8ce5-3e5011cdfe58",
      booking_id: "78a80d98-ac52-4135-ad97-9409b9d927c9",
      booking_number: "BK-ONLINE-123456"
    }
  }]);
  
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success:', data);
  }
}

testNotif();
