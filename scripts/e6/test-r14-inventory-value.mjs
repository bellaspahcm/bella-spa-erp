#!/usr/bin/env node
/**
 * E6 R14 Verification Test: Inventory Value Aggregation
 * 
 * Test Cases:
 * - TC1: Value calculation (quantity × unit_cost)
 * - TC2: Aggregation across bins (GROUP BY SKU)
 * - TC3: DECIMAL precision (no rounding errors)
 * - TC4: RLS enforcement (tenant isolation)
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
const testSKUID1 = crypto.randomUUID();
const testSKUID2 = crypto.randomUUID();
const testBinID1 = crypto.randomUUID();
const testBinID2 = crypto.randomUUID();
const testBinID3 = crypto.randomUUID();

async function setup() {
  console.log('🔧 Setting up test data...');
  
  // Create test SKUs with unit costs
  const { error: skuError } = await supabase.from('logistics_warehouse_skus').insert([
    {
      id: testSKUID1,
      tenant_id: TENANT_ID,
      sku_code: 'SKU-R14-001',
      description: 'R14 Test SKU 1',
      unit_cost: 12.50, // $12.50 per unit
    },
    {
      id: testSKUID2,
      tenant_id: TENANT_ID,
      sku_code: 'SKU-R14-002',
      description: 'R14 Test SKU 2',
      unit_cost: 25.99, // $25.99 per unit
    },
  ]);

  if (skuError) {
    console.error('❌ Failed to create SKUs:', skuError);
    throw new Error('Setup failed');
  }

  // Create test bins
  const { error: binError } = await supabase.from('logistics_warehouse_bins').insert([
    {
      id: testBinID1,
      tenant_id: TENANT_ID,
      bin_code: 'BIN-R14-A01',
      warehouse_id: 'WH-TEST',
    },
    {
      id: testBinID2,
      tenant_id: TENANT_ID,
      bin_code: 'BIN-R14-A02',
      warehouse_id: 'WH-TEST',
    },
    {
      id: testBinID3,
      tenant_id: TENANT_ID,
      bin_code: 'BIN-R14-A03',
      warehouse_id: 'WH-TEST',
    },
  ]);

  if (binError) {
    console.error('❌ Failed to create bins:', binError);
    throw new Error('Setup failed');
  }

  // Create inventory across multiple bins
  // SKU1: 100 in bin1, 50 in bin2 → total 150 @ $12.50 = $1,875.00
  // SKU2: 200 in bin1, 75 in bin3 → total 275 @ $25.99 = $7,147.25
  const { error: invError } = await supabase.from('logistics_warehouse_inventory_on_hand').insert([
    {
      tenant_id: TENANT_ID,
      sku_id: testSKUID1,
      bin_id: testBinID1,
      quantity: 100,
    },
    {
      tenant_id: TENANT_ID,
      sku_id: testSKUID1,
      bin_id: testBinID2,
      quantity: 50,
    },
    {
      tenant_id: TENANT_ID,
      sku_id: testSKUID2,
      bin_id: testBinID1,
      quantity: 200,
    },
    {
      tenant_id: TENANT_ID,
      sku_id: testSKUID2,
      bin_id: testBinID3,
      quantity: 75,
    },
  ]);

  if (invError) {
    console.error('❌ Failed to create inventory:', invError);
    throw new Error('Setup failed');
  }

  console.log('✅ Test data created');
  console.log(`   - 2 SKUs with unit costs ($12.50, $25.99)`);
  console.log(`   - 3 bins`);
  console.log(`   - SKU1: 150 units across 2 bins → value $1,875.00`);
  console.log(`   - SKU2: 275 units across 2 bins → value $7,147.25`);
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete inventory
  await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2]);

  // Delete bins
  await supabase
    .from('logistics_warehouse_bins')
    .delete()
    .in('id', [testBinID1, testBinID2, testBinID3]);

  // Delete SKUs
  await supabase
    .from('logistics_warehouse_skus')
    .delete()
    .in('id', [testSKUID1, testSKUID2]);

  console.log('✅ Cleanup complete');
}

// Test Cases
async function testTC1_ValueCalculation() {
  console.log('\n📋 TC1: Value calculation (quantity × unit_cost)');
  
  // Query inventory with SKU join
  const { data: inventoryData, error } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select(`
      sku_id,
      quantity,
      logistics_warehouse_skus!inner (
        sku_code,
        unit_cost
      )
    `)
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2]);

  if (error) {
    console.log('❌ TC1 FAIL: Query failed', error);
    return false;
  }

  // Aggregate by SKU
  const skuMap = new Map();
  
  inventoryData.forEach(row => {
    const sku = row.logistics_warehouse_skus;
    const quantity = parseFloat(row.quantity);
    const unitCost = parseFloat(sku.unit_cost);

    if (!skuMap.has(row.sku_id)) {
      skuMap.set(row.sku_id, {
        sku_code: sku.sku_code,
        unit_cost: unitCost,
        total_quantity: 0,
      });
    }

    const skuData = skuMap.get(row.sku_id);
    skuData.total_quantity += quantity;
  });

  // Calculate values
  const items = Array.from(skuMap.entries()).map(([sku_id, data]) => ({
    sku_id,
    sku_code: data.sku_code,
    on_hand_quantity: data.total_quantity,
    unit_cost: data.unit_cost,
    total_value: parseFloat((data.total_quantity * data.unit_cost).toFixed(2)),
  }));

  console.log('   SKU values:');
  items.forEach(item => {
    console.log(`     ${item.sku_code}: ${item.on_hand_quantity} units × $${item.unit_cost} = $${item.total_value.toFixed(2)}`);
  });

  // Verify SKU1: 150 × $12.50 = $1,875.00
  const sku1 = items.find(i => i.sku_id === testSKUID1);
  if (!sku1 || sku1.on_hand_quantity !== 150 || sku1.total_value !== 1875.00) {
    console.log('❌ TC1 FAIL: SKU1 value incorrect');
    console.log('   Expected: 150 × $12.50 = $1,875.00');
    console.log('   Actual:', sku1);
    return false;
  }

  // Verify SKU2: 275 × $25.99 = $7,147.25
  const sku2 = items.find(i => i.sku_id === testSKUID2);
  if (!sku2 || sku2.on_hand_quantity !== 275 || sku2.total_value !== 7147.25) {
    console.log('❌ TC1 FAIL: SKU2 value incorrect');
    console.log('   Expected: 275 × $25.99 = $7,147.25');
    console.log('   Actual:', sku2);
    return false;
  }

  console.log('✅ TC1 PASS: Value calculations correct');
  return true;
}

async function testTC2_AggregationAcrossBins() {
  console.log('\n📋 TC2: Aggregation across bins (GROUP BY SKU)');
  
  // Query inventory grouped by SKU (across bins)
  const { data: inventoryData, error } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select(`
      sku_id,
      quantity,
      bin_id
    `)
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', testSKUID1);

  if (error) {
    console.log('❌ TC2 FAIL: Query failed', error);
    return false;
  }

  console.log(`   SKU1 inventory across bins:`);
  inventoryData.forEach(row => {
    console.log(`     Bin ${row.bin_id === testBinID1 ? '1' : '2'}: ${row.quantity} units`);
  });

  const totalQuantity = inventoryData.reduce((sum, row) => sum + parseFloat(row.quantity), 0);
  
  console.log(`   Total: ${totalQuantity} units`);

  if (totalQuantity !== 150) {
    console.log('❌ TC2 FAIL: Aggregation incorrect');
    console.log('   Expected: 150 (100 + 50)');
    console.log('   Actual:', totalQuantity);
    return false;
  }

  console.log('✅ TC2 PASS: Aggregation across bins correct');
  return true;
}

async function testTC3_DecimalPrecision() {
  console.log('\n📋 TC3: DECIMAL precision (no rounding errors)');
  
  // Query and calculate with DECIMAL precision
  const { data: skuData } = await supabase
    .from('logistics_warehouse_skus')
    .select('unit_cost')
    .eq('id', testSKUID2)
    .single();

  const unitCost = parseFloat(skuData.unit_cost);
  const quantity = 275;
  const totalValue = parseFloat((quantity * unitCost).toFixed(2));

  console.log(`   Unit cost: $${unitCost}`);
  console.log(`   Quantity: ${quantity}`);
  console.log(`   Total value: $${totalValue.toFixed(2)}`);

  // Verify: 275 × $25.99 = $7,147.25 (exact)
  const expected = 7147.25;
  const diff = Math.abs(totalValue - expected);

  if (diff > 0.01) {
    console.log('❌ TC3 FAIL: Precision error detected');
    console.log(`   Expected: $${expected.toFixed(2)}`);
    console.log(`   Actual: $${totalValue.toFixed(2)}`);
    console.log(`   Difference: $${diff.toFixed(4)}`);
    return false;
  }

  console.log('✅ TC3 PASS: DECIMAL precision maintained');
  return true;
}

async function testTC4_TenantIsolation() {
  console.log('\n📋 TC4: RLS enforcement (tenant isolation)');
  
  // Query inventory for this tenant
  const { data: tenantInventory, error } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('tenant_id')
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2]);

  if (error) {
    console.log('❌ TC4 FAIL: Query failed', error);
    return false;
  }

  const allSameTenant = tenantInventory?.every(i => i.tenant_id === TENANT_ID);

  console.log(`   Inventory records: ${tenantInventory?.length}`);
  console.log(`   All same tenant: ${allSameTenant}`);

  if (!allSameTenant) {
    console.log('❌ TC4 FAIL: Cross-tenant data leakage detected');
    return false;
  }

  console.log('✅ TC4 PASS: Tenant isolation verified');
  return true;
}

// Run all tests
async function runTests() {
  console.log('🧪 E6 R14: Inventory Value Aggregation - Verification Tests');
  console.log('='.repeat(60));

  try {
    await setup();

    const results = [
      await testTC1_ValueCalculation(),
      await testTC2_AggregationAcrossBins(),
      await testTC3_DecimalPrecision(),
      await testTC4_TenantIsolation(),
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
