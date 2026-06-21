/**
 * Remove Beauty Spa demo revenue records (3 records totaling 1,190,000đ)
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

const DEMO_REVENUE_IDS = [
  '351223e2-7182-4690-a919-20f9ab2a880f', // 300k - BSP-DEMO-15DCDC7F-001
  '9eb03645-ac16-4b7e-afb1-d53e986d1ec1', // 390k - BSP-DEMO-15DCDC7F-003
  '6f07a7ba-46d7-439a-8018-ede6164d76bd', // 500k - BSP-DEMO-15DCDC7F-002
];

async function removeBeautyDemoRevenue() {
  console.log('\n=== Removing Beauty Spa Demo Revenue Records ===\n');

  // 1. Verify current June revenue total
  const { data: juneRevenuesBefore, error: beforeError } = await supabase
    .from('revenue')
    .select('amount')
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .eq('status', 'confirmed');

  if (beforeError) {
    console.error('❌ Error calculating June revenue:', beforeError.message);
    return;
  }

  const totalBefore = juneRevenuesBefore?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  console.log('💰 June 2026 Revenue BEFORE Removal:');
  console.log(`   Total: ${totalBefore.toLocaleString('vi-VN')} đ`);
  console.log(`   Records: ${juneRevenuesBefore?.length || 0}`);
  console.log('');

  // 2. Get details of records to be deleted
  const { data: recordsToDelete, error: fetchError } = await supabase
    .from('revenue')
    .select('id, amount, received_date, notes, booking_id')
    .in('id', DEMO_REVENUE_IDS);

  if (fetchError) {
    console.error('❌ Error fetching demo records:', fetchError.message);
    return;
  }

  if (!recordsToDelete || recordsToDelete.length === 0) {
    console.log('⚠️  No demo records found to delete');
    return;
  }

  console.log(`🗑️  Records to be deleted (${recordsToDelete.length}):`);
  let totalToDelete = 0;
  
  for (const record of recordsToDelete) {
    // Get booking details
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_number, package_name')
      .eq('id', record.booking_id!)
      .single();

    console.log(`   - ${record.amount?.toLocaleString('vi-VN')} đ (${record.received_date})`);
    console.log(`     Booking: ${booking?.booking_number}`);
    console.log(`     Package: ${booking?.package_name}`);
    console.log(`     Notes: ${record.notes}`);
    console.log('');
    
    totalToDelete += record.amount || 0;
  }

  console.log(`   Total to delete: ${totalToDelete.toLocaleString('vi-VN')} đ`);
  console.log('');

  // 3. Delete the demo revenue records
  console.log('🔧 Deleting demo revenue records...');
  
  const { error: deleteError } = await supabase
    .from('revenue')
    .delete()
    .in('id', DEMO_REVENUE_IDS);

  if (deleteError) {
    console.error('❌ Error deleting records:', deleteError.message);
    return;
  }

  console.log('✅ Demo revenue records deleted successfully!');
  console.log('');

  // 4. Verify June revenue total after deletion
  const { data: juneRevenuesAfter, error: afterError } = await supabase
    .from('revenue')
    .select('amount, received_date')
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .eq('status', 'confirmed')
    .order('received_date', { ascending: true });

  if (afterError) {
    console.error('❌ Error calculating June revenue after deletion:', afterError.message);
    return;
  }

  const totalAfter = juneRevenuesAfter?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  
  console.log('💰 June 2026 Revenue AFTER Removal:');
  console.log(`   Total: ${totalAfter.toLocaleString('vi-VN')} đ`);
  console.log(`   Records: ${juneRevenuesAfter?.length || 0}`);
  console.log('');

  console.log('📊 Breakdown:');
  juneRevenuesAfter?.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.amount?.toLocaleString('vi-VN')} đ (${r.received_date})`);
  });
  console.log('');

  // 5. Final verification
  const EXPECTED_TOTAL = 9499500;
  const difference = totalAfter - EXPECTED_TOTAL;

  console.log('🎯 Final Verification:');
  console.log(`   Expected total: ${EXPECTED_TOTAL.toLocaleString('vi-VN')} đ`);
  console.log(`   Actual total: ${totalAfter.toLocaleString('vi-VN')} đ`);
  console.log(`   Difference: ${difference.toLocaleString('vi-VN')} đ`);
  console.log('');

  if (Math.abs(difference) < 1) {
    console.log('✅ ✅ ✅ PERFECT MATCH! ✅ ✅ ✅');
    console.log('');
    console.log('🎉 Revenue now matches expected 9,499,500đ!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log(`   1. Fixed massage revenue: 350,000đ → 199,500đ`);
    console.log(`   2. Removed 3 Beauty Spa demo records: ${totalToDelete.toLocaleString('vi-VN')} đ`);
    console.log(`   3. Final June 2026 revenue: ${totalAfter.toLocaleString('vi-VN')} đ ✅`);
  } else {
    console.log(`⚠️  Still ${Math.abs(difference).toLocaleString('vi-VN')} đ ${difference > 0 ? 'over' : 'under'} expected`);
    console.log('');
    console.log('🔍 Need further investigation...');
  }
}

removeBeautyDemoRevenue()
  .then(() => {
    console.log('\n✅ Removal complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
