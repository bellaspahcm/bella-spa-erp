/**
 * Check actual amounts stored in database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAmounts() {
  console.log('\n=== CHECKING ACTUAL DATABASE AMOUNTS ===\n');

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      description,
      entry_date,
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
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent journal entries (raw amounts from database):\n');

  entries?.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. Entry: ${entry.description}`);
    console.log(`   Date: ${entry.entry_date}`);
    console.log(`   Lines:`);

    entry.journal_lines?.forEach((line: any) => {
      const debit = Number(line.debit_amount);
      const credit = Number(line.credit_amount);
      const accountCode = line.account?.account_code || 'N/A';
      const accountName = line.account?.account_name || 'Unknown';

      console.log(`      ${accountCode} - ${accountName}`);
      console.log(`      RAW Debit:  ${line.debit_amount} (type: ${typeof line.debit_amount})`);
      console.log(`      RAW Credit: ${line.credit_amount} (type: ${typeof line.credit_amount})`);
      console.log(`      As Number - Debit: ${debit} | Credit: ${credit}`);
      
      // Check if this is a problematic amount
      if (debit > 0 && debit !== Math.floor(debit)) {
        console.log(`      ⚠️  WARNING: Debit has decimal: ${debit}`);
      }
      if (credit > 0 && credit !== Math.floor(credit)) {
        console.log(`      ⚠️  WARNING: Credit has decimal: ${credit}`);
      }

      // Check for 199.5 or 199500
      if (debit === 199.5 || credit === 199.5) {
        console.log(`      ❌ ERROR: Amount is 199.5 (should be 199500)!`);
      }
      if (debit === 199500 || credit === 199500) {
        console.log(`      ✅ CORRECT: Amount is 199500`);
      }
    });

    console.log('');
  });

  // Check specific massage entries
  console.log('\n=== CHECKING MASSAGE SESSION ENTRIES ===\n');

  const { data: massageEntries } = await supabase
    .from('journal_entries')
    .select(`
      description,
      entry_date,
      created_at,
      journal_lines (
        debit_amount,
        credit_amount,
        account:accounting_accounts (
          account_code,
          account_name
        )
      )
    `)
    .or('description.ilike.%Massage%,description.ilike.%CORRECTED%')
    .order('created_at', { ascending: false })
    .limit(5);

  massageEntries?.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. ${entry.description}`);
    console.log(`   Date: ${entry.entry_date}`);
    
    entry.journal_lines?.forEach((line: any) => {
      const debit = Number(line.debit_amount);
      const credit = Number(line.credit_amount);
      
      console.log(`   - ${line.account?.account_code}: Debit ${debit} | Credit ${credit}`);
      
      // Check if amount is exactly 199.5 or 199500
      if (debit === 199.5 || credit === 199.5) {
        console.log(`     ❌ ERROR: Amount is 199.5 (should be 199500)!`);
      }
      if (debit === 199500 || credit === 199500) {
        console.log(`     ✅ CORRECT: Amount is 199500`);
      }
    });
    
    console.log('');
  });
}

async function main() {
  await checkAmounts();
}

main();
