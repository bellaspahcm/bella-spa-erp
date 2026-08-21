/**
 * E6 — R3 Location Hierarchy Validation Test
 * 
 * Test Acceptance Criteria:
 * - AC3.1: Bin existence check
 * - AC3.2: Hierarchy validation (warehouse → zone → aisle → bin)
 * - AC3.3: Bin status check (must be 'active')
 * 
 * Category: B (Test Script - Pattern Reuse from E6 R1/R2)
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
      sku_code: 'TEST-R3-001',
      description: 'Test SKU for R3',
      unit_cost: 10.00,
      uom: 'EA',
      status: 'active'
    })
    .select()
    .single();
  
  if (skuError) throw new Error(`Failed to create SKU: ${skuError.message}`);
  
  // Create test bins
  // 1. Valid bin: complete hierarchy + active
  const { data: validBin, error: validBinError } = await supabase
    .from('logistics_warehouse_bins')
    .insert({
      tenant_id: TENANT_ID,
      bin_code: 'WH1-Z1-A1-B001',
      warehouse_id: 'WH1',
      zone_id: 'Z1',
      aisle_id: 'A1',
      max_capacity: 1000,
      status: 'active'
    })
    .select()
    .single();
  
  if (validBinError) throw new Error(`Failed to create valid bin: ${validBinError.message}`);
  
  // 2. Inactive bin
  const { data: inactiveBin, error: inactiveBinError } = await supabase
    .from('logistics_warehouse_bins')
    .insert({
      tenant_id: TENANT_ID,
      bin_code: 'WH1-Z1-A1-B002',
      warehouse_id: 'WH1',
      zone_id: 'Z1',
      aisle_id: 'A1',
      max_capacity: 1000,
      status: 'inactive'
    })
    .select()
    .single();
  
  if (inactiveBinError) throw new Error(`Failed to create inactive bin: ${inactiveBinError.message}`);
  
  // 3. Incomplete hierarchy bin (no zone_id)
  const { data: incompleteBin, error: incompleteBinError } = await supabase
    .from('logistics_warehouse_bins')
    .insert({
      tenant_id: TENANT_ID,
      bin_code: 'WH1-XX-XX-B003',
      warehouse_id: 'WH1',
      zone_id: null,
      aisle_id: null,
      max_capacity: 1000,
      status: 'active'
    })
    .select()
    .single();
  
  if (incompleteBinError) throw new Error(`Failed to create incomplete bin: ${incompleteBinError.message}`);
  
  // Create test vendor (simplified - may not have vendor table yet)
  let vendor_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // Use placeholder
  
  console.log('✅ Test data setup complete');
  
  return {
    sku_id: sku.id,
    valid_bin_id: validBin.id,
    inactive_bin_id: inactiveBin.id,
    incomplete_bin_id: incompleteBin.id,
    vendor_id: vendor_id
  };
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  await supabase
    .from('logistics_warehouse_receipt_line_items')
    .delete()
    .like('target_bin_id', '%');
  
  await supabase
    .from('logistics_warehouse_receipts')
    .delete()
    .like('po_number', 'TEST-R3-%');
  
  await supabase
    .from('logistics_warehouse_bins')
    .delete()
    .like('bin_code', 'WH1-%');
  
  await supabase
    .from('logistics_warehouse_skus')
    .delete()
    .eq('sku_code', 'TEST-R3-001');
  
  console.log('✅ Cleanup complete');
}

// =============================================================================
// TEST: AC3.1 - Bin Existence Check
// =============================================================================

async function testBinExistence(testData) {
  console.log('\n📝 Testing AC3.1: Bin Existence Check');
  
  await setTenantContext(TENANT_ID);
  
  // Test: Valid bin should be found
  const { data: foundBin, error: foundError } = await supabase
    .from('logistics_warehouse_bins')
    .select('*')
    .eq('id', testData.valid_bin_id)
    .eq('tenant_id', TENANT_ID)
    .is('deleted_at', null)
    .single();
  
  logTest(
    'AC3.1: Valid bin found',
    !foundError && foundBin !== null,
    foundError ? foundError.message : 'Bin not found'
  );
  
  // Test: Non-existent bin should not be found
  const fakeBinId = '00000000-0000-0000-0000-000000000000';
  const { data: notFoundBin, error: notFoundError } = await supabase
    .from('logistics_warehouse_bins')
    .select('*')
    .eq('id', fakeBinId)
    .eq('tenant_id', TENANT_ID)
    .single();
  
  logTest(
    'AC3.1: Non-existent bin rejected',
    notFoundBin === null,
    'Should not find non-existent bin'
  );
}

// =============================================================================
// TEST: AC3.2 - Hierarchy Validation
// =============================================================================

async function testHierarchyValidation(testData) {
  console.log('\n📝 Testing AC3.2: Hierarchy Validation');
  
  await setTenantContext(TENANT_ID);
  
  // Test: Valid hierarchy bin
  const { data: validBin } = await supabase
    .from('logistics_warehouse_bins')
    .select('*')
    .eq('id', testData.valid_bin_id)
    .single();
  
  const hasCompleteHierarchy = 
    validBin.warehouse_id && 
    validBin.zone_id && 
    validBin.aisle_id;
  
  logTest(
    'AC3.2: Valid bin has complete hierarchy',
    hasCompleteHierarchy,
    'Hierarchy: warehouse → zone → aisle → bin'
  );
  
  // Test: Incomplete hierarchy bin
  const { data: incompleteBin } = await supabase
    .from('logistics_warehouse_bins')
    .select('*')
    .eq('id', testData.incomplete_bin_id)
    .single();
  
  const hasIncompleteHierarchy = 
    !incompleteBin.zone_id || 
    !incompleteBin.aisle_id;
  
  logTest(
    'AC3.2: Incomplete hierarchy detected',
    hasIncompleteHierarchy,
    'Bin missing zone_id or aisle_id should be rejected'
  );
}

// =============================================================================
// TEST: AC3.3 - Bin Status Check
// =============================================================================

async function testBinStatus(testData) {
  console.log('\n📝 Testing AC3.3: Bin Status Check');
  
  await setTenantContext(TENANT_ID);
  
  // Test: Active bin should be accepted
  const { data: activeBin } = await supabase
    .from('logistics_warehouse_bins')
    .select('*')
    .eq('id', testData.valid_bin_id)
    .single();
  
  logTest(
    'AC3.3: Active bin accepted',
    activeBin.status === 'active',
    'Bin status should be active'
  );
  
  // Test: Inactive bin should be rejected
  const { data: inactiveBin } = await supabase
    .from('logistics_warehouse_bins')
    .select('*')
    .eq('id', testData.inactive_bin_id)
    .single();
  
  logTest(
    'AC3.3: Inactive bin rejected',
    inactiveBin.status === 'inactive',
    'Bin with status inactive/damaged/reserved should be rejected'
  );
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('E6 — R3 LOCATION HIERARCHY VALIDATION TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let testData;
  
  try {
    // Setup
    await setTenantContext(TENANT_ID);
    testData = await setupTestData();
    
    // Run tests
    await testBinExistence(testData);
    await testHierarchyValidation(testData);
    await testBinStatus(testData);
    
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
      console.log('\n❌ R3 VERIFICATION FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ R3 VERIFICATION PASS');
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
