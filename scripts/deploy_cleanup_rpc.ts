#!/usr/bin/env tsx
/**
 * Deploy Finance Test Cleanup RPC
 * 
 * Executes migration: 20260824000000_finance_test_cleanup_rpc.sql
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═'.repeat(80));
  console.log('🚀 Deploy Finance Test Cleanup RPC');
  console.log('═'.repeat(80));

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260824000000_finance_test_cleanup_rpc.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found');
    process.exit(1);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log(`\n📄 Migration: 20260824000000_finance_test_cleanup_rpc.sql`);
  console.log(`   Size: ${migrationSql.length} bytes`);

  // Execute SQL via RPC
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: migrationSql
  });

  if (error) {
    // Try direct query if exec_sql doesn't exist
    console.log(`   ℹ️  exec_sql RPC not available, using direct query...`);
    
    // For TypeScript client, we need to use REST API directly
    // Alternative: split migration into parts and execute via supabase.from()
    console.log(`   ⚠️  Direct SQL execution not supported via TypeScript client`);
    console.log(`   ℹ️  Please run migration manually:`);
    console.log(`      npx supabase db push --include-all`);
    console.log(`   OR:`);
    console.log(`      Use Supabase Dashboard → SQL Editor → paste migration SQL`);
    
    process.exit(1);
  }

  console.log(`\n✅ Migration deployed successfully`);
  
  // Verify RPC exists
  const { data: verifyData, error: verifyError } = await supabase
    .rpc('finance_admin_cleanup_test_transactions', {
      p_transaction_ids: [],
      p_tenant_id: '00000000-0000-0000-0000-000000000000'
    });

  if (!verifyError || verifyError.message.includes('Empty transaction ID list')) {
    console.log(`✅ RPC verification: finance_admin_cleanup_test_transactions exists`);
  } else {
    console.log(`⚠️  RPC verification failed: ${verifyError.message}`);
  }

  console.log('\n═'.repeat(80));
}

main().catch(console.error);
