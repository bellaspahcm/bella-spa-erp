/**
 * Find the 350,000đ massage transaction from June 2026
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

async function findMassageTransaction() {
  console.log('\n=== Finding 350,000đ Massage Transaction ===\n');

  // Find revenue record with 350,000 amount in June 2026
  const { data: revenues, error } = await supabase
    .from('revenue')
    .select('*')
    .eq('amount', 350000)
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .order('received_date', { ascending: true });

  if (error) {
    console.error('❌ Error finding revenue:', error.message);
    return;
  }

  if (!revenues || revenues.length === 0) {
    console.log('❌ No 350,000đ transaction found in June 2026');
    return;
  }

  console.log(`📊 Found ${revenues.length} revenue record(s) with 350,000đ:`);
  console.log('');

  for (const revenue of revenues) {
    console.log(`💰 Revenue ID: ${revenue.id}`);
    console.log(`   Amount: ${revenue.amount?.toLocaleString('vi-VN')} đ`);
    console.log(`   Received Date: ${revenue.received_date}`);
    console.log(`   Revenue Type: ${revenue.revenue_type}`);
    console.log(`   Status: ${revenue.status}`);
    console.log(`   Booking ID: ${revenue.booking_id}`);
    console.log('');

    if (revenue.booking_id) {
      // Get booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, booking_number, full_price, discount_percent, package_name, status, created_at')
        .eq('id', revenue.booking_id)
        .single();

      if (bookingError) {
        console.error('   ❌ Error finding booking:', bookingError.message);
      } else if (booking) {
        console.log('📋 Booking Details:');
        console.log(`   Booking Number: ${booking.booking_number}`);
        console.log(`   Package Name: ${booking.package_name}`);
        console.log(`   Full Price: ${booking.full_price?.toLocaleString('vi-VN')} đ`);
        console.log(`   Discount %: ${booking.discount_percent}%`);
        console.log(`   Status: ${booking.status}`);
        console.log(`   Created: ${booking.created_at}`);
        console.log('');

        // Calculate price after discount
        const priceAfterDiscount = (booking.full_price || 0) * (1 - (booking.discount_percent || 0) / 100);
        console.log('🧮 Price After Discount:');
        console.log(`   ${booking.full_price?.toLocaleString('vi-VN')} × (1 - ${booking.discount_percent}% / 100) = ${priceAfterDiscount.toLocaleString('vi-VN')} đ`);
        console.log('');

        if (booking.discount_percent !== 43) {
          console.log('❌ PROBLEM FOUND!');
          console.log(`   Current discount: ${booking.discount_percent}%`);
          console.log(`   Expected discount: 43%`);
          console.log(`   Expected price after discount: ${(booking.full_price || 0) * (1 - 43 / 100)} đ = 199,500đ`);
          console.log('');
          console.log('🔧 Solution: Update booking discount_percent to 43%');
          console.log(`   UPDATE bookings SET discount_percent = 43 WHERE id = '${booking.id}';`);
        }

        // Check session logs for this booking
        const { data: sessions, error: sessionError } = await supabase
          .from('session_logs')
          .select('id, session_number, status, created_at')
          .eq('booking_id', booking.id)
          .order('session_number', { ascending: true });

        if (sessionError) {
          console.error('   ❌ Error finding sessions:', sessionError.message);
        } else if (sessions && sessions.length > 0) {
          console.log(`📝 Found ${sessions.length} session(s):`);
          sessions.forEach(session => {
            console.log(`   Session ${session.session_number}: ${session.status} (Created: ${session.created_at})`);
          });
          console.log('');

          // Check journal entries for these sessions
          const sessionIds = sessions.map(s => s.id);
          const { data: journals, error: journalError } = await supabase
            .from('journal_entries')
            .select('id, reference_type, reference_id, status, description')
            .eq('reference_type', 'SESSION_DONE')
            .in('reference_id', sessionIds);

          if (journalError) {
            console.error('   ❌ Error finding journal entries:', journalError.message);
          } else if (journals && journals.length > 0) {
            console.log(`📖 Found ${journals.length} SESSION_DONE journal entry(ies):`);
            
            // Get revenue amounts from journal lines
            const journalIds = journals.map(j => j.id);
            const { data: lines, error: linesError } = await supabase
              .from('journal_lines')
              .select('entry_id, account_id, debit_amount, credit_amount')
              .in('entry_id', journalIds);

            if (linesError) {
              console.error('   ❌ Error finding journal lines:', linesError.message);
            } else {
              // Get account 5113 (revenue account)
              const { data: revenueAccount } = await supabase
                .from('accounting_accounts')
                .select('id')
                .eq('account_code', '5113')
                .maybeSingle();

              const revenueAccountId = revenueAccount?.id;

              journals.forEach(journal => {
                const journalLines = lines?.filter(l => l.entry_id === journal.id);
                const revenueLine = journalLines?.find(l => l.account_id === revenueAccountId);
                
                if (revenueLine) {
                  const revenueAmount = revenueLine.credit_amount || 0;
                  console.log(`   Journal ${journal.id.substring(0, 8)}...: ${revenueAmount.toLocaleString('vi-VN')} đ`);
                  
                  if (Math.abs(revenueAmount - 350000) < 1) {
                    console.log('      ❌ WRONG! Recorded 350,000đ (without 43% discount)');
                  } else if (Math.abs(revenueAmount - 199500) < 1) {
                    console.log('      ✅ Correct (199,500đ with 43% discount)');
                  }
                }
              });
            }
          }
        }
      }
    }

    console.log('─'.repeat(80));
    console.log('');
  }
}

findMassageTransaction()
  .then(() => {
    console.log('\n✅ Search complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
