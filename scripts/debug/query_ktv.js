const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users, error: uErr } = await supabase.from('users').select('*').ilike('full_name', '%hoa%');
  console.log('User:', users);
  
  if (users && users.length > 0) {
    const ktvId = users[0].id;
    const { data: sessions, error: sErr } = await supabase
      .from('session_logs')
      .select('*, bookings!inner(package_name, total_sessions, status, completed_sessions, assigned_ktv_id)')
      .eq('bookings.assigned_ktv_id', ktvId);
    
    console.log('Scheduled sessions assigned to her:', sessions?.filter(s => s.status === 'scheduled').length);
    console.log('Data:', JSON.stringify(sessions?.filter(s => s.status === 'scheduled'), null, 2));

    const { data: reassignedSessions } = await supabase
      .from('session_logs')
      .select('*, bookings!inner(package_name, total_sessions, status, completed_sessions, assigned_ktv_id)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'scheduled');
    console.log('Reassigned sessions assigned to her:', reassignedSessions?.length);
  }
}
main();
