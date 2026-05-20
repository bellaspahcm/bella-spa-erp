const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY');

async function test() {
  const ktvId = '01203eeb-696c-49b5-8def-1700c29a0f8f';
  const dateStr = '2026-05-20';
  
  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
        id,
        booking_number,
        package_name,
        customer_id,
        assigned_ktv_id,
        preferred_time
      )
    `)
    .eq('bookings.assigned_ktv_id', ktvId)
    .eq('status', 'scheduled')
    .eq('assigned_date', dateStr);
    
  console.log('Error:', error);
  console.log('Data length:', data ? data.length : null);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test();
