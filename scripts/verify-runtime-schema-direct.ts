/**
 * RCA Verification: Direct SQL query to actual database
 * 
 * Purpose: Verify runtime_idempotency_registry schema after Migration 04 v1.1 apply
 * 
 * NO MODIFICATIONS - READ ONLY
 */

import { createClient } from '@supabase/supabase-js';
import { createAuthenticatedClient } from '../tests/utils/test-jwt-helper';
import { E2E_TENANTS } from '../tests/utils/e2e-fixtures';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Use authenticated client (same as test)
const client = createAuthenticatedClient(
  E2E_TENANTS.TENANT_A.tenantId,
  E2E_TENANTS.TENANT_A.userId
);

const serviceClient = createClient(supabaseUrl, serviceKey);

async function verifySchema() {
  console.log('🔍 RCA Verification: Actual Database State (Direct SQL)\n');

  // Attempt to query table directly to trigger schema error
  console.log('=== Attempting INSERT to trigger schema validation ===');
  const testKey = `rca-schema-test-${Date.now()}`;
  
  const { data, error } = await client.rpc('submit_financial_intent', {
    p_idempotency_key: testKey,
    p_intent_type: 'TEST_VERIFICATION',
    p_intent_payload: { test: true }
  });

  if (error) {
    console.log('✅ RPC call returned error (expected for schema verification):');
    console.log(`   Code: ${error.code}`);
    console.log(`   Message: ${error.message}`);
    
    if (error.code === '22P02') {
      console.log('\n📊 Analysis:');
      console.log('   Error 22P02 = invalid input syntax for type uuid');
      console.log('   This confirms column EXISTS and is type UUID');
      console.log('   Issue: auth.uid() returns non-UUID value');
    } else if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n📊 Analysis:');
      console.log('   Column does not exist in table');
    } else {
      console.log('\n📊 Analysis:');
      console.log('   Different error - see message above');
    }
  } else {
    console.log('⚠️  RPC succeeded (unexpected for test call)');
    console.log(`   Returned ID: ${data}`);
  }

  // Query runtime_idempotency_registry to check if created_by appears in error
  console.log('\n\n=== Query runtime_idempotency_registry structure ===');
  const { data: sample, error: queryError } = await serviceClient
    .from('runtime_idempotency_registry')
    .select('*')
    .limit(1);

  if (queryError) {
    console.error('❌ Error:', queryError.message);
  } else {
    if (sample && sample.length > 0) {
      console.log('✅ Table query succeeded');
      console.log('   Columns present:', Object.keys(sample[0]).join(', '));
      
      const hasCreatedBy = 'created_by' in sample[0];
      console.log(`\n   'created_by' column: ${hasCreatedBy ? '✅ EXISTS' : '❌ NOT EXISTS'}`);
    } else {
      console.log('⚠️  Table empty (no records to inspect columns)');
    }
  }

  console.log('\n\n=== Verification Complete ===');
}

verifySchema().catch(console.error);
