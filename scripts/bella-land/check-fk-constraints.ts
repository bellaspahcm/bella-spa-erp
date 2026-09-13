#!/usr/bin/env tsx
/**
 * Check actual FK constraints on re_reservations table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking FK constraints on re_reservations...\n');

  // Query FK constraints
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        a.attname AS column_name,
        confrelid::regclass AS referenced_table,
        af.attname AS referenced_column,
        CASE confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS on_delete_action
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
      WHERE conrelid = 're_reservations'::regclass
        AND contype = 'f'
      ORDER BY conname;
    `
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No FK constraints found on re_reservations');
  } else {
    console.log('📋 FK Constraints:\n');
    data.forEach((row: any) => {
      console.log(`Constraint: ${row.constraint_name}`);
      console.log(`  Column: ${row.column_name} → ${row.referenced_table}.${row.referenced_column}`);
      console.log(`  ON DELETE: ${row.on_delete_action}`);
      console.log('');
    });
  }

  // Also check if re_reservations table exists
  const { data: tableData } = await supabase
    .from('re_reservations')
    .select('id')
    .limit(1);

  if (tableData) {
    console.log(`✅ re_reservations table exists (${tableData.length > 0 ? 'has data' : 'empty'})`);
  } else {
    console.log('⚠️  re_reservations table does not exist');
  }
}

main().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
