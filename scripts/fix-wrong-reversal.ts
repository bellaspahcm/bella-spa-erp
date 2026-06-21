/**
 * Script to fix the wrong reversal entry
 * 
 * Problem: User created a reversal with wrong amount (199.54 instead of 199,500)
 * 
 * Steps:
 * 1. Find the wrong reversal entry (f115b082-b3dd-4cc8-a09f-a857fb6f...)
 * 2. Reverse it (to undo the wrong reversal)
 * 3. Create the correct reversal entry with 199,500
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findWrongReversal() {
  console.log('\n=== FINDING WRONG REVERSAL ENTRY ===\n');

  // Find entries with amount 199.54
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
        account:accounting_accounts (
          account_code,
          account_name
        )
      )
    `)
    .ilike('description', '%Ghi đảo bút toán%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return null;
  }

  console.log(`Found ${entries?.length || 0} reversal entries:\n`);

  let wrongEntry = null;

  entries?.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. Entry ID: ${entry.id.substring(0, 8)}...`);
    console.log(`   Date: ${entry.entry_date}`);
    console.log(`   Description: ${entry.description}`);
    console.log(`   Status: ${entry.status}`);
    console.log(`   Lines:`);

    let hasWrongAmount = false;
    entry.journal_lines.forEach((line: any) => {
      const debit = Number(line.debit_amount);
      const credit = Number(line.credit_amount);
      const accountCode = line.account?.account_code || 'N/A';
      const accountName = line.account?.account_name || 'N/A';
      
      console.log(`      - ${accountCode} ${accountName}`);
      console.log(`        Debit: ${debit.toLocaleString('vi-VN')}`);
      console.log(`        Credit: ${credit.toLocaleString('vi-VN')}`);

      // Check if this has the wrong amount (199.54 instead of 199500)
      if (Math.abs(debit - 199.54) < 0.01 || Math.abs(credit - 199.54) < 0.01) {
        hasWrongAmount = true;
        console.log(`        ⚠️  WRONG AMOUNT DETECTED!`);
      }
    });

    if (hasWrongAmount) {
      wrongEntry = entry;
      console.log('   >>> THIS IS THE WRONG ENTRY <<<');
    }

    console.log('');
  });

  return wrongEntry;
}

async function reverseWrongEntry(entryId: string) {
  console.log('\n=== REVERSING THE WRONG ENTRY ===\n');

  // Get the wrong entry details
  const { data: wrongEntry, error: fetchError } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (*)
    `)
    .eq('id', entryId)
    .single();

  if (fetchError || !wrongEntry) {
    console.error('Error fetching entry:', fetchError);
    return null;
  }

  console.log(`Reversing entry: ${entryId.substring(0, 8)}...`);
  console.log(`Original description: ${wrongEntry.description}`);

  // Get tenant_id
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('No tenant found');
    return null;
  }

  const tenantId = tenants.id;

  // Create reversal of the wrong entry
  const { data: reversalEntry, error: createError } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Hủy bút toán sai số tiền - Reversal of wrong entry: ${entryId.substring(0, 8)}`,
      reference_type: 'REVERSAL',
      reference_id: entryId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (createError || !reversalEntry) {
    console.error('Error creating reversal:', createError);
    return null;
  }

  console.log(`✅ Created reversal entry: ${reversalEntry.id.substring(0, 8)}...`);

  // Create reversed lines (swap debit/credit)
  const reversedLines = wrongEntry.journal_lines.map((line: any) => ({
    entry_id: reversalEntry.id,
    account_id: line.account_id,
    debit_amount: Number(line.credit_amount),
    credit_amount: Number(line.debit_amount),
    branch_id: line.branch_id,
    ktv_id: line.ktv_id,
    cost_center_id: line.cost_center_id,
  }));

  const { error: linesError } = await supabase
    .from('journal_lines')
    .insert(reversedLines);

  if (linesError) {
    console.error('Error creating lines:', linesError);
    return null;
  }

  console.log(`✅ Created ${reversedLines.length} reversed lines`);

  // Post the entry
  const { error: postError } = await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', reversalEntry.id);

  if (postError) {
    console.error('Error posting:', postError);
    return null;
  }

  console.log('✅ Reversal posted successfully!');
  console.log('');

  return reversalEntry.id;
}

async function createCorrectReversal() {
  console.log('\n=== CREATING CORRECT REVERSAL (199,500) ===\n');

  // Find the ORIGINAL wrong entry (51c25138-57a0-45bc-94da-d62070b4e78d)
  const originalEntryId = '51c25138-57a0-45bc-94da-d62070b4e78d';
  
  const { data: originalEntry, error: fetchError } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        account:accounting_accounts (
          account_code,
          account_name
        )
      )
    `)
    .eq('id', originalEntryId)
    .single();

  if (fetchError || !originalEntry) {
    console.error('Error fetching original entry:', fetchError);
    console.log('\nCannot find the original entry. Searching by description...');
    
    // Search by description instead
    const { data: entries } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .ilike('description', '%Ghi đảo bút toán%51c25138%')
      .limit(1)
      .single();

    if (!entries) {
      console.error('Still cannot find entry');
      return null;
    }
  }

  console.log('Found original entry that needs correct reversal');
  console.log('Creating correct reversal with amount 199,500...');
  console.log('');

  // Get accounts
  const { data: accounts } = await supabase
    .from('accounting_accounts')
    .select('id, account_code, account_name')
    .in('account_code', ['111', '3387']);

  if (!accounts || accounts.length < 2) {
    console.error('Cannot find accounts');
    return null;
  }

  const cashAccount = accounts.find(a => a.account_code === '111');
  const deferredAccount = accounts.find(a => a.account_code === '3387');

  if (!cashAccount || !deferredAccount) {
    console.error('Missing required accounts');
    return null;
  }

  // Get tenant
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('No tenant found');
    return null;
  }

  const tenantId = tenants.id;

  // Create the CORRECT reversal entry
  const { data: correctEntry, error: createError } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: new Date().toISOString().split('T')[0],
      description: 'Ghi đảo bút toán SAI SỐ TIỀN - Đảo lại đúng với số tiền 199.500đ',
      reference_type: 'REVERSAL',
      reference_id: originalEntryId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (createError || !correctEntry) {
    console.error('Error creating entry:', createError);
    return null;
  }

  console.log(`✅ Created correct reversal entry: ${correctEntry.id.substring(0, 8)}...`);

  // Create correct lines with 199,500
  const { error: linesError } = await supabase
    .from('journal_lines')
    .insert([
      {
        entry_id: correctEntry.id,
        account_id: cashAccount.id,
        debit_amount: 199500,
        credit_amount: 0,
      },
      {
        entry_id: correctEntry.id,
        account_id: deferredAccount.id,
        debit_amount: 0,
        credit_amount: 199500,
      },
    ]);

  if (linesError) {
    console.error('Error creating lines:', linesError);
    return null;
  }

  console.log('✅ Created 2 lines with CORRECT amount (199,500)');

  // Post the entry
  const { error: postError } = await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', correctEntry.id);

  if (postError) {
    console.error('Error posting:', postError);
    return null;
  }

  console.log('✅ Correct reversal posted successfully!');
  console.log('');
  console.log('Lines created:');
  console.log('  Debit  111 (Tiền mặt): 199,500');
  console.log('  Credit 3387 (Doanh thu chưa thực hiện): 199,500');
  console.log('');

  return correctEntry.id;
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('FIX WRONG REVERSAL ENTRY - CORRECTION SCRIPT');
    console.log('='.repeat(60));

    // Step 1: Find the wrong reversal
    const wrongEntry = await findWrongReversal();
    
    if (!wrongEntry) {
      console.log('❌ Cannot find wrong reversal entry');
      return;
    }

    console.log('=== SUMMARY ===');
    console.log(`Wrong entry ID: ${wrongEntry.id}`);
    console.log(`Wrong amount in entry: 199.54 (should be 199,500)`);
    console.log('');

    const shouldFix = process.argv.includes('--fix');

    if (shouldFix) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('\n⚠️  This will:\n  1. Reverse the wrong entry (undo the 199.54 entry)\n  2. Create correct reversal (199,500)\n\nProceed? (yes/no): ', async (answer: string) => {
        if (answer.toLowerCase() === 'yes') {
          // Step 2: Reverse the wrong entry
          const reversalId = await reverseWrongEntry(wrongEntry.id);
          
          if (reversalId) {
            console.log('✅ Wrong entry has been reversed');
            
            // Step 3: Create correct reversal
            const correctId = await createCorrectReversal();
            
            if (correctId) {
              console.log('\n=== ✅ ALL DONE ===');
              console.log('The wrong reversal has been undone and replaced with the correct one.');
              console.log('Please verify in the accounting journals.');
            }
          }
        } else {
          console.log('Operation cancelled.');
        }
        rl.close();
        process.exit(0);
      });
    } else {
      console.log('ℹ️  Run with --fix flag to automatically fix this issue.');
      console.log('   Example: npx tsx scripts/fix-wrong-reversal.ts --fix');
    }
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
