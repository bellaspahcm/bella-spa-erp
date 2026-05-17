const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvnvkpyxtuilhrabtlwv.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
);

async function run() {
  // Let's get bookings and their customers for Cao Thi Thuy Van
  console.log('--- Booking details for Cao Thi Thuy Van ---');
  const { data: bookingsVan } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_number,
      package_name,
      status,
      assigned_ktv_id,
      customers (
        name_mother
      )
    `)
    .eq('booking_number', 'BK-1778837717081');
  console.log(bookingsVan);

  // Let's get all sessions for this booking
  const { data: sessionsVan } = await supabase
    .from('session_logs')
    .select('id, session_number, status, assigned_date, assigned_time, completed_by_ktv_id')
    .eq('booking_id', 'a120e195-3639-42e0-bee2-dc91880d6e51')
    .order('session_number', { ascending: true });
  console.log('Sessions for Cao Thi Thuy Van:', sessionsVan);
}

run();
