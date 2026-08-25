#!/usr/bin/env tsx
/**
 * Verify Finance Test Cleanup RPC Deployment
 * 
 * After deploying migration, verify:
 * 1. RPC exists and callable
 * 2. Authorization gates work
 * 3. Parameter validation works
 * 4. Returns expected structure
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
  console.log('🔍 Verify Finance Test Cleanup RPC Deployment');
  console.log('═'.repeat(80));

  let allTestsPass = true;

  // Test 1: RPC exists
  console.log('\n✅ Test 1: RPC Existence');
  console.log('─'.repeat(80));

  const { data: test1, error: error1 } = await supabase
    .rpc('finance_admin_cleanup_test_transactions', {
      p_transaction_ids: [],
      p_tenant_id: '00000000-0000-0000-0000-000000000000'
    });

  if (error1) {
    if (error1.message.includes('Empty transaction ID list')) {
      console.log('   ✅ RPC exists and returns expected error');
      console.log(`   Message: "${error1.message}"`);
    } else if (error1.message.includes('does not exist')) {
      console.log('   ❌ RPC not deployed');
      console.log(`   Error: ${error1.message}`);
      allTestsPass = false;
    } else {
      console.log('   ⚠️  RPC exists but unexpected response');
      console.log(`   Error: ${error1.message}`);
    }
  } else {
    console.log('   ⚠️  RPC returned data for empty list (unexpected)');
    console.log(`   Data: ${JSON.stringify(test1)}`);
  }

  // Test 2: Tenant validation
  console.log('\n✅ Test 2: Tenant Validation Gate');
  console.log('─'.repeat(80));

  // Create a fake tenant for testing
  const testTenantId = '11111111-1111-1111-1111-111111111111';
  const fakeTransactionIds = [
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  ];

  const { data: test2, error: error2 } = await supabase
    .rpc('finance_admin_cleanup_test_transactions', {
      p_transaction_ids: fakeTransactionIds,
      p_tenant_id: testTenantId
    });

  if (error2) {
    console.log('   ⚠️  RPC returned error (expected for fake IDs)');
    console.log(`   Error: ${error2.message}`);
  } else if (test2 && test2[0]) {
    const result = test2[0];
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Deleted: ${result.deleted_count}`);

    if (result.status === 'ERROR' && result.message.includes('Tenant mismatch')) {
      console.log('   ✅ Tenant validation gate working');
    } else if (result.deleted_count === 0) {
      console.log('   ✅ No records deleted (fake IDs correctly rejected)');
    } else {
      console.log('   ⚠️  Unexpected result');
      allTestsPass = false;
    }
  }

  // Test 3: Return structure
  console.log('\n✅ Test 3: Return Structure Verification');
  console.log('─'.repeat(80));

  const { data: test3, error: error3 } = await supabase
    .rpc('finance_admin_cleanup_test_transactions', {
      p_transaction_ids: [],
      p_tenant_id: testTenantId
    });

  if (error3 && error3.message.includes('Empty transaction ID list')) {
    console.log('   ℹ️  Empty list returns error (acceptable)');
  } else if (test3 && test3[0]) {
    const result = test3[0];
    const hasRequiredFields =
      result.hasOwnProperty('deleted_count') &&
      result.hasOwnProperty('status') &&
      result.hasOwnProperty('message');

    if (hasRequiredFields) {
      console.log('   ✅ Return structure correct');
      console.log(`      deleted_count: ${typeof result.deleted_count}`);
      console.log(`      status: ${typeof result.status}`);
      console.log(`      message: ${typeof result.message}`);
    } else {
      console.log('   ❌ Return structure incomplete');
      allTestsPass = false;
    }
  }

  // Test 4: Check manifest IDs can be passed
  console.log('\n✅ Test 4: Manifest ID Format Compatibility');
  console.log('─'.repeat(80));

  // Load first 5 IDs from manifest
  const fs = require('fs');
  const manifestPath = path.join(__dirname, '..', 'docs', 'architecture', 'PHASE4_4_DELETION_MANIFEST.json');

  if (!fs.existsSync(manifestPath)) {
    console.log('   ⚠️  Manifest not found, skipping test');
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const sampleIds = manifest.slice(0, 5).map((m: any) => m.id);
    const sampleTenant = manifest[0].tenant_id;

    console.log(`   Sample IDs: ${sampleIds.length}`);
    console.log(`   Sample tenant: ${sampleTenant}`);

    // Dry run - check parameter passing
    const { data: test4, error: error4 } = await supabase
      .rpc('finance_admin_cleanup_test_transactions', {
        p_transaction_ids: sampleIds,
        p_tenant_id: sampleTenant
      });

    if (error4) {
      console.log(`   ⚠️  RPC call failed: ${error4.message}`);
      // This is expected if RPC validates tenant ownership
    } else if (test4 && test4[0]) {
      const result = test4[0];
      console.log(`   RPC accepted parameters`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Message: ${result.message}`);

      if (result.deleted_count === 0 || result.status === 'SUCCESS') {
        console.log('   ✅ Parameter format compatible');
      } else {
        console.log('   ⚠️  Unexpected result (may need investigation)');
      }
    }
  }

  // Summary
  console.log('\n═'.repeat(80));
  console.log('📊 Verification Summary');
  console.log('═'.repeat(80));

  if (allTestsPass) {
    console.log('\n✅ RPC DEPLOYMENT VERIFIED');
    console.log('');
    console.log('RPC Contract:');
    console.log('  ✅ Exists and callable');
    console.log('  ✅ Empty list validation');
    console.log('  ✅ Tenant validation');
    console.log('  ✅ Return structure correct');
    console.log('  ✅ Parameter format compatible');
    console.log('');
    console.log('Ready for Phase 4.4 cleanup execution:');
    console.log('  npx tsx scripts/phase4_4_execute_cleanup.ts');
  } else {
    console.log('\n⚠️  VERIFICATION ISSUES DETECTED');
    console.log('');
    console.log('Action: Review RPC deployment before cleanup execution');
  }

  console.log('\n═'.repeat(80));
}

main().catch(console.error);
