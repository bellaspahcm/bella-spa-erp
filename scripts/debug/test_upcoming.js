const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const user = { id: '01203eeb-696c-49b5-8def-1700c29a0f8f', role: 'ktv' };
  const today = '2026-05-21';

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
        status,
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
    .eq('bookings.assigned_ktv_id', user.id);

  console.log("originalData len:", originalData?.length);

  const mergedMap = new Map();
  if (originalData) originalData.forEach(s => mergedMap.set(s.id, s));
  const data = Array.from(mergedMap.values());

  const sessionsByBooking = {};
  data.forEach((s) => {
    if (!s.booking_id || !s.bookings) return;
    if (s.bookings.assigned_ktv_id === user.id && s.completed_by_ktv_id && s.completed_by_ktv_id !== user.id) return;
    if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
    sessionsByBooking[s.booking_id].push(s);
  });

  const processedSessionsList = [];

  for (const [bookingId, bookingSessions] of Object.entries(sessionsByBooking)) {
    bookingSessions.sort((a, b) => a.session_number - b.session_number);

    let lastKnownDate = null;
    let lastKnownSessionNum = 0;

    for (const s of bookingSessions) {
      let finalDate = s.assigned_date;

      if (!finalDate) {
        if (lastKnownDate) {
          const [y, m, d] = lastKnownDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - lastKnownSessionNum));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else if (s.bookings?.start_date) {
          const [y, m, d] = s.bookings.start_date.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - 1));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      }

      if (finalDate) {
        lastKnownDate = finalDate;
        lastKnownSessionNum = s.session_number;
      }

      const bookingTotal = s.bookings?.total_sessions || 0;
      const isBookingCompleted = s.bookings?.status === 'completed';

      console.log(`Session ${s.id}: num=${s.session_number}, status=${s.status}, finalDate=${finalDate}, today=${today}, bookingTotal=${bookingTotal}, isBookingCompleted=${isBookingCompleted}`);

      if (s.status === 'scheduled' && finalDate === today && s.session_number <= bookingTotal && !isBookingCompleted) {
        processedSessionsList.push(s);
      }
    }
  }

  console.log("Processed len:", processedSessionsList.length);
}
main();
