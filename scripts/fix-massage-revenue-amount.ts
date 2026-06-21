/**
 * Fix massage revenue record from 350,000đ to 199,500đ (with 43% discount)
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

const MASSAGE_REVENUE_ID = 'fd8459f5-cee7-4ec3-8755-0883248fedd2';
const CORRECT_AMOUNT = 199500;
const WRONG_AMOUNT = 350000;

async function fixMassageRevenueAmount() {
  console.log('\n=== Fixing Massage Revenue Amount ===\n');

  // 1. Verify current state
  const { data: currentRevenue, error: fetchError } = await supabase
    .from('revenue')
    .select('id, amount, booking_id, status, received_date')
    .eq('id', MASSAGE_REVENUE_ID)
    .single();

  if (fetchError) {
    console.error('❌ Error fetching revenue record:', fetchError.message);
    return;
  }

  if (!currentRevenue) {
    console.error('❌ Revenue record not found!');
    return;
  }

  console.log('📋 Current Revenue Record:');
  console.log(`   ID: ${currentRevenue.id}`);
  console.log(`   Amount: ${currentRevenue.amount?.toLocaleString('vi-VN')} đ`);
  console.log(`   Status: ${currentRevenue.status}`);
  console.log(`   Received Date: ${currentRevenue.received_date}`);
  console.log('');

  if (currentRevenue.amount !== WRONG_AMOUNT) {
    console.log(`⚠️  Warning: Current amount is ${currentRevenue.amount}, expected ${WRONG_AMOUNT}`);
    console.log('   Continuing anyway...');
    console.log('');
  }

  // 2. Calculate June revenue BEFORE fix  
  const { data: juneRevenuesBefore, error: juneBeforeError } = await supabase
    .from('revenue')
    .select('amount, status')
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .eq('status', 'confirmed');

  if (juneBeforeError) {
    console.error('❌ Error calculating June revenue:', juneBeforeError.message);
    return;
  }

  const totalBefore = juneRevenuesBefore?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  console.log('💰 June 2026 Revenue BEFORE Fix:');
  console.log(`   Total: ${totalBefore.toLocaleString('vi-VN')} đ`);
  console.log(`   Records: ${juneRevenuesBefore?.length || 0}`);
  console.log('');

  // 3. Update revenue amount
  console.log('🔧 Updating revenue amount...');
  console.log(`   From: ${WRONG_AMOUNT.toLocaleString('vi-VN')} đ`);
  console.log(`   To: ${CORRECT_AMOUNT.toLocaleString('vi-VN')} đ`);
  console.log('');

  const { data: updated, error: updateError } = await supabase
    .from('revenue')
    .update({ amount: CORRECT_AMOUNT })
    .eq('id', MASSAGE_REVENUE_ID)
    .select('id, amount')
    .single();

  if (updateError) {
    console.error('❌ Error updating revenue:', updateError.message);
    return;
  }

  console.log('✅ Revenue updated successfully!');
  console.log(`   New amount: ${updated?.amount?.toLocaleString('vi-VN')} đ`);
  console.log('');

  // 4. Calculate June revenue AFTER fix
  const { data: juneRevenuesAfter, error: juneAfterError } = await supabase
    .from('revenue')
    .select('amount, status, received_date, booking_id')
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .eq('status', 'confirmed')
    .order('received_date', { ascending: true });

  if (juneAfterError) {
    console.error('❌ Error calculating June revenue after fix:', juneAfterError.message);
    return;
  }

  const totalAfter = juneRevenuesAfter?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  
  console.log('💰 June 2026 Revenue AFTER Fix:');
  console.log(`   Total: ${totalAfter.toLocaleString('vi-VN')} đ`);
  console.log(`   Records: ${juneRevenuesAfter?.length || 0}`);
  console.log('');

  console.log('📊 Breakdown:');
  juneRevenuesAfter?.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.amount?.toLocaleString('vi-VN')} đ (${r.received_date})`);
  });
  console.log('');

  // 5. Verify against expected
  const EXPECTED_TOTAL = 9499500;
  const difference = totalAfter - EXPECTED_TOTAL;

  console.log('🎯 Verification:');
  console.log(`   Expected total: ${EXPECTED_TOTAL.toLocaleString('vi-VN')} đ`);
  console.log(`   Actual total: ${totalAfter.toLocaleString('vi-VN')} đ`);
  console.log(`   Difference: ${difference.toLocaleString('vi-VN')} đ`);
  console.log('');

  if (Math.abs(difference) < 1) {
    console.log('✅ PERFECT MATCH! Revenue now matches expected 9,499,500đ');
  } else {
    console.log(`⚠️  Still ${Math.abs(difference).toLocaleString('vi-VN')} đ ${difference > 0 ? 'over' : 'under'} expected`);
  }

  // 6. Show accounting consistency
  console.log('\n=== Accounting Consistency Check ===\n');

  const { data: journals, error: journalError } = await supabase
    .from('journal_entries')
    .select('id, description')
    .eq('reference_type', 'SESSION_DONE')
    .eq('booking_id', currentRevenue.booking_id);

  if (!journalError && journals && journals.length > 0) {
    console.log('📖 Related Journal Entries:');
    
    for (const journal of journals) {
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('account_id, credit_amount')
        .eq('entry_id', journal.id);

      const { data: revenueAccount } = await supabase
        .from('accounting_accounts')
        .select('id')
        .eq('account_code', '5113')
        .single();

      const revenueLine = lines?.find(l => l.account_id === revenueAccount?.id);
      
      if (revenueLine) {
        console.log(`   Journal ${journal.id.substring(0, 8)}...:`);
        console.log(`      Accounting revenue: ${revenueLine.credit_amount?.toLocaleString('vi-VN')} đ`);
        console.log(`      Revenue table: ${CORRECT_AMOUNT.toLocaleString('vi-VN')} đ`);
        
        if (Math.abs((revenueLine.credit_amount || 0) - CORRECT_AMOUNT) < 1) {
          console.log('      ✅ MATCH! Accounting and revenue table now consistent');
        } else {
          console.log(`      ⚠️  Mismatch: ${Math.abs((revenueLine.credit_amount || 0) - CORRECT_AMOUNT)} đ difference`);
        }
      }
    }
  }
}

fixMassageRevenueAmount()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
