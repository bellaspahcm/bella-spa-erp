/**
 * Check if revenue payments have corresponding PACKAGE_SALE journal entries
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

const MOTHER_BABY_TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e';

async function checkMissingJournals() {
  console.log('\n=== Checking Missing PACKAGE_SALE Journal Entries ===\n');

  // 1. Get all revenue records from June 2026 (Mother & Baby tenant)
  const { data: revenues, error: revError } = await supabase
    .from('revenue')
    .select('id, amount, received_date, revenue_type, notes, booking_id')
    .eq('status', 'confirmed')
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .order('received_date', { ascending: true });

  if (revError) {
    console.error('❌ Error getting revenue:', revError.message);
    return;
  }

  // Filter to only Mother & Baby tenant by checking booking tenant
  const revenuesWithBooking = await Promise.all(
    (revenues || []).map(async (rev) => {
      if (!rev.booking_id) return null;
      
      const { data: booking } = await supabase
        .from('bookings')
        .select('tenant_id, booking_number')
        .eq('id', rev.booking_id)
        .single();
      
      if (booking?.tenant_id === MOTHER_BABY_TENANT_ID) {
        return { ...rev, booking_number: booking.booking_number };
      }
      return null;
    })
  );

  const motherBabyRevenues = revenuesWithBooking.filter(r => r !== null);

  console.log(`💰 Found ${motherBabyRevenues.length} revenue records (Mother & Baby)`);
  console.log('');

  // 2. For each revenue, check if there's a PACKAGE_SALE journal entry
  for (const revenue of motherBabyRevenues) {
    if (!revenue) continue;

    console.log(`📋 Revenue ID: ${revenue.id.substring(0, 8)}...`);
    console.log(`   Amount: ${revenue.amount?.toLocaleString('vi-VN')} đ`);
    console.log(`   Date: ${revenue.received_date}`);
    console.log(`   Type: ${revenue.revenue_type}`);
    console.log(`   Booking: ${revenue.booking_number}`);
    console.log(`   Notes: ${revenue.notes || '(none)'}`);

    // Look for PACKAGE_SALE journal entry with this revenue ID as reference
    const { data: journals, error: journalError } = await supabase
      .from('journal_entries')
      .select('id, status, description, entry_date')
      .eq('reference_type', 'PACKAGE_SALE')
      .eq('reference_id', revenue.id)
      .eq('tenant_id', MOTHER_BABY_TENANT_ID);

    if (journalError) {
      console.error(`   ❌ Error checking journal: ${journalError.message}`);
      continue;
    }

    if (!journals || journals.length === 0) {
      console.log(`   ❌ MISSING JOURNAL ENTRY!`);
      console.log(`   → Need to create PACKAGE_SALE journal for this revenue`);
    } else {
      console.log(`   ✅ Has journal entry: ${journals[0].id.substring(0, 8)}... (${journals[0].status})`);
      console.log(`      ${journals[0].description}`);
    }
    console.log('');
  }

  // 3. Summary
  const totalRevenue = motherBabyRevenues.reduce((sum, r) => sum + (r?.amount || 0), 0);
  console.log('=== Summary ===\n');
  console.log(`Total revenue records: ${motherBabyRevenues.length}`);
  console.log(`Total amount: ${totalRevenue.toLocaleString('vi-VN')} đ`);
  console.log('');

  // Check which ones are missing
  const missing = [];
  for (const revenue of motherBabyRevenues) {
    if (!revenue) continue;
    
    const { data: journals } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'PACKAGE_SALE')
      .eq('reference_id', revenue.id)
      .eq('tenant_id', MOTHER_BABY_TENANT_ID);

    if (!journals || journals.length === 0) {
      missing.push(revenue);
    }
  }

  console.log(`🔍 Missing PACKAGE_SALE journals: ${missing.length}`);
  if (missing.length > 0) {
    console.log('');
    console.log('Missing for:');
    missing.forEach(r => {
      console.log(`   - ${r?.amount?.toLocaleString('vi-VN')} đ (${r?.received_date}) - ${r?.booking_number}`);
    });

    const missingTotal = missing.reduce((sum, r) => sum + (r?.amount || 0), 0);
    console.log('');
    console.log(`💸 Total missing: ${missingTotal.toLocaleString('vi-VN')} đ`);
    console.log('');
    console.log('🔧 Action needed: Create PACKAGE_SALE journal entries for these revenue records');
    console.log('   These should be: Debit 111 (Cash) / Credit 3387 (Unearned Revenue)');
  }
}

checkMissingJournals()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
