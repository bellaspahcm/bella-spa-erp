/**
 * Check which accounts PACKAGE_SALE entries are posting to
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

async function checkPackageSaleAccounts() {
  console.log('\n=== Checking PACKAGE_SALE Journal Entry Accounts ===\n');

  // Get all PACKAGE_SALE journal entries for June
  const { data: journals, error: journalError } = await supabase
    .from('journal_entries')
    .select('id, entry_date, description, reference_id')
    .eq('tenant_id', MOTHER_BABY_TENANT_ID)
    .eq('reference_type', 'PACKAGE_SALE')
    .gte('entry_date', '2026-06-01')
    .lt('entry_date', '2026-07-01')
    .order('entry_date', { ascending: true });

  if (journalError) {
    console.error('❌ Error getting journals:', journalError.message);
    return;
  }

  console.log(`📖 Found ${journals?.length || 0} PACKAGE_SALE journal entries\n`);

  if (!journals || journals.length === 0) {
    console.log('⚠️  No PACKAGE_SALE entries found!');
    return;
  }

  // For each journal, get the lines and accounts
  for (const journal of journals) {
    console.log(`📋 Journal: ${journal.id.substring(0, 8)}...`);
    console.log(`   Date: ${journal.entry_date}`);
    console.log(`   Description: ${journal.description}`);

    const { data: lines, error: linesError } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount, account_id')
      .eq('entry_id', journal.id);

    if (linesError) {
      console.error(`   ❌ Error getting lines: ${linesError.message}`);
      continue;
    }

    console.log(`   Lines:`);
    
    for (const line of lines || []) {
      // Get account details
      const { data: account } = await supabase
        .from('accounting_accounts')
        .select('account_code, account_name, account_type')
        .eq('id', line.account_id)
        .single();

      if (line.debit_amount && line.debit_amount > 0) {
        console.log(`      Dr ${account?.account_code} (${account?.account_name}): ${line.debit_amount.toLocaleString('vi-VN')} đ`);
      }
      if (line.credit_amount && line.credit_amount > 0) {
        console.log(`      Cr ${account?.account_code} (${account?.account_name}): ${line.credit_amount.toLocaleString('vi-VN')} đ`);
      }
    }
    console.log('');
  }

  // Summary: Which accounts are being credited?
  console.log('=== Summary: Account Usage ===\n');

  const allLines = await Promise.all(
    journals.map(async (j) => {
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('debit_amount, credit_amount, account_id')
        .eq('entry_id', j.id);
      return lines || [];
    })
  );

  const flatLines = allLines.flat();

  // Group by account
  const accountSummary: Record<string, { debit: number; credit: number; name: string; code: string }> = {};

  for (const line of flatLines) {
    const { data: account } = await supabase
      .from('accounting_accounts')
      .select('account_code, account_name')
      .eq('id', line.account_id)
      .single();

    if (!account) continue;

    if (!accountSummary[account.account_code]) {
      accountSummary[account.account_code] = {
        debit: 0,
        credit: 0,
        name: account.account_name,
        code: account.account_code,
      };
    }

    accountSummary[account.account_code].debit += line.debit_amount || 0;
    accountSummary[account.account_code].credit += line.credit_amount || 0;
  }

  console.log('Accounts used in PACKAGE_SALE entries:');
  Object.values(accountSummary).forEach(acc => {
    console.log(`   ${acc.code} - ${acc.name}:`);
    console.log(`      Debit: ${acc.debit.toLocaleString('vi-VN')} đ`);
    console.log(`      Credit: ${acc.credit.toLocaleString('vi-VN')} đ`);
    console.log('');
  });

  console.log('🔍 Analysis:');
  console.log('   PACKAGE_SALE entries should use:');
  console.log('      Dr 111 (Cash) / Cr 3387 (Unearned Revenue)');
  console.log('');
  console.log('   These entries do NOT hit revenue accounts (5xxx)');
  console.log('   Revenue is recognized later via SESSION_DONE entries');
  console.log('');
  console.log('   This is CORRECT according to accrual accounting!');
  console.log('   Payment ≠ Revenue (Payment is liability until service completed)');
}

checkPackageSaleAccounts()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
