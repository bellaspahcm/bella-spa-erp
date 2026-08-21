/**
 * E3 Migration Application Script
 * Applies E3 Freight Audit migrations to remote Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Migration files in order
const migrations = [
  '../../migrations/logistics/20260821_create_freight_audit_tables.sql',
  '../../migrations/logistics/20260821_create_carrier_rates_table.sql',
  '../../migrations/logistics/20260821_create_accessorial_rates_table.sql',
  '../../migrations/logistics/20260821_create_discrepancies_table.sql',
];

async function applyMigration(filePath, index) {
  const migrationName = filePath.split('/').pop();
  console.log(`\n[${index + 1}/4] Applying: ${migrationName}`);
  
  try {
    const sql = readFileSync(join(__dirname, filePath), 'utf8');
    
    // Execute SQL using service role key
    // Note: Supabase JS client doesn't have direct SQL execution
    // We'll use the PostgREST API directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      // Try alternative: split and execute statements
      console.log('   Splitting SQL into statements...');
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/**'));
      
      console.log(`   Executing ${statements.length} statements...`);
      
      // Since we can't execute raw SQL with client, output for manual application
      console.log(`\n   ⚠️  Manual application required`);
      console.log(`   Please copy and execute in Supabase SQL Editor:\n`);
      console.log('   ' + '-'.repeat(76));
      console.log(sql.split('\n').map(line => '   ' + line).join('\n'));
      console.log('   ' + '-'.repeat(76));
      
      return { success: false, reason: 'manual_required', sql };
    }
    
    console.log(`   ✅ Applied successfully`);
    return { success: true };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('E3 Migration Application');
  console.log('='.repeat(80));
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Migrations: ${migrations.length}`);
  
  const results = [];
  let manualSqls = [];
  
  for (let i = 0; i < migrations.length; i++) {
    const result = await applyMigration(migrations[i], i);
    results.push(result);
    if (result.sql) {
      manualSqls.push({ name: migrations[i].split('/').pop(), sql: result.sql });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Migration Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Manual required: ${failed}`);
  
  if (manualSqls.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('MANUAL APPLICATION REQUIRED');
    console.log('='.repeat(80));
    console.log('\nPlease execute the following SQL in Supabase Dashboard → SQL Editor:');
    console.log('URL: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new');
    console.log('\n' + '━'.repeat(80) + '\n');
    
    manualSqls.forEach(({ name, sql }) => {
      console.log(`-- ${name}`);
      console.log(sql);
      console.log('\n' + '─'.repeat(80) + '\n');
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
