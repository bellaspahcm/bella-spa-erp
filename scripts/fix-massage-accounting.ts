/**
 * Script to investigate and fix incorrect massage session accounting entry
 * 
 * Problem: Wrong amount recorded for massage session revenue
 * Correct amount: 150,000 VND
 * 
 * Steps:
 * 1. Query all journal entries related to "Massage Bầu Tại Nhà (Lẻ)"
 * 2. Identify the incorrect entries and reversals
 * 3. Create proper correction entry with correct amount
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface JournalEntryWithLines {
  id: string;
  entry_date: string;
  description: string;
  status: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  lines: Array<{
    id: string;
    account_code: string;
    account_name: string;
    debit_amount: number;
    credit_amount: number;
    ktv_id: string | null;
  }>;
}

async function investigateMassageEntries() {
  console.log('\n=== INVESTIGATING MASSAGE SESSION ACCOUNTING ===\n');

  // Get all entries related to massage session
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      status,
      reference_type,
      reference_id,
      created_at,
      journal_lines (
        id,
        debit_amount,
        credit_amount,
        ktv_id,
        account:accounting_accounts (
          account_code,
          account_name
        )
      )
    `)
    .ilike('description', '%Massage Bầu Tại Nhà%Lẻ%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching entries:', error);
    return [];
  }

  console.log(`Found ${entries?.length || 0} related journal entries:\n`);

  const formattedEntries: JournalEntryWithLines[] = [];

  entries?.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. Entry ID: ${entry.id.substring(0, 8)}...`);
    console.log(`   Date: ${entry.entry_date}`);
    console.log(`   Description: ${entry.description}`);
    console.log(`   Status: ${entry.status}`);
    console.log(`   Reference Type: ${entry.reference_type || 'N/A'}`);
    console.log(`   Created: ${entry.created_at}`);
    console.log(`   Lines:`);

    const lines = entry.journal_lines.map((line: any) => {
      const accountCode = line.account?.account_code || 'N/A';
      const accountName = line.account?.account_name || 'N/A';
      console.log(`      - ${accountCode} ${accountName}`);
      console.log(`        Debit: ${Number(line.debit_amount).toLocaleString('vi-VN')}`);
      console.log(`        Credit: ${Number(line.credit_amount).toLocaleString('vi-VN')}`);
      if (line.ktv_id) {
        console.log(`        KTV ID: ${line.ktv_id.substring(0, 8)}...`);
      }

      return {
        id: line.id,
        account_code: accountCode,
        account_name: accountName,
        debit_amount: Number(line.debit_amount),
        credit_amount: Number(line.credit_amount),
        ktv_id: line.ktv_id,
      };
    });

    formattedEntries.push({
      id: entry.id,
      entry_date: entry.entry_date,
      description: entry.description,
      status: entry.status,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      created_at: entry.created_at,
      lines,
    });

    console.log('');
  });

  return formattedEntries;
}

async function analyzeSituation(entries: JournalEntryWithLines[]) {
  console.log('\n=== ANALYSIS ===\n');

  if (entries.length === 0) {
    console.log('No entries found. Cannot analyze.');
    return;
  }

  // Separate original entries from reversals
  const originalEntries = entries.filter(e => e.reference_type === 'SESSION_DONE');
  const reversalEntries = entries.filter(e => e.reference_type === 'REVERSAL');

  console.log(`Original session completion entries: ${originalEntries.length}`);
  console.log(`Reversal entries: ${reversalEntries.length}`);
  console.log('');

  // Calculate net effect
  let netEffect: Record<string, number> = {};

  entries.forEach(entry => {
    entry.lines.forEach(line => {
      const key = line.account_code;
      if (!netEffect[key]) {
        netEffect[key] = 0;
      }
      netEffect[key] += line.debit_amount - line.credit_amount;
    });
  });

  console.log('Net effect on accounts after all entries:');
  Object.entries(netEffect).forEach(([code, amount]) => {
    const entry = entries[0].lines.find(l => l.account_code === code);
    const name = entry?.account_name || '';
    console.log(`  ${code} ${name}: ${amount >= 0 ? 'Debit' : 'Credit'} ${Math.abs(amount).toLocaleString('vi-VN')}`);
  });
  console.log('');

  console.log('EXPECTED CORRECT ENTRY (for 150,000 VND revenue):');
  console.log('  Debit  3387 (Doanh thu chưa thực hiện): 150,000');
  console.log('  Credit 5113 (Doanh thu cung cấp dịch vụ): 150,000');
  console.log('  Debit  6421 (Chi phí nhân viên): [commission amount]');
  console.log('  Credit 334 (Phải trả người lao động): [commission amount]');
  console.log('');
}

async function proposeCorrection() {
  console.log('\n=== PROBLEM IDENTIFIED ===\n');
  console.log('Issue: System recorded cash received as 350,000 (full price)');
  console.log('       But customer actually paid 199,500 (after 43% discount)');
  console.log('');
  console.log('Current state:');
  console.log('  Debit  111 (Cash): 350,000  ❌ WRONG - should be 199,500');
  console.log('  Credit 3387 (Deferred): 350,000  ❌ WRONG - should be 199,500');
  console.log('');
  console.log('Correction needed:');
  console.log('  Credit 111 (Cash): 150,500 (to reduce from 350k to 199.5k)');
  console.log('  Debit  3387 (Deferred): 150,500 (to reduce from 350k to 199.5k)');
  console.log('');
  console.log('=== PROPOSED CORRECTION ENTRY ===\n');
  console.log('Description: "Điều chỉnh sai số tiền thu - Giá sau CK 43% là 199.500đ, không phải 350.000đ"');
  console.log('');
  console.log('Lines:');
  console.log('  1. Debit  3387 (Doanh thu chưa thực hiện): 150,500');
  console.log('  2. Credit 111 (Tiền mặt): 150,500');
  console.log('');
  console.log('Net result after correction:');
  console.log('  111 (Cash): 350,000 - 150,500 = 199,500 ✅');
  console.log('  3387 (Deferred): 350,000 - 150,500 = 199,500 ✅');
  console.log('  (Matches the 199,500 revenue recognition already recorded)');
  console.log('');
}

async function createCorrectionEntry() {
  console.log('\n=== CREATING CORRECTION ENTRY ===\n');

  // First, get the account IDs
  const { data: accounts, error: accountError } = await supabase
    .from('accounting_accounts')
    .select('id, account_code, account_name')
    .in('account_code', ['111', '3387']);

  if (accountError) {
    console.error('Error fetching accounts:', accountError);
    return;
  }

  if (!accounts || accounts.length === 0) {
    console.error('No accounts found. Accounts:', accounts);
    return;
  }

  console.log(`Found ${accounts.length} account(s)`);
  accounts.forEach(a => {
    console.log(`  - ${a.account_code}: ${a.account_name}`);
  });

  const cashAccount = accounts.find(a => a.account_code === '111');
  const deferredAccount = accounts.find(a => a.account_code === '3387');

  if (!cashAccount) {
    console.error('Could not find cash account (111)');
    return;
  }

  if (!deferredAccount) {
    console.error('Could not find deferred revenue account (3387)');
    return;
  }

  console.log('');

  // Get tenant_id (assuming first tenant for demo)
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (tenantError || !tenants) {
    console.error('No tenant found:', tenantError);
    return;
  }

  const tenantId = tenants.id;
  console.log(`Using tenant ID: ${tenantId.substring(0, 8)}...`);
  console.log('');

  // Create the journal entry
  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: '2026-06-20',
      description: 'Điều chỉnh sai số tiền thu - Giá sau CK 43% là 199.500đ, không phải 350.000đ',
      reference_type: 'MANUAL',
      reference_id: tenantId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (entryError || !entry) {
    console.error('Error creating journal entry:', entryError);
    return;
  }

  console.log(`✅ Created journal entry: ${entry.id.substring(0, 8)}...`);

  // Create the lines
  const { error: linesError } = await supabase
    .from('journal_lines')
    .insert([
      {
        entry_id: entry.id,
        account_id: deferredAccount.id,
        debit_amount: 150500,
        credit_amount: 0,
      },
      {
        entry_id: entry.id,
        account_id: cashAccount.id,
        debit_amount: 0,
        credit_amount: 150500,
      },
    ]);

  if (linesError) {
    console.error('Error creating journal lines:', linesError);
    return;
  }

  console.log('✅ Created 2 journal lines');

  // Post the entry
  const { error: postError } = await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entry.id);

  if (postError) {
    console.error('Error posting entry:', postError);
    return;
  }

  console.log('✅ Entry posted successfully!');
  console.log('');
  console.log('=== CORRECTION COMPLETED ===');
  console.log('');
  console.log('Please verify in the accounting reports:');
  console.log('  - Trial Balance (Cân đối phát sinh)');
  console.log('  - General Ledger (Nhật ký chúng từ)');
  console.log('');
  console.log('Expected final balances:');
  console.log('  - Account 111 (Tiền mặt): 199,500');
  console.log('  - Account 3387 (Doanh thu chưa thực hiện): 199,500 (Credit balance)');
  console.log('  - Account 5113 (Doanh thu): 199,500 (Credit balance)');
  console.log('');
}

async function main() {
  try {
    const entries = await investigateMassageEntries();
    await analyzeSituation(entries);
    await proposeCorrection();
    
    // Check if --fix flag is provided
    const shouldFix = process.argv.includes('--fix');
    
    if (shouldFix) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('\n⚠️  Are you sure you want to create this correction entry? (yes/no): ', async (answer: string) => {
        if (answer.toLowerCase() === 'yes') {
          await createCorrectionEntry();
        } else {
          console.log('Correction cancelled.');
        }
        rl.close();
        process.exit(0);
      });
    } else {
      console.log('ℹ️  Run with --fix flag to automatically create the correction entry.');
      console.log('   Example: npx tsx scripts/fix-massage-accounting.ts --fix');
    }
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
