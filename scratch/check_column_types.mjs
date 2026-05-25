import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf-8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check actual column types
const { data, error } = await admin.rpc('exec_diagnostic_sql', {});
// Try a simpler approach - select 1 row and inspect
const tables = ['revenue', 'expenses', 'salary_records', 'journal_entries'];
for (const t of tables) {
  const { data: rows } = await admin.from(t).select('*').limit(1);
  if (rows?.[0]) {
    const sample = rows[0];
    console.log(`\n📋 ${t}:`);
    ['received_date', 'expense_date', 'entry_date', 'month_year'].forEach(col => {
      if (col in sample) {
        console.log(`   ${col} = ${sample[col]} (typeof: ${typeof sample[col]})`);
      }
    });
  }
}
