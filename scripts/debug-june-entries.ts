/**
 * Debug script: Check all journal entries in June 2026
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);
const TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e';

async function main() {
  console.log('=== Debug: All June 2026 Journal Entries ===\n');

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', '2026-06-01')
    .lte('entry_date', '2026-06-30')
    .order('entry_date', { ascending: true });

  if (error || !entries) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${entries.length} entries\n`);

  // Group by reference_type (since entry_type doesn't exist)
  const byType: Record<string, any[]> = {};
  entries.forEach(e => {
    const type = e.reference_type || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(e);
  });

  console.log('📊 Entries by Reference Type:');
  Object.keys(byType).sort().forEach(type => {
    console.log(`   ${type}: ${byType[type].length} entries`);
  });
  console.log();

  // Show all entries (Reference Type - Date - Description)
  console.log('📋 All Entries (Reference Type - Date - Description):');
  entries.forEach((e, i) => {
    const desc = e.description?.substring(0, 100) || '';
    const type = e.reference_type || 'unknown';
    console.log(`${i + 1}. ${type} - ${e.entry_date} - ${desc}`);
  });
}

main().catch(console.error);
