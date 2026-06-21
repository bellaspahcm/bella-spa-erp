/**
 * Check if massage booking has correct 43% discount in database
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

async function checkMassageBookingDiscount() {
  console.log('\n=== Checking Massage Booking Discount ===\n');

  // Find the massage booking
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_number, full_price, discount_percent, status, created_at')
    .eq('booking_number', 'BK-1779876714059')
    .single();

  if (error) {
    console.error('❌ Error finding booking:', error.message);
    return;
  }

  if (!booking) {
    console.error('❌ Booking BK-1779876714059 not found!');
    return;
  }

  console.log('📋 Booking Details:');
  console.log('   Booking Number:', booking.booking_number);
  console.log('   Full Price:', booking.full_price?.toLocaleString('vi-VN'), 'đ');
  console.log('   Discount %:', booking.discount_percent, '%');
  console.log('   Status:', booking.status);
  console.log('   Created:', booking.created_at);
  console.log('');

  const expectedDiscount = 43;
  const expectedPriceAfterDiscount = 350000 * (1 - expectedDiscount / 100);

  console.log('🧮 Calculation Check:');
  console.log('   Expected discount:', expectedDiscount, '%');
  console.log('   Expected price after discount:', expectedPriceAfterDiscount.toLocaleString('vi-VN'), 'đ');
  console.log('');

  if (booking.discount_percent !== expectedDiscount) {
    console.log('❌ PROBLEM FOUND!');
    console.log(`   Discount in DB: ${booking.discount_percent}%`);
    console.log(`   Expected: ${expectedDiscount}%`);
    console.log('');
    console.log('🔧 Need to update discount_percent in bookings table!');
  } else {
    console.log('✅ Discount is correct in database');
    console.log('');
    console.log('💡 Problem might be:');
    console.log('   1. Session logs were created BEFORE discount was updated');
    console.log('   2. Outbox events have stale discount values');
    console.log('   3. Need to recalculate revenue for existing sessions');
  }

  // Check session logs
  console.log('\n=== Checking Session Logs ===\n');
  
  const { data: sessions, error: sessionError } = await supabase
    .from('session_logs')
    .select('id, session_number, status, completed_date')
    .eq('booking_id', booking.id)
    .order('session_number', { ascending: true });

  if (sessionError) {
    console.error('❌ Error finding sessions:', sessionError.message);
    return;
  }

  console.log(`📊 Found ${sessions?.length || 0} sessions`);
  sessions?.forEach(session => {
    console.log(`   Session ${session.session_number}: ${session.status} (completed: ${session.completed_date || 'N/A'})`);
  });

  // Check outbox events for these sessions
  console.log('\n=== Checking Outbox Events ===\n');

  const sessionIds = sessions?.map(s => s.id) || [];
  
  const { data: outboxEvents, error: outboxError } = await supabase
    .from('accounting_outbox')
    .select('id, reference_id, event_type, status, payload')
    .eq('event_type', 'SESSION_DONE')
    .in('reference_id', sessionIds);

  if (outboxError) {
    console.error('❌ Error finding outbox events:', outboxError.message);
    return;
  }

  console.log(`📬 Found ${outboxEvents?.length || 0} SESSION_DONE outbox events`);
  outboxEvents?.forEach(event => {
    const payload = event.payload as any;
    console.log(`   Event ${event.id.substring(0, 8)}...:`);
    console.log(`      Session: ${event.reference_id.substring(0, 8)}...`);
    console.log(`      Status: ${event.status}`);
    console.log(`      earnedRevenueAmount: ${payload?.earnedRevenueAmount?.toLocaleString('vi-VN')} đ`);
    console.log(`      commissionAmount: ${payload?.commissionAmount?.toLocaleString('vi-VN')} đ`);
    console.log('');
  });

  // Check journal entries
  console.log('=== Checking Journal Entries ===\n');

  const { data: journals, error: journalError } = await supabase
    .from('journal_entries')
    .select('id, reference_type, reference_id, status, description')
    .eq('reference_type', 'SESSION_DONE')
    .in('reference_id', sessionIds);

  if (journalError) {
    console.error('❌ Error finding journal entries:', journalError.message);
    return;
  }

  console.log(`📖 Found ${journals?.length || 0} SESSION_DONE journal entries`);
  journals?.forEach(journal => {
    console.log(`   Journal ${journal.id.substring(0, 8)}...:`);
    console.log(`      Session: ${journal.reference_id?.substring(0, 8) || 'N/A'}...`);
    console.log(`      Status: ${journal.status}`);
    console.log(`      Description: ${journal.description}`);
    console.log('');
  });

  // Check journal lines for revenue amounts
  if (journals && journals.length > 0) {
    const journalIds = journals.map(j => j.id);
    
    const { data: lines, error: linesError } = await supabase
      .from('journal_lines')
      .select('entry_id, account_id, debit_amount, credit_amount')
      .in('entry_id', journalIds);

    if (linesError) {
      console.error('❌ Error finding journal lines:', linesError.message);
      return;
    }

    // Get account 5113 (revenue account)
    const { data: revenueAccount } = await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('account_code', '5113')
      .single();

    const revenueAccountId = revenueAccount?.id;

    console.log('💰 Revenue Recognition (Account 5113) per Journal:');
    journals?.forEach(journal => {
      const journalLines = lines?.filter(l => l.entry_id === journal.id);
      const revenueLine = journalLines?.find(l => l.account_id === revenueAccountId);
      
      if (revenueLine) {
        const revenueAmount = revenueLine.credit_amount || 0;
        console.log(`   Journal ${journal.id.substring(0, 8)}...: ${revenueAmount.toLocaleString('vi-VN')} đ`);
        
        if (revenueAmount === 350000) {
          console.log('      ❌ WRONG! Should be 199,500đ (with 43% discount)');
        } else if (revenueAmount === 199500) {
          console.log('      ✅ Correct (with 43% discount)');
        }
      }
    });
  }
}

checkMassageBookingDiscount()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
