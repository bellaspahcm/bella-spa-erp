/**
 * COMPLETE RESET AND CORRECTION SCRIPT
 * 
 * This script will:
 * 1. Reverse ALL incorrect entries related to the massage session
 * 2. Create correct entries from scratch with proper amounts
 * 
 * Correct flow:
 * - Package sale: Debit 111 = 199,500 | Credit 3387 = 199,500
 * - Session done: Debit 3387 = 199,500 | Credit 5113 = 199,500
 * - Commission: Debit 6421 = 150,000 | Credit 334 = 150,000
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface EntryToReverse {
  id: string;
  description: string;
  lines: Array<{
    account_id: string;
    account_code: string;
    debit_amount: number;
    credit_amount: number;
    ktv_id: string | null;
    branch_id: string | null;
  }>;
}

async function findAllMassageEntries() {
  console.log('\n=== FINDING ALL MASSAGE-RELATED ENTRIES ===\n');

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      status,
      reference_type,
      created_at,
      journal_lines (
        id,
        debit_amount,
        credit_amount,
        account_id,
        ktv_id,
        branch_id,
        account:accounting_accounts (
          account_code,
          account_name
        )
      )
    `)
    .or('description.ilike.%Massage Bầu Tại Nhà%Lẻ%,description.ilike.%51c25138%,description.ilike.%b8845290%')
    .eq('status', 'POSTED')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return [];
  }

  console.log(`Found ${entries?.length || 0} posted entries:\n`);

  const entriesToReverse: EntryToReverse[] = [];

  entries?.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. Entry ID: ${entry.id.substring(0, 8)}...`);
    console.log(`   Date: ${entry.entry_date}`);
    console.log(`   Type: ${entry.reference_type}`);
    console.log(`   Description: ${entry.description}`);
    console.log(`   Lines:`);

    const lines = entry.journal_lines.map((line: any) => {
      const accountCode = line.account?.account_code || 'N/A';
      const accountName = line.account?.account_name || 'N/A';
      const debit = Number(line.debit_amount);
      const credit = Number(line.credit_amount);

      console.log(`      - ${accountCode} ${accountName}`);
      console.log(`        Debit: ${debit.toLocaleString('vi-VN')} | Credit: ${credit.toLocaleString('vi-VN')}`);

      return {
        account_id: line.account_id,
        account_code: accountCode,
        debit_amount: debit,
        credit_amount: credit,
        ktv_id: line.ktv_id,
        branch_id: line.branch_id,
      };
    });

    entriesToReverse.push({
      id: entry.id,
      description: entry.description,
      lines,
    });

    console.log('');
  });

  return entriesToReverse;
}

async function reverseAllEntries(entries: EntryToReverse[]) {
  console.log('\n=== REVERSING ALL ENTRIES ===\n');

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('No tenant found');
    return false;
  }

  const tenantId = tenants.id;
  const today = new Date().toISOString().split('T')[0];

  for (const entry of entries) {
    console.log(`Reversing: ${entry.id.substring(0, 8)}...`);
    console.log(`  "${entry.description}"`);

    // Create reversal entry
    const { data: reversalEntry, error: createError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        entry_date: today,
        description: `[RESET] Hủy bỏ bút toán sai - Reversal: ${entry.id.substring(0, 8)}`,
        reference_type: 'REVERSAL',
        reference_id: entry.id,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (createError || !reversalEntry) {
      console.error('  ❌ Error creating reversal:', createError);
      return false;
    }

    // Create reversed lines (swap debit/credit)
    const reversedLines = entry.lines.map(line => ({
      entry_id: reversalEntry.id,
      account_id: line.account_id,
      debit_amount: line.credit_amount,  // Swapped
      credit_amount: line.debit_amount,  // Swapped
      ktv_id: line.ktv_id,
      branch_id: line.branch_id,
    }));

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(reversedLines);

    if (linesError) {
      console.error('  ❌ Error creating lines:', linesError);
      return false;
    }

    // Post the entry
    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', reversalEntry.id);

    if (postError) {
      console.error('  ❌ Error posting:', postError);
      return false;
    }

    console.log(`  ✅ Reversed successfully`);
  }

  console.log(`\n✅ All ${entries.length} entries have been reversed!\n`);
  return true;
}

async function createCorrectEntries() {
  console.log('\n=== CREATING CORRECT ENTRIES ===\n');

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('No tenant found');
    return false;
  }

  const tenantId = tenants.id;
  const today = new Date().toISOString().split('T')[0];

  // Get all required accounts
  const { data: accounts } = await supabase
    .from('accounting_accounts')
    .select('id, account_code, account_name')
    .in('account_code', ['111', '3387', '5113', '6421', '334']);

  if (!accounts || accounts.length < 5) {
    console.error('Cannot find all required accounts');
    return false;
  }

  const accountMap: Record<string, any> = {};
  accounts.forEach(acc => {
    accountMap[acc.account_code] = acc;
  });

  // Get KTV ID (if we need it for commission entry)
  const { data: ktvData } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'ktv')
    .limit(1)
    .single();

  const ktvId = ktvData?.id || null;

  console.log('Accounts found:');
  Object.values(accountMap).forEach((acc: any) => {
    console.log(`  - ${acc.account_code}: ${acc.account_name}`);
  });
  console.log('');

  // ENTRY 1: Package Sale (Thu tiền sau chiết khấu)
  console.log('1. Creating PACKAGE SALE entry (Thu tiền 199,500)...');
  
  const { data: entry1, error: e1Error } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: today,
      description: '[CORRECTED] Bán gói: Thu phí dịch vụ lẻ sau CK 43% - Massage Bầu Tại Nhà (Lẻ) - 199.500đ',
      reference_type: 'PACKAGE_SALE',
      reference_id: tenantId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (e1Error || !entry1) {
    console.error('  ❌ Error:', e1Error);
    return false;
  }

  await supabase.from('journal_lines').insert([
    {
      entry_id: entry1.id,
      account_id: accountMap['111'].id,
      debit_amount: 199500,
      credit_amount: 0,
    },
    {
      entry_id: entry1.id,
      account_id: accountMap['3387'].id,
      debit_amount: 0,
      credit_amount: 199500,
    },
  ]);

  await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entry1.id);

  console.log('  ✅ Package sale entry created');
  console.log('     Nợ 111: 199,500 | Có 3387: 199,500\n');

  // ENTRY 2: Session Completion (Ghi nhận doanh thu + hoa hồng)
  console.log('2. Creating SESSION COMPLETION entry (Doanh thu + Hoa hồng)...');

  const { data: entry2, error: e2Error } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: today,
      description: '[CORRECTED] Kết chuyển dịch vụ hoàn thành: Hoàn thành buổi 1/1 - Massage Bầu Tại Nhà (Lẻ)',
      reference_type: 'SESSION_DONE',
      reference_id: tenantId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (e2Error || !entry2) {
    console.error('  ❌ Error:', e2Error);
    return false;
  }

  await supabase.from('journal_lines').insert([
    // Revenue recognition
    {
      entry_id: entry2.id,
      account_id: accountMap['3387'].id,
      debit_amount: 199500,
      credit_amount: 0,
    },
    {
      entry_id: entry2.id,
      account_id: accountMap['5113'].id,
      debit_amount: 0,
      credit_amount: 199500,
    },
    // Commission
    {
      entry_id: entry2.id,
      account_id: accountMap['6421'].id,
      debit_amount: 150000,
      credit_amount: 0,
      ktv_id: ktvId,
    },
    {
      entry_id: entry2.id,
      account_id: accountMap['334'].id,
      debit_amount: 0,
      credit_amount: 150000,
      ktv_id: ktvId,
    },
  ]);

  await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entry2.id);

  console.log('  ✅ Session completion entry created');
  console.log('     Nợ 3387: 199,500 | Có 5113: 199,500');
  console.log('     Nợ 6421: 150,000 | Có 334: 150,000\n');

  return true;
}

async function verifyFinalBalances() {
  console.log('\n=== VERIFYING FINAL BALANCES ===\n');

  // This would query the trial balance to verify
  console.log('Expected final balances:');
  console.log('  111 (Tiền mặt): Debit 199,500');
  console.log('  3387 (Doanh thu chưa thực hiện): Net 0 (balanced)');
  console.log('  5113 (Doanh thu): Credit 199,500');
  console.log('  6421 (Chi phí hoa hồng): Debit 150,000');
  console.log('  334 (Phải trả NLĐ): Credit 150,000');
  console.log('');
  console.log('Please verify these balances in the accounting reports.');
  console.log('');
}

async function main() {
  try {
    console.log('='.repeat(70));
    console.log('COMPLETE ACCOUNTING RESET - MASSAGE SESSION');
    console.log('='.repeat(70));

    // Step 1: Find all entries
    const entries = await findAllMassageEntries();

    if (entries.length === 0) {
      console.log('No entries found to reverse.');
      return;
    }

    console.log('=== SUMMARY ===');
    console.log(`Found ${entries.length} entries that will be reversed.`);
    console.log('Then 2 new CORRECT entries will be created:');
    console.log('  1. Package sale: 199,500đ (after 43% discount)');
    console.log('  2. Session done: Revenue 199,500đ + Commission 150,000đ');
    console.log('');

    const shouldFix = process.argv.includes('--fix');

    if (shouldFix) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('⚠️  This will REVERSE ALL entries and create new correct ones.\nAre you absolutely sure? (yes/no): ', async (answer: string) => {
        if (answer.toLowerCase() === 'yes') {
          // Step 2: Reverse all entries
          const reverseSuccess = await reverseAllEntries(entries);

          if (!reverseSuccess) {
            console.error('\n❌ Reversal failed. Stopping.');
            rl.close();
            process.exit(1);
          }

          // Step 3: Create correct entries
          const createSuccess = await createCorrectEntries();

          if (!createSuccess) {
            console.error('\n❌ Creating correct entries failed.');
            rl.close();
            process.exit(1);
          }

          // Step 4: Verify
          await verifyFinalBalances();

          console.log('='.repeat(70));
          console.log('✅ COMPLETE! ALL ACCOUNTING ENTRIES HAVE BEEN CORRECTED');
          console.log('='.repeat(70));
          console.log('');
          console.log('Next steps:');
          console.log('  1. Go to /dashboard/accounting/journals to verify');
          console.log('  2. Check Trial Balance (Cân đối phát sinh) report');
          console.log('  3. Confirm all balances are correct');
          console.log('');
        } else {
          console.log('Operation cancelled.');
        }
        rl.close();
        process.exit(0);
      });
    } else {
      console.log('ℹ️  Run with --fix flag to execute the complete reset.');
      console.log('   Example: npx tsx scripts/reset-massage-accounting-complete.ts --fix');
      console.log('');
      console.log('⚠️  WARNING: This is a destructive operation. All existing entries will be reversed.');
    }
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
