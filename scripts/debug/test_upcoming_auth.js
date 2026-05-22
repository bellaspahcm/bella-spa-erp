const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const today = '2026-05-21';
  // 1. Authenticate as the KTV user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'nguyenthihoa@bellaspa.com',
    password: 'password123' // default password for seeded KTVs usually
  });
  
  if (authError) {
    console.log("Auth failed:", authError);
    // Just try getting sessions using the service role key to see the actual return from the query
    return;
  }
  
  console.log("Auth success. User ID:", authData.user.id);
  const user = authData.user;
  
  const { data: originalData, error } = await supabase
    .from('session_logs')
    .select('*, bookings!inner(id, status, completed_sessions, total_sessions, assigned_ktv_id, package_id, start_date, preferred_time)')
    .eq('assigned_date', today)
    .eq('bookings.assigned_ktv_id', user.id)
    .order('assigned_time', { ascending: true });

  const { data: reassignedData } = await supabase
    .from('session_logs')
    .select('*, bookings(id, status, completed_sessions, total_sessions, assigned_ktv_id, package_id, start_date, preferred_time)')
    .eq('assigned_date', today)
    .eq('completed_by_ktv_id', user.id)
    .order('assigned_time', { ascending: true });

  console.log("Original Data:", originalData?.length);
  console.log("Reassigned Data:", reassignedData?.length);
  
  const mergedMap = new Map();
  if (originalData) originalData.forEach((s) => mergedMap.set(s.id, s));
  if (reassignedData) reassignedData.forEach((s) => mergedMap.set(s.id, s));
  const data = Array.from(mergedMap.values());
  console.log("Total sessions returned:", data.length);
  
  if (data.length > 0) {
    const s = data[0];
    console.log("First session:", s.id);
    console.log("Bookings shape:", Array.isArray(s.bookings) ? 'ARRAY' : 'OBJECT', s.bookings);
  }
}

test();
