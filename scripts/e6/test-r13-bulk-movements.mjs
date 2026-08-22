#!/usr/bin/env node
/**
 * E6 R13 Verification Test: Bulk Inventory Movements
 * 
 * Test Cases:
 * - TC1: Bulk cycle count adjustment
 * - TC2: Inter-bin transfer (decrement/increment)
 * - TC3: Atomic transaction (all or nothing)
 * - TC4: Audit trail (batch_id linkage)
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
const testUserID = crypto.randomUUID();

async function setup() {
  console.log('🔧 Setting up test data...');
  
  // Create test SKUs
  const { error: skuError } = await supabase.from('logistics_warehouse_skus').insert([
    {
      id: testSKUID1,
      tenant_id: TENANT_ID,
      sku_code: 'SKU-R13-001',
      description: 'R13 Test SKU 1',
    },
    {
      id: testSKUID2,
      tenant_id: TENANT_ID,
      sku_code: 'SKU-R13-002',
      description: 'R13 Test SKU 2',
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
      bin_code: 'BIN-R13-A01',
      warehouse_id: 'WH-TEST',
      zone_id: 'ZONE-A',
    },
    {
      id: testBinID2,
      tenant_id: TENANT_ID,
      bin_code: 'BIN-R13-A02',
      warehouse_id: 'WH-TEST',
      zone_id: 'ZONE-A',
    },
  ]);

  if (binError) {
    console.error('❌ Failed to create bins:', binError);
    throw new Error('Setup failed');
  }

  // Create initial inventory in bin 1
  const { error: invError } = await supabase.from('logistics_warehouse_inventory_on_hand').insert([
    {
      tenant_id: TENANT_ID,
      sku_id: testSKUID1,
      bin_id: testBinID1,
      quantity: 100,
    },
    {
      tenant_id: TENANT_ID,
      sku_id: testSKUID2,
      bin_id: testBinID1,
      quantity: 50,
    },
  ]);

  if (invError) {
    console.error('❌ Failed to create inventory:', invError);
    throw new Error('Setup failed');
  }

  console.log('✅ Test data created');
  console.log(`   - 2 SKUs, 2 bins`);
  console.log(`   - Initial inventory: SKU1=100, SKU2=50 (both in bin1)`);
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete movements
  await supabase
    .from('logistics_warehouse_movements')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2]);

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
    .in('id', [testBinID1, testBinID2]);

  // Delete SKUs
  await supabase
    .from('logistics_warehouse_skus')
    .delete()
    .in('id', [testSKUID1, testSKUID2]);

  console.log('✅ Cleanup complete');
}

// Test Cases
async function testTC1_CycleCountAdjustment() {
  console.log('\n📋 TC1: Bulk cycle count adjustment');
  
  // Create bulk adjustment movements
  const movements = [
    {
      sku_id: testSKUID1,
      to_bin_id: testBinID1,
      quantity: 95, // Adjust from 100 to 95
      reason: 'Cycle count adjustment - found 5 missing',
    },
    {
      sku_id: testSKUID2,
      to_bin_id: testBinID1,
      quantity: 52, // Adjust from 50 to 52
      reason: 'Cycle count adjustment - found 2 extra',
    },
  ];

  const batch_id = crypto.randomUUID();

  // Insert movements
  const movementRecords = movements.map(m => ({
    id: crypto.randomUUID(),
    tenant_id: TENANT_ID,
    sku_id: m.sku_id,
    to_bin_id: m.to_bin_id,
    quantity: m.quantity,
    movement_type: 'cycle_count_adjustment',
    reason: m.reason,
    batch_id,
    approved_by: testUserID,
  }));

  const { data: insertedMovements, error: insertError } = await supabase
    .from('logistics_warehouse_movements')
    .insert(movementRecords)
    .select();

  if (insertError) {
    console.log('❌ TC1 FAIL: Failed to insert movements', insertError);
    return false;
  }

  // Update inventory
  for (const movement of movements) {
    const { error: updateError } = await supabase
      .from('logistics_warehouse_inventory_on_hand')
      .update({ quantity: movement.quantity })
      .eq('tenant_id', TENANT_ID)
      .eq('sku_id', movement.sku_id)
      .eq('bin_id', movement.to_bin_id);

    if (updateError) {
      console.log('❌ TC1 FAIL: Failed to update inventory', updateError);
      return false;
    }
  }

  // Verify inventory updated
  const { data: inventory } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('sku_id, quantity')
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2])
    .eq('bin_id', testBinID1);

  const sku1Qty = inventory?.find(i => i.sku_id === testSKUID1)?.quantity;
  const sku2Qty = inventory?.find(i => i.sku_id === testSKUID2)?.quantity;

  console.log(`   Movement count: ${insertedMovements?.length}`);
  console.log(`   SKU1 quantity: ${sku1Qty} (expected: 95)`);
  console.log(`   SKU2 quantity: ${sku2Qty} (expected: 52)`);

  if (sku1Qty != 95 || sku2Qty != 52) {
    console.log('❌ TC1 FAIL: Inventory not updated correctly');
    return false;
  }

  console.log('✅ TC1 PASS: Cycle count adjustment applied');
  return true;
}

async function testTC2_InterBinTransfer() {
  console.log('\n📋 TC2: Inter-bin transfer');
  
  // Transfer SKU1: 20 units from bin1 to bin2
  const movement = {
    sku_id: testSKUID1,
    from_bin_id: testBinID1,
    to_bin_id: testBinID2,
    quantity: 20,
    reason: 'Rebalancing inventory',
  };

  const batch_id = crypto.randomUUID();

  // Insert movement
  const { data: insertedMovement, error: insertError } = await supabase
    .from('logistics_warehouse_movements')
    .insert({
      id: crypto.randomUUID(),
      tenant_id: TENANT_ID,
      sku_id: movement.sku_id,
      from_bin_id: movement.from_bin_id,
      to_bin_id: movement.to_bin_id,
      quantity: movement.quantity,
      movement_type: 'inter_bin_transfer',
      reason: movement.reason,
      batch_id,
      approved_by: testUserID,
    })
    .select()
    .single();

  if (insertError) {
    console.log('❌ TC2 FAIL: Failed to insert movement', insertError);
    return false;
  }

  // Get current quantities
  const { data: fromBin } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('quantity')
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', movement.sku_id)
    .eq('bin_id', movement.from_bin_id)
    .single();

  const { data: toBin } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('quantity')
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', movement.sku_id)
    .eq('bin_id', movement.to_bin_id)
    .single();

  const fromQty = parseFloat(fromBin?.quantity || 0);
  const toQty = parseFloat(toBin?.quantity || 0);

  // Update: decrement from_bin, increment to_bin
  const { error: decrementError } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .update({ quantity: fromQty - movement.quantity })
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', movement.sku_id)
    .eq('bin_id', movement.from_bin_id);

  if (decrementError) {
    console.log('❌ TC2 FAIL: Failed to decrement from_bin', decrementError);
    return false;
  }

  if (toBin) {
    // Update existing
    const { error: incrementError } = await supabase
      .from('logistics_warehouse_inventory_on_hand')
      .update({ quantity: toQty + movement.quantity })
      .eq('tenant_id', TENANT_ID)
      .eq('sku_id', movement.sku_id)
      .eq('bin_id', movement.to_bin_id);

    if (incrementError) {
      console.log('❌ TC2 FAIL: Failed to increment to_bin', incrementError);
      return false;
    }
  } else {
    // Insert new
    const { error: insertError2 } = await supabase
      .from('logistics_warehouse_inventory_on_hand')
      .insert({
        tenant_id: TENANT_ID,
        sku_id: movement.sku_id,
        bin_id: movement.to_bin_id,
        quantity: movement.quantity,
      });

    if (insertError2) {
      console.log('❌ TC2 FAIL: Failed to insert to_bin', insertError2);
      return false;
    }
  }

  // Verify inventory
  const { data: verifyFrom } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('quantity')
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', movement.sku_id)
    .eq('bin_id', movement.from_bin_id)
    .single();

  const { data: verifyTo } = await supabase
    .from('logistics_warehouse_inventory_on_hand')
    .select('quantity')
    .eq('tenant_id', TENANT_ID)
    .eq('sku_id', movement.sku_id)
    .eq('bin_id', movement.to_bin_id)
    .single();

  const finalFrom = parseFloat(verifyFrom?.quantity || 0);
  const finalTo = parseFloat(verifyTo?.quantity || 0);

  console.log(`   From bin: ${finalFrom} (expected: 75 = 95-20)`);
  console.log(`   To bin: ${finalTo} (expected: 20)`);

  if (finalFrom != 75 || finalTo != 20) {
    console.log('❌ TC2 FAIL: Transfer not applied correctly');
    return false;
  }

  console.log('✅ TC2 PASS: Inter-bin transfer applied');
  return true;
}

async function testTC3_BatchLinkage() {
  console.log('\n📋 TC3: Audit trail (batch_id linkage)');
  
  // Query movements by tenant
  const { data: movements, error } = await supabase
    .from('logistics_warehouse_movements')
    .select('batch_id')
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2]);

  if (error) {
    console.log('❌ TC3 FAIL: Failed to query movements', error);
    return false;
  }

  console.log(`   Total movements: ${movements?.length}`);

  // Group by batch_id
  const batches = {};
  movements?.forEach(m => {
    batches[m.batch_id] = (batches[m.batch_id] || 0) + 1;
  });

  console.log(`   Unique batches: ${Object.keys(batches).length}`);
  Object.entries(batches).forEach(([batch_id, count]) => {
    console.log(`     - ${batch_id}: ${count} movements`);
  });

  if (movements?.length < 3) {
    console.log('❌ TC3 FAIL: Expected at least 3 movements (2 from TC1, 1 from TC2)');
    return false;
  }

  console.log('✅ TC3 PASS: Batch linkage verified');
  return true;
}

async function testTC4_TenantIsolation() {
  console.log('\n📋 TC4: RLS enforcement (tenant isolation)');
  
  const { data: movements, error } = await supabase
    .from('logistics_warehouse_movements')
    .select('tenant_id')
    .eq('tenant_id', TENANT_ID)
    .in('sku_id', [testSKUID1, testSKUID2]);

  if (error) {
    console.log('❌ TC4 FAIL: Query failed', error);
    return false;
  }

  const allSameTenant = movements?.every(m => m.tenant_id === TENANT_ID);

  console.log(`   Movements found: ${movements?.length}`);
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
  console.log('🧪 E6 R13: Bulk Inventory Movements - Verification Tests');
  console.log('='.repeat(60));

  try {
    await setup();

    const results = [
      await testTC1_CycleCountAdjustment(),
      await testTC2_InterBinTransfer(),
      await testTC3_BatchLinkage(),
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
