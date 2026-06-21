/**
 * Check ACTUAL revenue for June based on screenshot: 9,499,500
 * = 9,300,000 + 199,500
 * 
 * This should match: All sessions completed in June (excluding demo)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('\n=== JUNE 2026 ACTUAL REVENUE CHECK ===');
  console.log('Expected: 9,499,500đ (from calculator screenshot)\n');

  // Get ALL completed sessions in June, excluding demo
  const { data: sessions } = await supabase
    .from('session_logs')
    .select(`
      id,
      completed_date,
      status,
      booking:bookings (
        booking_number,
        full_price,
        total_sessions,
        customer:customers (
          name_mother
        )
      )
    `)
    .gte('completed_date', '2026-06-01')
    .lt('completed_date', '2026-07-01')
    .eq('status', 'completed');

  // Filter out demo
  const realSessions = sessions?.filter((s: any) => {
    return s.booking && !s.booking.booking_number.includes('BSP-DEMO-') && !s.booking.booking_number.includes('DEMO');
  }) || [];

  console.log(`Total real sessions in June: ${realSessions.length}\n`);

  // Group by booking
  const bookingGroups: Record<string, any> = {};

  realSessions.forEach((session: any) => {
    const bookingNumber = session.booking.booking_number;
    if (!bookingGroups[bookingNumber]) {
      bookingGroups[bookingNumber] = {
        booking_number: bookingNumber,
        customer: session.booking.customer?.name_mother,
        full_price: Number(session.booking.full_price),
        total_sessions: Number(session.booking.total_sessions),
        completed_in_june: 0,
        revenue_per_session: Number(session.booking.full_price) / Number(session.booking.total_sessions),
      };
    }
    bookingGroups[bookingNumber].completed_in_june++;
  });

  const bookings = Object.values(bookingGroups);

  console.log('Bookings with sessions completed in June:\n');

  let totalRevenue = 0;

  bookings.forEach((booking: any, idx: number) => {
    const revenue = booking.revenue_per_session * booking.completed_in_june;
    totalRevenue += revenue;

    console.log(`${idx + 1}. ${booking.customer} - ${booking.booking_number}`);
    console.log(`   Full Price: ${booking.full_price.toLocaleString('vi-VN')}đ / ${booking.total_sessions} sessions`);
    console.log(`   Revenue per session: ${booking.revenue_per_session.toLocaleString('vi-VN')}đ`);
    console.log(`   Completed in June: ${booking.completed_in_june} sessions`);
    console.log(`   Total Revenue: ${revenue.toLocaleString('vi-VN')}đ`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`TOTAL REVENUE FROM SESSIONS: ${totalRevenue.toLocaleString('vi-VN')}đ`);
  console.log(`EXPECTED (from screenshot):  9.499.500đ`);
  console.log(`DIFFERENCE:                  ${(totalRevenue - 9499500).toLocaleString('vi-VN')}đ`);
  console.log('='.repeat(80));

  if (Math.abs(totalRevenue - 9499500) < 1000) {
    console.log('\n✅ MATCH! Session revenue matches expected revenue.');
  } else {
    console.log(`\n⚠️  MISMATCH! Difference: ${(totalRevenue - 9499500).toLocaleString('vi-VN')}đ`);
    console.log('\nPossible reasons:');
    console.log('  1. Some sessions not included in calculation');
    console.log('  2. Manual entries or adjustments not captured');
    console.log('  3. Rounding differences in revenue per session');
  }
}

main();
