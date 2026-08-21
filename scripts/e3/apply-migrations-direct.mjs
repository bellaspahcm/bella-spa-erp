/**
 * E3 Migration Direct Application
 * Uses Supabase REST API with service role key to execute SQL
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrations = [
  '../../migrations/logistics/20260821_create_freight_audit_tables.sql',
  '../../migrations/logistics/20260821_create_carrier_rates_table.sql',
  '../../migrations/logistics/20260821_create_accessorial_rates_table.sql',
  '../../migrations/logistics/20260821_create_discrepancies_table.sql',
];

async function executeSql(sql, migrationName) {
  console.log(`\nExecuting: ${migrationName}`);
  
  try {
    // Use Supabase's pg_meta API for SQL execution
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`   ⚠️  API method not available, trying alternative...`);
      
      // Alternative: Use PostgREST's query parameter
      const altResponse = await fetch(`${SUPABASE_URL}/rest/v1/?query=${encodeURIComponent(sql)}`, {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      });
      
      if (!altResponse.ok) {
        throw new Error(`Failed to execute SQL: ${await altResponse.text()}`);
      }
    }

    console.log(`   ✅ Applied successfully`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   ℹ️  Manual application required via Supabase Dashboard`);
    return false;
  }
}

async function main() {
  console.log('E3 Migration Application');
  console.log('='.repeat(80));
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Migrations: ${migrations.length}\n`);

  const startTime = Date.now();
  let successCount = 0;

  for (let i = 0; i < migrations.length; i++) {
    const migrationPath = migrations[i];
    const migrationName = migrationPath.split('/').pop();
    
    console.log(`[${i + 1}/4] ${migrationName}`);
    
    const sql = readFileSync(join(__dirname, migrationPath), 'utf8');
    const success = await executeSql(sql, migrationName);
    
    if (success) {
      successCount++;
    } else {
      console.log(`\n⚠️  Automated application failed. Please apply manually:`);
      console.log(`   URL: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new`);
      console.log(`\n   SQL to execute:\n`);
      console.log('   ' + '-'.repeat(76));
      console.log(sql.split('\n').map(l => '   ' + l).join('\n'));
      console.log('   ' + '-'.repeat(76) + '\n');
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log(`Migration Summary:`);
  console.log(`  Applied: ${successCount}/${migrations.length}`);
  console.log(`  Duration: ${duration}s`);
  
  if (successCount < migrations.length) {
    console.log(`\n⚠️  Some migrations require manual application`);
    console.log(`   After applying, run: node scripts/e3/verify-e3-schema.mjs`);
  } else {
    console.log(`\n✅ All migrations applied successfully`);
    console.log(`   Next: node scripts/e3/verify-e3-schema.mjs`);
  }

  process.exit(successCount === migrations.length ? 0 : 1);
}

main().catch(console.error);
