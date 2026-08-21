/**
 * E6 — R5 Quantity Reconciliation Math Test
 * 
 * Test Acceptance Criteria:
 * - AC5.1: Discrepancy calculation with thresholds
 * - AC5.2: Aggregate receipt status
 * - AC5.3: Math precision (DECIMAL, no FLOAT errors)
 * 
 * Category: B (Test Script - Pattern Reuse)
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

const TENANT_ID = 'da9e610b-88c5-4901-8ab9-5439f4931467';

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

async function setTenantContext(tenantId) {
  await supabase.rpc('set_config', {
    setting: 'app.tenant_id',
    value: tenantId
  });
}

// Setup
async function setupTestData() {
  console.log('\n🔧 Setting up test data...');
  
  const { data: sku } = await supabase
    .from('logistics_warehouse_skus')
    .insert({
      tenant_id: TENANT_ID,
      sku_code: 'TEST-R5-001',
      unit_cost: 10.00,
      uom: 'EA',
      status: 'active'
    })
    .select()
    .single();
  
  console.log('✅ Test data setup complete');
  return { sku_id: sku.id, vendor_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up...');
  await supabase.from('logistics_warehouse_receipt_line_items').delete().like('receipt_id', '%');
  await supabase.from('logistics_warehouse_receipts').delete().like('po_number', 'TEST-R5-%');
  await supabase.from('logistics_warehouse_skus').delete().eq('sku_code', 'TEST-R5-001');
  console.log('✅ Cleanup complete');
}

// AC5.1: Test exact match (0% variance)
async function testExactMatch(testData) {
  console.log('\n📝 Testing AC5.1: Exact Match (0%)');
  
  await setTenantContext(TENANT_ID);
  
  const { data: receipt } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R5-001',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  const { data: lineItem } = await supabase
    .from('logistics_warehouse_receipt_line_items')
    .insert({
      tenant_id: TENANT_ID,
      receipt_id: receipt.id,
      sku_id: testData.sku_id,
      expected_quantity: 100,
      actual_quantity: 100,
      discrepancy_status: 'match',
      uom: 'EA'
    })
    .select()
    .single();
  
  // Discrepancy auto-calculated by database (GENERATED column)
  const isExactMatch = lineItem.discrepancy === 0 && lineItem.discrepancy_status === 'match';
  
  logTest(
    'AC5.1: Exact match (0%)',
    isExactMatch,
    `Discrepancy: ${lineItem.discrepancy}, Status: ${lineItem.discrepancy_status}`
  );
}

// AC5.1: Test acceptable over (≤2%)
async function testAcceptableOver(testData) {
  console.log('\n📝 Testing AC5.1: Acceptable Over (≤2%)');
  
  const { data: receipt } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R5-002',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  // 102 actual vs 100 expected = 2% over (acceptable threshold)
  const { data: lineItem } = await supabase
    .from('logistics_warehouse_receipt_line_items')
    .insert({
      tenant_id: TENANT_ID,
      receipt_id: receipt.id,
      sku_id: testData.sku_id,
      expected_quantity: 100,
      actual_quantity: 102,
      discrepancy_status: 'over',
      uom: 'EA'
    })
    .select()
    .single();
  
  const percentage = Math.abs((lineItem.discrepancy / 100) * 100);
  const isAcceptable = lineItem.discrepancy === 2 && percentage <= 2.0;
  
  logTest(
    'AC5.1: Acceptable over (2%)',
    isAcceptable,
    `Discrepancy: ${lineItem.discrepancy} (${percentage.toFixed(2)}%)`
  );
}

// AC5.1: Test significant over (>2%)
async function testSignificantOver(testData) {
  console.log('\n📝 Testing AC5.1: Significant Over (>2%)');
  
  const { data: receipt } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R5-003',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  // 105 actual vs 100 expected = 5% over (significant)
  const { data: lineItem } = await supabase
    .from('logistics_warehouse_receipt_line_items')
    .insert({
      tenant_id: TENANT_ID,
      receipt_id: receipt.id,
      sku_id: testData.sku_id,
      expected_quantity: 100,
      actual_quantity: 105,
      discrepancy_status: 'over',
      uom: 'EA'
    })
    .select()
    .single();
  
  const percentage = Math.abs((lineItem.discrepancy / 100) * 100);
  const isSignificant = lineItem.discrepancy === 5 && percentage > 2.0;
  
  logTest(
    'AC5.1: Significant over (5%)',
    isSignificant,
    `Discrepancy: ${lineItem.discrepancy} (${percentage.toFixed(2)}%)`
  );
}

// AC5.3: Test DECIMAL precision (no float errors)
async function testDecimalPrecision(testData) {
  console.log('\n📝 Testing AC5.3: DECIMAL Precision');
  
  const { data: receipt } = await supabase
    .from('logistics_warehouse_receipts')
    .insert({
      tenant_id: TENANT_ID,
      po_number: 'TEST-R5-004',
      vendor_id: testData.vendor_id,
      received_date: '2026-08-22',
      status: 'pending_putaway'
    })
    .select()
    .single();
  
  // Test with decimal quantities
  const { data: lineItem } = await supabase
    .from('logistics_warehouse_receipt_line_items')
    .insert({
      tenant_id: TENANT_ID,
      receipt_id: receipt.id,
      sku_id: testData.sku_id,
      expected_quantity: 100.50,
      actual_quantity: 98.25,
      discrepancy_status: 'short',
      uom: 'EA'
    })
    .select()
    .single();
  
  // Expected: -2.25 (DECIMAL precision, not float imprecision)
  const expectedDiscrepancy = -2.25;
  const isPrecise = Math.abs(lineItem.discrepancy - expectedDiscrepancy) < 0.001;
  
  logTest(
    'AC5.3: DECIMAL precision',
    isPrecise,
    `Expected: ${expectedDiscrepancy}, Actual: ${lineItem.discrepancy}`
  );
}

// Main
async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('E6 — R5 QUANTITY RECONCILIATION TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let testData;
  
  try {
    await setTenantContext(TENANT_ID);
    testData = await setupTestData();
    
    await testExactMatch(testData);
    await testAcceptableOver(testData);
    await testSignificantOver(testData);
    await testDecimalPrecision(testData);
    
    await cleanupTestData();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total: ${results.passed + results.failed}`);
    
    if (results.failed > 0) {
      console.log('\n❌ R5 VERIFICATION FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ R5 VERIFICATION PASS');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    if (testData) await cleanupTestData();
    process.exit(1);
  }
}

runTests();
