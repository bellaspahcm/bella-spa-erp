#!/usr/bin/env node
/**
 * E6 R15 Verification Test: Bin Capacity Constraint
 * 
 * Test Cases:
 * - TC1: Valid capacity check (within limit)
 * - TC2: Capacity exceeded (reject)
 * - TC3: Exact capacity (boundary case)
 * - TC4: Empty bin (full capacity available)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = 'da9e610b-88c5-4901-8ab9-5439f4931467';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data
const testSKUID = crypto.randomUUID();
const testBinID = crypto.randomUUID();

async function setup() {
  console.log('🔧 Setting up test data...');
  
  // Create test SKU
  const { error: skuError } = await supabase.from('logistics_warehouse_skus').insert({
    id: testSKUID,
    tenant_id: TENANT_ID,
    sku_code: 'SKU-R15-001',
    description: 'R15 Test SKU',
  });

  if (skuError) {
    console.error('❌ Failed to create SKU:', skuError);
    throw new Error('Setup failed');
  }

  // Create test bin with max_capacity = 1000
  const { error: binError } = await supabase.from('logistics_warehouse_bins').insert({
    id: testBinID,
    tenant_id: TENANT_ID,
    bin_code: 'BIN-R15-A01',
    warehouse_id: 'WH-TEST',
    max_capacity: 1000.00,
  });

  if (binError) {
    console.error('❌ Failed to create bin:', binError);
    throw new Error('Setup failed');
  }

  // Create initial inventory: 600 units (leaving 400 available)
  const { error: invError } = await supabase.from('logistics_warehouse_inventory_on_hand').insert({
    tenant_id: TENANT_ID,
    sku_id: testSKUID,
    bin_id: testBinID,
    quantity: 600,
  });

  if (invError) {
    console.error('❌ Failed to create inventory:', invError);
    throw new Error('Setup failed');
  }

  console.log('✅ Test data created');
  console.log(`   - Bin with max_capacity = 1000 units`);
  console.log(`   - Current inventory = 600 units`);
  console.log(`   - Available capacity = 400 units`);
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete inventory
  await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', testSKUID);

  // Delete bin
  await supabase
    .from('logistics_warehouse_bins')
    .delete()
    .eq('id', testBinID);

  // Delete SKU
  await supabase
    .from('logistics_warehouse_skus')
    .delete()
    .eq('id', testSKUID);

  console.log('✅ Cleanup complete');
}

// Capacity check logic (simulates service)
async function checkBinCapacity(bin_id, additional_quantity) {
  // Get bin max_capacity
  const { data: binData, error: binError } = await supabase
    .from('logistics_warehouse_bins')
    .select('max_capacity')
    .eq('id', bin_id)
    .eq('tenant_id', TENANT_ID)
    .single();

  if (binError || !binData) {
    throw new Error('Bin not found');
  }

  const max_capacity = parseFloat(binData.max_capacity);

  // Calculate current quantity
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('quantity')
    .eq('bin_id', bin_id)
    .eq('tenant_id', TENANT_ID);

  if (inventoryError) {
    throw new Error('Failed to query inventory');
  }

  const current_quantity = (inventoryData || []).reduce(
    (sum, row) => sum + parseFloat(row.quantity),
    0
  );

  // Capacity check
  const available_capacity = max_capacity - current_quantity;
  const is_valid = (current_quantity + additional_quantity) <= max_capacity;

  return {
    bin_id,
    max_capacity,
    current_quantity,
    available_capacity,
    requested_quantity: additional_quantity,
    is_valid,
    error_message: is_valid
      ? undefined
      : `Bin capacity exceeded: ${current_quantity + additional_quantity} > ${max_capacity}`,
  };
}

// Test Cases
async function testTC1_ValidCapacity() {
  console.log('\n📋 TC1: Valid capacity check (within limit)');
  
  // Attempt to add 300 units (600 current + 300 = 900 <= 1000)
  const result = await checkBinCapacity(testBinID, 300);

  console.log(`   Max capacity: ${result.max_capacity}`);
  console.log(`   Current quantity: ${result.current_quantity}`);
  console.log(`   Requested: ${result.requested_quantity}`);
  console.log(`   Available: ${result.available_capacity}`);
  console.log(`   Is valid: ${result.is_valid}`);

  if (!result.is_valid) {
    console.log('❌ TC1 FAIL: Should accept within capacity');
    return false;
  }

  if (result.current_quantity !== 600) {
    console.log('❌ TC1 FAIL: Current quantity incorrect');
    return false;
  }

  if (result.available_capacity !== 400) {
    console.log('❌ TC1 FAIL: Available capacity incorrect');
    return false;
  }

  console.log('✅ TC1 PASS: Valid capacity accepted');
  return true;
}

async function testTC2_CapacityExceeded() {
  console.log('\n📋 TC2: Capacity exceeded (reject)');
  
  // Attempt to add 500 units (600 current + 500 = 1100 > 1000)
  const result = await checkBinCapacity(testBinID, 500);

  console.log(`   Max capacity: ${result.max_capacity}`);
  console.log(`   Current quantity: ${result.current_quantity}`);
  console.log(`   Requested: ${result.requested_quantity}`);
  console.log(`   Total would be: ${result.current_quantity + result.requested_quantity}`);
  console.log(`   Is valid: ${result.is_valid}`);
  console.log(`   Error: ${result.error_message || 'none'}`);

  if (result.is_valid) {
    console.log('❌ TC2 FAIL: Should reject capacity exceeded');
    return false;
  }

  if (!result.error_message) {
    console.log('❌ TC2 FAIL: Error message not provided');
    return false;
  }

  console.log('✅ TC2 PASS: Capacity exceeded rejected');
  return true;
}

async function testTC3_ExactCapacity() {
  console.log('\n📋 TC3: Exact capacity (boundary case)');
  
  // Attempt to add exactly 400 units (600 current + 400 = 1000 == max)
  const result = await checkBinCapacity(testBinID, 400);

  console.log(`   Max capacity: ${result.max_capacity}`);
  console.log(`   Current quantity: ${result.current_quantity}`);
  console.log(`   Requested: ${result.requested_quantity}`);
  console.log(`   Total: ${result.current_quantity + result.requested_quantity}`);
  console.log(`   Is valid: ${result.is_valid}`);

  if (!result.is_valid) {
    console.log('❌ TC3 FAIL: Should accept exact capacity');
    return false;
  }

  console.log('✅ TC3 PASS: Exact capacity accepted');
  return true;
}

async function testTC4_EmptyBin() {
  console.log('\n📋 TC4: Empty bin (full capacity available)');
  
  // Create empty bin
  const emptyBinID = crypto.randomUUID();
  await supabase.from('logistics_warehouse_bins').insert({
    id: emptyBinID,
    tenant_id: TENANT_ID,
    bin_code: 'BIN-R15-EMPTY',
    warehouse_id: 'WH-TEST',
    max_capacity: 500.00,
  });

  // Check capacity for empty bin
  const result = await checkBinCapacity(emptyBinID, 500);

  console.log(`   Max capacity: ${result.max_capacity}`);
  console.log(`   Current quantity: ${result.current_quantity}`);
  console.log(`   Requested: ${result.requested_quantity}`);
  console.log(`   Available: ${result.available_capacity}`);
  console.log(`   Is valid: ${result.is_valid}`);

  // Cleanup empty bin
  await supabase
    .from('logistics_warehouse_bins')
    .delete()
    .eq('id', emptyBinID);

  if (result.current_quantity !== 0) {
    console.log('❌ TC4 FAIL: Empty bin should have 0 current quantity');
    return false;
  }

  if (result.available_capacity !== 500) {
    console.log('❌ TC4 FAIL: Empty bin should have full capacity available');
    return false;
  }

  if (!result.is_valid) {
    console.log('❌ TC4 FAIL: Should accept request within empty bin capacity');
    return false;
  }

  console.log('✅ TC4 PASS: Empty bin capacity check correct');
  return true;
}

// Run all tests
async function runTests() {
  console.log('🧪 E6 R15: Bin Capacity Constraint - Verification Tests');
  console.log('='.repeat(60));

  try {
    await setup();

    const results = [
      await testTC1_ValidCapacity(),
      await testTC2_CapacityExceeded(),
      await testTC3_ExactCapacity(),
      await testTC4_EmptyBin(),
    ];

    await cleanup();

    console.log('\n' + '='.repeat(60));
    const passed = results.filter(Boolean).length;
    const total = results.length;
    
    if (passed === total) {
      console.log(`✅ ALL TESTS PASSED (${passed}/${total})`);
      process.exit(0);
    } else {
      console.log(`❌ SOME TESTS FAILED (${passed}/${total})`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    await cleanup();
    process.exit(1);
  }
}

runTests();
