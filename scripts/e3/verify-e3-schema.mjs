/**
 * E3 Schema Verification
 * Verify E3 migrations applied successfully
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = [
  'log_freight_invoices',
  'log_invoice_line_items',
  'log_carrier_rates',
  'log_accessorial_rates',
  'log_discrepancies'
];

async function verifyTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('count')
    .limit(0);
  
  if (error) {
    console.log(`❌ ${tableName}: NOT EXISTS (${error.message})`);
    return false;
  } else {
    console.log(`✅ ${tableName}: EXISTS`);
    return true;
  }
}

async function main() {
  console.log('E3 Schema Verification');
  console.log('='.repeat(80));
  console.log(`Database: ${SUPABASE_URL}\n`);
  
  let allExist = true;
  for (const table of tables) {
    const exists = await verifyTable(table);
    if (!exists) allExist = false;
  }
  
  console.log('\n' + '='.repeat(80));
  if (allExist) {
    console.log('✅ All E3 tables exist - Ready for R1 testing');
  } else {
    console.log('❌ Some tables missing - Apply migrations first');
  }
  
  process.exit(allExist ? 0 : 1);
}

main().catch(console.error);
