/**
 * RCA Verification: Query actual database schema
 * 
 * Purpose: Verify runtime_idempotency_registry schema after Migration 04 v1.1 apply
 * 
 * NO MODIFICATIONS - READ ONLY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey);

async function verifySchema() {
  console.log('🔍 RCA Verification: Actual Database State\n');

  // Query 1: runtime_idempotency_registry columns
  console.log('=== Query 1: runtime_idempotency_registry schema ===');
  const { data: columns, error: colError } = await client
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'runtime_idempotency_registry')
    .order('ordinal_position');

  if (colError) {
    console.error('❌ Error querying schema:', colError);
  } else {
    console.table(columns);
    
    const hasCreatedBy = columns?.some(c => c.column_name === 'created_by');
    const createdByCol = columns?.find(c => c.column_name === 'created_by');
    
    if (hasCreatedBy) {
      console.log(`\n✅ Column 'created_by' EXISTS`);
      console.log(`   Type: ${createdByCol?.data_type}`);
      console.log(`   Nullable: ${createdByCol?.is_nullable}`);
    } else {
      console.log(`\n❌ Column 'created_by' DOES NOT EXIST`);
    }
  }

  // Query 2: Check auth.users structure
  console.log('\n\n=== Query 2: auth.users sample (for test user check) ===');
  const { data: users, error: userError } = await client
    .from('auth.users')
    .select('id, email, raw_user_meta_data')
    .limit(5);

  if (userError) {
    console.error('❌ Error querying auth.users:', userError);
  } else {
    console.table(users?.map(u => ({
      id: u.id,
      email: u.email,
      test_markers: JSON.stringify(u.raw_user_meta_data)
    })));
  }

  // Query 3: RPC function definition
  console.log('\n\n=== Query 3: submit_financial_intent RPC definition ===');
  const { data: rpcDef, error: rpcError } = await client.rpc('exec_sql' as any, {
    sql: `
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'submit_financial_intent';
    `
  });

  if (rpcError) {
    console.log('⚠️  Cannot query pg_proc (requires superuser or exec_sql function)');
    console.log('   RPC definition must be verified from migration file');
  } else {
    console.log(rpcDef);
  }

  console.log('\n\n=== Verification Complete ===');
}

verifySchema().catch(console.error);
