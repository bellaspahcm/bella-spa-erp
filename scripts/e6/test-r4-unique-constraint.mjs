/**
 * E6 — R4 Receipt Unique Constraint Test
 * 
 * Test Acceptance Criteria:
 * - AC4.1: Uniqueness check (tenant + PO + vendor + date)
 * - AC4.2: Violation handling (409 Conflict + error message)
 * 
 * Category: B (Test Script - Pattern Reuse from E6 R1-R3)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test tenant
const TENANT_ID = 'da9e610b-88c5-4901-8ab9-5439f4931467';

// Helper: Set tenant context for RLS
async function setTenantContext(tenantId) {
  await supabase.rpc('set_config', {
    setting: 'app.tenant_id',
    value: tenantId
  });
}

// Test Results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message) {
  results.tests.push({ name, passed, message });
  if (passed) {
    console.log(`✅ ${name}`);
    results.passed++;
  } else {
    console.log(`❌ ${name}: ${message}`);
    results.failed++;
  }
}

// =============================================================================
// TEST SETUP
// =============================================================================

async function setupTestData() {
  console.log('\n🔧 Setting up test data...');
  
  // Create test SKU
  const { data: sku, error: skuError } = await supabase
    .from('logistics_warehouse_skus')
    .insert({
      tenant_id: TENANT_ID,
      sku_code: 'TEST-R4-001',
      description: 'Test SKU for R4',
      unit_cost: 10.00,
      uom: 'EA',
      status: 'active'
    })
    .select()
    .single();
  
  if (skuError) throw new Error(`Failed to create SKU: ${skuError.message}`);
  
  console.log('✅ Test data setup complete');
  
  return {
    sku_id: sku.id,
    vendor_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' // Placeholder
  };
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  await supabase
    .from('logistics_warehouse_receipt_line_items')
    .delete()
    .like('receipt_id', '%');
  
  await supabase
    .from('logistics_warehouse_receipts')
    .delete()
    .like('po_number', 'TEST-R4-%');
  
  await supabase
    .from('logistics_warehouse_skus')
    .delete()
    .eq('sku_code', 'TEST-R4-001');
  
  console.log('✅ Cleanup complete');
}

// =============================================================================
// TEST: AC4.1 - First Receipt Creation (Baseline)
// =============================================================================

async function testFirstReceiptCreation(testData) {
  console.log('\n📝 Testing AC4.1: First Receipt Creation');
  
  await setTenantContext(TENANT_ID);
  
  const { data: receipt1, error: error1 } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R4-001',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  logTest(
    'AC4.1: First receipt created successfully',
    !error1 && receipt1 !== null,
    error1 ? error1.message : 'Receipt created'
  );
  
  return receipt1?.id;
}

// =============================================================================
// TEST: AC4.2 - Duplicate Detection
// =============================================================================

async function testDuplicateDetection(testData) {
  console.log('\n📝 Testing AC4.2: Duplicate Detection');
  
  await setTenantContext(TENANT_ID);
  
  // Attempt to create duplicate receipt (same tenant + PO + vendor + date)
  const { data: receipt2, error: error2 } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R4-001',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  // Should fail with unique constraint violation
  const isDuplicateRejected = error2 && error2.code === '23505'; // PostgreSQL unique violation
  
  logTest(
    'AC4.2: Duplicate receipt rejected',
    isDuplicateRejected,
    error2 ? `Constraint violation detected: ${error2.code}` : 'Duplicate was NOT rejected (BUG)'
  );
  
  // Verify error message contains useful info
  if (error2) {
    const hasUsefulMessage = error2.message.includes('idx_receipts_unique') || 
                             error2.message.includes('duplicate');
    logTest(
      'AC4.2: Error message informative',
      hasUsefulMessage,
      `Message: ${error2.message}`
    );
  }
}

// =============================================================================
// TEST: AC4.3 - Different Receipt Allowed
// =============================================================================

async function testDifferentReceiptAllowed(testData) {
  console.log('\n📝 Testing AC4.3: Different Receipt Allowed');
  
  await setTenantContext(TENANT_ID);
  
  // Different PO number → should succeed
  const { data: receipt3, error: error3 } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R4-002', // Different PO
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  logTest(
    'AC4.3: Different PO number allowed',
    !error3 && receipt3 !== null,
    error3 ? error3.message : 'Different receipt created'
  );
  
  // Different date → should succeed
  const { data: receipt4, error: error4 } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R4-001', // Same PO
      vendor_id: testData.vendor_id,
      received_date: '2026-08-23', // Different date
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  logTest(
    'AC4.3: Different date allowed',
    !error4 && receipt4 !== null,
    error4 ? error4.message : 'Different date receipt created'
  );
}

// =============================================================================
// TEST: AC4.4 - Soft Delete Respect
// =============================================================================

async function testSoftDeleteRespect(testData, firstReceiptId) {
  console.log('\n📝 Testing AC4.4: Soft Delete Respect');
  
  await setTenantContext(TENANT_ID);
  
  // Soft delete first receipt
  const { error: deleteError } = await supabase
    .from('logistics_warehouse_receipts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', firstReceiptId);
  
  if (deleteError) {
    logTest(
      'AC4.4: Soft delete failed',
      false,
      deleteError.message
    );
    return;
  }
  
  // Now try to create receipt with same PO + vendor + date
  // Should succeed because deleted_at IS NOT NULL
  const { data: receipt5, error: error5 } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R4-001',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  logTest(
    'AC4.4: Soft-deleted receipt allows recreation',
    !error5 && receipt5 !== null,
    error5 ? error5.message : 'Soft delete pattern respected'
  );
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('E6 — R4 RECEIPT UNIQUE CONSTRAINT TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let testData;
  let firstReceiptId;
  
  try {
    // Setup
    await setTenantContext(TENANT_ID);
    testData = await setupTestData();
    
    // Run tests
    firstReceiptId = await testFirstReceiptCreation(testData);
    await testDuplicateDetection(testData);
    await testDifferentReceiptAllowed(testData);
    await testSoftDeleteRespect(testData, firstReceiptId);
    
    // Cleanup
    await cleanupTestData();
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total: ${results.passed + results.failed}`);
    
    if (results.failed > 0) {
      console.log('\n❌ R4 VERIFICATION FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ R4 VERIFICATION PASS');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Test execution error:', error.message);
    if (testData) {
      await cleanupTestData();
    }
    process.exit(1);
  }
}

runTests();
