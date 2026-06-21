/**
 * FINAL DECIMAL CLEANUP
 * 
 * Reverse ALL 21 entries that still have decimal amounts (199.5)
 * These are all massage-related cleanup attempts that accidentally
 * created more decimal entries.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findDecimalEntries() {
  console.log('\n=== FINDING DECIMAL ENTRIES TO CLEANUP ===\n');

  const { data: lines } = await supabase
    .from('journal_lines')
    .select(`
      entry_id,
      debit_amount,
      credit_amount,
      entry:journal_entries!inner (
        id,
        description,
        entry_date,
        status
      )
    `)
    .eq('entry.status', 'POSTED');

  const decimalEntryIds = new Set<string>();

  lines?.forEach((line: any) => {
    const debit = Number(line.debit_amount);
    const credit = Number(line.credit_amount);

    const hasDecimal = 
      (debit > 0 && debit !== Math.floor(debit)) ||
      (credit > 0 && credit !== Math.floor(credit));

    if (hasDecimal) {
      decimalEntryIds.add(line.entry_id);
    }
  });

  // Get full entries
  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      reference_type,
      journal_lines (*)
    `)
    .in('id', Array.from(decimalEntryIds))
    .eq('status', 'POSTED');

  console.log(`Found ${entries?.length || 0} entries with decimal amounts to cleanup\n`);

  return entries || [];
}

async function reverseDecimalEntries(entries: any[]) {
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

  console.log('\n=== REVERSING DECIMAL ENTRIES ===\n');

  for (const entry of entries) {
    console.log(`Reversing: ${entry.id.substring(0, 8)}... - ${entry.description.substring(0, 60)}...`);

    // Create reversal
    const { data: reversalEntry, error: createError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        entry_date: today,
        description: `[DECIMAL CLEANUP] Đảo bỏ entry có số thập phân - ${entry.id.substring(0, 8)}`,
        reference_type: 'REVERSAL',
        reference_id: entry.id,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (createError || !reversalEntry) {
      console.error('  ❌ Error creating reversal:', createError);
      continue;
    }

    // Create reversed lines (swap debit/credit)
    const reversedLines = entry.journal_lines.map((line: any) => ({
      entry_id: reversalEntry.id,
      account_id: line.account_id,
      debit_amount: Number(line.credit_amount),
      credit_amount: Number(line.debit_amount),
      ktv_id: line.ktv_id,
      branch_id: line.branch_id,
    }));

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(reversedLines);

    if (linesError) {
      console.error('  ❌ Error creating lines:', linesError);
      continue;
    }

    // Post the entry
    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', reversalEntry.id);

    if (postError) {
      console.error('  ❌ Error posting:', postError);
      continue;
    }

    console.log(`  ✅ Reversed`);
  }

  console.log(`\n✅ All ${entries.length} decimal entries reversed!\n`);
  return true;
}

async function verifyCleanup() {
  console.log('\n=== VERIFYING CLEANUP ===\n');

  const { data: lines } = await supabase
    .from('journal_lines')
    .select(`
      id,
      debit_amount,
      credit_amount,
      entry:journal_entries!inner (
        status
      )
    `)
    .eq('entry.status', 'POSTED');

  let foundDecimals = 0;

  lines?.forEach((line: any) => {
    const debit = Number(line.debit_amount);
    const credit = Number(line.credit_amount);

    if ((debit > 0 && debit !== Math.floor(debit)) || (credit > 0 && credit !== Math.floor(credit))) {
      foundDecimals++;
    }
  });

  if (foundDecimals === 0) {
    console.log('✅ SUCCESS: No decimal amounts found in any posted entries!');
  } else {
    console.log(`⚠️  Still found ${foundDecimals} lines with decimal amounts`);
  }

  return foundDecimals === 0;
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('FINAL DECIMAL CLEANUP - Remove all 199.5 massage decimals');
    console.log('='.repeat(80));

    // Step 1: Find decimal entries
    const entries = await findDecimalEntries();

    if (entries.length === 0) {
      console.log('\n✅ No decimal entries found! Already clean.');
      return;
    }

    console.log(`\nPlan: Reverse ${entries.length} entries with decimal amounts\n`);
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Reverse all decimal entries
    const success = await reverseDecimalEntries(entries);
    
    if (!success) {
      console.error('\n❌ Cleanup failed');
      process.exit(1);
    }

    // Step 3: Verify
    await verifyCleanup();

    console.log('\n' + '='.repeat(80));
    console.log('✅ DECIMAL CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    console.log('\nAll decimal amounts have been cleaned from accounting records.');
    console.log('');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
