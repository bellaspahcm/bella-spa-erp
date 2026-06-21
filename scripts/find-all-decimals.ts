/**
 * Find ALL entries with decimal amounts (not just 199.5)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findAllDecimals() {
  console.log('\n=== FINDING ALL ENTRIES WITH DECIMAL AMOUNTS ===\n');

  const { data: lines } = await supabase
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
        status,
        reference_type
      )
    `)
    .gte('entry.entry_date', '2026-06-01')
    .eq('entry.status', 'POSTED');

  const decimalsFound: Record<string, any[]> = {};

  lines?.forEach((line: any) => {
    const debit = Number(line.debit_amount);
    const credit = Number(line.credit_amount);

    const hasDecimalDebit = debit > 0 && debit !== Math.floor(debit);
    const hasDecimalCredit = credit > 0 && credit !== Math.floor(credit);

    if (hasDecimalDebit || hasDecimalCredit) {
      const entryId = line.entry_id;
      if (!decimalsFound[entryId]) {
        decimalsFound[entryId] = {
          id: entryId,
          description: line.entry?.description,
          date: line.entry?.entry_date,
          type: line.entry?.reference_type,
          lines: [],
        };
      }
      decimalsFound[entryId].lines.push({
        debit,
        credit,
        hasDecimalDebit,
        hasDecimalCredit,
      });
    }
  });

  const entries = Object.values(decimalsFound);

  console.log(`Found ${entries.length} entries with decimal amounts:\n`);

  entries.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. ${entry.date} - [${entry.type || 'MANUAL'}] ${entry.description}`);
    console.log(`   Entry ID: ${entry.id.substring(0, 8)}...`);
    
    entry.lines.forEach((line: any) => {
      if (line.hasDecimalDebit) {
        console.log(`     Debit: ${line.debit} ⚠️  HAS DECIMAL`);
      }
      if (line.hasDecimalCredit) {
        console.log(`     Credit: ${line.credit} ⚠️  HAS DECIMAL`);
      }
    });
    console.log('');
  });

  return entries;
}

async function main() {
  const entries = await findAllDecimals();
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total entries with decimal amounts: ${entries.length}`);
  console.log('\nThese entries need to be reversed or corrected.');
  console.log('Run cleanup-all-decimals.ts --fix to fix them all.');
}

main();
