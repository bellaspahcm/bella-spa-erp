/**
 * Check Trial Balance for June 2026 - compare with journal entries
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

async function checkTrialBalance() {
  console.log('\n=== Checking Trial Balance for June 2026 ===\n');

  // Get current user/tenant (Mother & Baby)
  // For this script, we'll use a known tenant_id
  // Replace with actual tenant_id from your system
  const MOTHER_BABY_TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e'; // From revenue records

  console.log(`Tenant ID: ${MOTHER_BABY_TENANT_ID}`);
  console.log('');

  // 1. Get Trial Balance from RPC (what the report shows)
  const { data: trialBalance, error: tbError } = await supabase.rpc('get_trial_balance', {
    p_tenant_id: MOTHER_BABY_TENANT_ID,
    p_as_of_date: '2026-06-30',
  });

  if (tbError) {
    console.error('❌ Error getting trial balance:', tbError.message);
    return;
  }

  console.log('📊 Trial Balance (from RPC):');
  console.log(`   Total accounts: ${trialBalance?.length || 0}`);
  console.log('');

  // Find revenue accounts (5xxx)
  const revenueAccounts = trialBalance?.filter((acc: any) => 
    acc.account_code?.startsWith('5')
  ) || [];

  console.log('💰 Revenue Accounts (5xxx):');
  revenueAccounts.forEach((acc: any) => {
    const periodCredit = acc.period_credit || 0;
    if (periodCredit > 0) {
      console.log(`   ${acc.account_code} - ${acc.account_name}: ${periodCredit.toLocaleString('vi-VN')} đ (Credit)`);
    }
  });
  console.log('');

  const totalRevenueCredit = revenueAccounts.reduce((sum: number, acc: any) => 
    sum + (acc.period_credit || 0), 0
  );
  console.log(`📈 Total Revenue (Credit): ${totalRevenueCredit.toLocaleString('vi-VN')} đ`);
  console.log('');

  // 2. Query journal entries directly to verify
  console.log('=== Verifying Against Journal Entries ===\n');

  // Get revenue account IDs (5113, 5111)
  const { data: revenueAccountsData } = await supabase
    .from('accounting_accounts')
    .select('id, account_code, account_name')
    .eq('tenant_id', MOTHER_BABY_TENANT_ID)
    .in('account_code', ['5113', '5111']);

  if (!revenueAccountsData || revenueAccountsData.length === 0) {
    console.log('⚠️  No revenue accounts found for this tenant');
    return;
  }

  console.log('Revenue accounts found:');
  revenueAccountsData.forEach(acc => {
    console.log(`   ${acc.account_code}: ${acc.id.substring(0, 8)}...`);
  });
  console.log('');

  const revenueAccountIds = revenueAccountsData.map(a => a.id);

  // Get all journal entries for June 2026
  const { data: journalLines, error: linesError } = await supabase
    .from('journal_lines')
    .select(`
      credit_amount,
      debit_amount,
      journal_entries!inner(
        entry_date,
        status,
        tenant_id,
        description,
        reference_type
      )
    `)
    .in('account_id', revenueAccountIds)
    .gte('journal_entries.entry_date', '2026-06-01')
    .lte('journal_entries.entry_date', '2026-06-30')
    .eq('journal_entries.status', 'POSTED')
    .eq('journal_entries.tenant_id', MOTHER_BABY_TENANT_ID);

  if (linesError) {
    console.error('❌ Error getting journal lines:', linesError.message);
    return;
  }

  console.log(`📖 Found ${journalLines?.length || 0} journal lines for revenue accounts in June`);
  console.log('');

  const totalCredit = journalLines?.reduce((sum, line) => sum + (line.credit_amount || 0), 0) || 0;
  const totalDebit = journalLines?.reduce((sum, line) => sum + (line.debit_amount || 0), 0) || 0;
  const netRevenue = totalCredit - totalDebit;

  console.log('💵 Journal Entry Totals (June 2026):');
  console.log(`   Total Credit: ${totalCredit.toLocaleString('vi-VN')} đ`);
  console.log(`   Total Debit: ${totalDebit.toLocaleString('vi-VN')} đ`);
  console.log(`   Net Revenue: ${netRevenue.toLocaleString('vi-VN')} đ`);
  console.log('');

  // Show details
  console.log('📋 Journal Line Details:');
  journalLines?.forEach((line, i) => {
    const entry = (line as any).journal_entries;
    console.log(`   ${i + 1}. ${entry.entry_date} - ${entry.reference_type || 'N/A'}`);
    console.log(`      Description: ${entry.description}`);
    console.log(`      Credit: ${line.credit_amount?.toLocaleString('vi-VN')} đ`);
    if (line.debit_amount && line.debit_amount > 0) {
      console.log(`      Debit: ${line.debit_amount.toLocaleString('vi-VN')} đ`);
    }
    console.log('');
  });

  // 3. Compare with expected
  const EXPECTED_REVENUE = 9499500;
  
  console.log('=== Comparison ===\n');
  console.log(`📊 Trial Balance shows: ${totalRevenueCredit.toLocaleString('vi-VN')} đ`);
  console.log(`📖 Journal Entries show: ${netRevenue.toLocaleString('vi-VN')} đ`);
  console.log(`🎯 Expected: ${EXPECTED_REVENUE.toLocaleString('vi-VN')} đ`);
  console.log('');

  if (Math.abs(netRevenue - EXPECTED_REVENUE) < 1) {
    console.log('✅ Journal entries match expected revenue!');
  } else {
    console.log(`⚠️  Journal entries differ by: ${Math.abs(netRevenue - EXPECTED_REVENUE).toLocaleString('vi-VN')} đ`);
  }

  if (Math.abs(totalRevenueCredit - EXPECTED_REVENUE) < 1) {
    console.log('✅ Trial balance matches expected revenue!');
  } else {
    console.log(`⚠️  Trial balance differs by: ${Math.abs(totalRevenueCredit - EXPECTED_REVENUE).toLocaleString('vi-VN')} đ`);
  }
}

checkTrialBalance()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
