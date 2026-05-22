const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const ktvId = '01203eeb-696c-49b5-8def-1700c29a0f8f';
  
  const { data: originalData, error: originalError } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
        id,
        booking_number,
        package_name,
        start_date,
        total_sessions,
        completed_sessions,
        preferred_time,
        customer_id,
        assigned_ktv_id,
        packages (
          name
        ),
        customers (
          name_mother,
          name_baby,
          phone,
          address
        )
      )
    `)
    .eq('bookings.assigned_ktv_id', ktvId);
    
  console.log("Original Error:", originalError);
  console.log("Original Data Length:", originalData?.length);
}
main();
