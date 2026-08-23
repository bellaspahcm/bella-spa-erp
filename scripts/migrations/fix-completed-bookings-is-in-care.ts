/**
 * Migration: Fix is_in_care flag for completed bookings
 * 
 * Bug: Bookings with status='completed' still have is_in_care=true, causing:
 * - Customer cards showing "Đang có gói liệu trình" badge incorrectly
 * - KTV blocked from booking due to false conflicts
 * 
 * Root cause: calculateBookingCompletionUpdate() didn't clear is_in_care flag
 * when setting status='completed' (fixed in commit 4ddb6ac5)
 * 
 * This migration cleans up existing data created before the fix.
 * 
 * Usage:
 *   npx tsx scripts/migrations/fix-completed-bookings-is-in-care.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🔍 Checking for bookings with incorrect is_in_care flag...\n');

  // 1. Find completed bookings with is_in_care=true
  const { data: completedWithFlag, error: queryError1 } = await supabase
    .from('bookings')
    .select('id, tenant_id, customer_id, package_name, status, completed_sessions, total_sessions, is_in_care')
    .eq('status', 'completed')
    .eq('is_in_care', true);

  if (queryError1) {
    console.error('❌ Query error:', queryError1.message);
    process.exit(1);
  }

  console.log(`📊 Found ${completedWithFlag?.length || 0} completed bookings with is_in_care=true`);
  
  if (completedWithFlag && completedWithFlag.length > 0) {
    console.log('\nAffected bookings:');
    completedWithFlag.forEach((booking, idx) => {
      console.log(`  ${idx + 1}. ${booking.package_name} (${booking.completed_sessions}/${booking.total_sessions}) - Customer: ${booking.customer_id?.slice(0, 8)}`);
    });
  }

  // 2. Find bookings where completed_sessions >= total_sessions but not marked complete
  const { data: shouldBeCompleted, error: queryError2 } = await supabase
    .from('bookings')
    .select('id, tenant_id, package_name, status, completed_sessions, total_sessions, is_in_care')
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .gt('total_sessions', 0)
    .filter('completed_sessions', 'gte', 'total_sessions');

  if (queryError2) {
    console.error('❌ Query error:', queryError2.message);
    process.exit(1);
  }

  console.log(`\n📊 Found ${shouldBeCompleted?.length || 0} bookings that should be completed but aren't`);
  
  if (shouldBeCompleted && shouldBeCompleted.length > 0) {
    console.log('\nBookings to update:');
    shouldBeCompleted.forEach((booking, idx) => {
      console.log(`  ${idx + 1}. ${booking.package_name} (${booking.completed_sessions}/${booking.total_sessions}) - Status: ${booking.status}`);
    });
  }

  const totalToFix = (completedWithFlag?.length || 0) + (shouldBeCompleted?.length || 0);

  if (totalToFix === 0) {
    console.log('\n✅ No bookings need fixing. Database is clean!');
    return;
  }

  console.log(`\n⚠️  Total bookings to fix: ${totalToFix}`);
  console.log('\nStarting migration in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 3. Fix completed bookings with is_in_care=true
  if (completedWithFlag && completedWithFlag.length > 0) {
    console.log('\n🔧 Fixing completed bookings with is_in_care=true...');
    
    const { error: updateError1 } = await supabase
      .from('bookings')
      .update({ 
        is_in_care: false,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'completed')
      .eq('is_in_care', true);

    if (updateError1) {
      console.error('❌ Update error:', updateError1.message);
      process.exit(1);
    }

    console.log(`✅ Fixed ${completedWithFlag.length} completed bookings`);
  }

  // 4. Fix bookings where completed_sessions >= total_sessions
  if (shouldBeCompleted && shouldBeCompleted.length > 0) {
    console.log('\n🔧 Fixing bookings that should be completed...');
    
    const { error: updateError2 } = await supabase
      .from('bookings')
      .update({ 
        status: 'completed',
        is_in_care: false,
        updated_at: new Date().toISOString()
      })
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .gt('total_sessions', 0)
      .filter('completed_sessions', 'gte', 'total_sessions');

    if (updateError2) {
      console.error('❌ Update error:', updateError2.message);
      process.exit(1);
    }

    console.log(`✅ Fixed ${shouldBeCompleted.length} incomplete bookings`);
  }

  // 5. Verification
  console.log('\n🔍 Verifying fix...');
  
  const { data: verification, error: verifyError } = await supabase
    .from('bookings')
    .select('status, is_in_care')
    .in('status', ['completed', 'in_progress']);

  if (verifyError) {
    console.error('❌ Verification error:', verifyError.message);
    process.exit(1);
  }

  const stats = verification?.reduce((acc, booking) => {
    const key = `${booking.status}_${booking.is_in_care}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Final booking status distribution:');
  console.log('  Completed + is_in_care=false:', stats?.['completed_false'] || 0);
  console.log('  Completed + is_in_care=true:', stats?.['completed_true'] || 0, stats?.['completed_true'] > 0 ? '⚠️' : '✅');
  console.log('  In Progress + is_in_care=true:', stats?.['in_progress_true'] || 0);
  console.log('  In Progress + is_in_care=false:', stats?.['in_progress_false'] || 0);

  console.log('\n✅ Migration completed successfully!');
  console.log('\n💡 Note: New completions will automatically set is_in_care=false (fixed in commit 4ddb6ac5)');
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
