/**
 * Cleanup script to reverse all entries with incorrect decimal amounts (199.5 instead of 199500)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findDecimalEntries() {
  console.log('\n=== FINDING ENTRIES WITH DECIMAL AMOUNTS (199.5) ===\n');

  const { data: lines, error } = await supabase
    .from('journal_lines')
    .select(`
      id,
      debit_amount,
      credit_amount,
      entry_id,
      entry:journal_entries (
        id,
        description,
        entry_date,
        status
      )
    `)
    .or('debit_amount.eq.199.5,credit_amount.eq.199.5');

  if (error) {
    console.error('Error:', error);
    return [];
  }

  // Group by entry_id
  const entriesMap = new Map();
  lines?.forEach((line: any) => {
    if (line.entry?.status !== 'POSTED') return; // Skip non-posted entries
    
    if (!entriesMap.has(line.entry_id)) {
      entriesMap.set(line.entry_id, {
        id: line.entry_id,
        description: line.entry?.description,
        date: line.entry?.entry_date,
        lines: [],
      });
    }
    entriesMap.get(line.entry_id).lines.push(line);
  });

  const entries = Array.from(entriesMap.values());

  console.log(`Found ${entries.length} entries with 199.5 amount:\n`);

  entries.forEach((entry, idx) => {
    console.log(`${idx + 1}. Entry ID: ${entry.id.substring(0, 8)}...`);
    console.log(`   Description: ${entry.description}`);
    console.log(`   Date: ${entry.date}`);
    console.log(`   Lines with 199.5:`);
    entry.lines.forEach((line: any) => {
      console.log(`      Debit: ${line.debit_amount} | Credit: ${line.credit_amount}`);
    });
    console.log('');
  });

  return entries;
}

async function reverseDecimalEntries(entries: any[]) {
  console.log('\n=== REVERSING ENTRIES WITH 199.5 ===\n');

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
    
    // Get full entry details
    const { data: fullEntry, error: fetchError } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .eq('id', entry.id)
      .single();

    if (fetchError || !fullEntry) {
      console.error('  ❌ Error fetching entry:', fetchError);
      continue;
    }

    // Create reversal entry
    const { data: reversalEntry, error: createError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        entry_date: today,
        description: `[CLEANUP] Đảo bỏ bút toán có số thập phân sai (199.5 → 199500) - ${entry.id.substring(0, 8)}`,
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
    const reversedLines = fullEntry.journal_lines.map((line: any) => ({
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

    console.log(`  ✅ Reversed successfully`);
  }

  console.log(`\n✅ All ${entries.length} decimal entries have been reversed!\n`);
  return true;
}

async function main() {
  try {
    console.log('='.repeat(70));
    console.log('CLEANUP: REVERSE ENTRIES WITH DECIMAL AMOUNTS (199.5)');
    console.log('='.repeat(70));

    const entries = await findDecimalEntries();

    if (entries.length === 0) {
      console.log('✅ No entries with 199.5 found. Database is clean!');
      return;
    }

    console.log('=== SUMMARY ===');
    console.log(`Found ${entries.length} entries with incorrect decimal amounts (199.5).`);
    console.log('These need to be reversed to clean up the accounting records.');
    console.log('');

    const shouldFix = process.argv.includes('--fix');

    if (shouldFix) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('⚠️  This will reverse all entries with 199.5 amounts.\nProceed? (yes/no): ', async (answer: string) => {
        if (answer.toLowerCase() === 'yes') {
          const success = await reverseDecimalEntries(entries);

          if (success) {
            console.log('='.repeat(70));
            console.log('✅ CLEANUP COMPLETE!');
            console.log('='.repeat(70));
            console.log('');
            console.log('All entries with 199.5 have been reversed.');
            console.log('The accounting reports should now show clean integer amounts.');
            console.log('');
          }
        } else {
          console.log('Operation cancelled.');
        }
        rl.close();
        process.exit(0);
      });
    } else {
      console.log('ℹ️  Run with --fix flag to reverse these entries.');
      console.log('   Example: npx tsx scripts/cleanup-decimal-amounts.ts --fix');
    }
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
