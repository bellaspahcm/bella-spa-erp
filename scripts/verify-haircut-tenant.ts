/**
 * P5.6 Haircut Pilot - Runtime Chain Verification
 * 
 * Verifies end-to-end Product Identity resolution after mutation
 * 
 * Prerequisites:
 * 1. P5.2B: product_key column exists on E2E
 * 2. P5.6 SQL: Haircut tenant assigned product_key='bella_haircut'
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { productResolver } from '../src/platform/registry/product-resolver';
import { productRegistry } from '../src/platform/registry/product-registry';

// Load environment
config({ path: resolve(process.cwd(), '.env.local') });

const HAIRCUT_TENANT_ID = '743d7f1e-403f-4817-aaf2-3b5acf540154';
const HAIRCUT_TENANT_NAME = 'Haircut Shop';

async function verifyRuntimeChain() {
  console.log('🔍 P5.6 Haircut Pilot - Runtime Chain Verification\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Step 1: Verify database state
  console.log('📋 Step 1: Verify Database State\n');
  console.log(`Target Tenant: ${HAIRCUT_TENANT_ID}\n`);

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, product_key, enabled_modules')
    .eq('id', HAIRCUT_TENANT_ID)
    .single();

  if (error) {
    console.error('❌ Error fetching tenant:', error);
    process.exit(1);
  }

  if (!tenant) {
    console.error('❌ Tenant not found');
    process.exit(1);
  }

  console.log('Database State:');
  console.log(`  ID: ${tenant.id}`);
  console.log(`  Name: ${tenant.name}`);
  console.log(`  product_key: ${tenant.product_key ?? 'NULL'}`);
  console.log(`  enabled_modules: ${JSON.stringify(tenant.enabled_modules)}`);
  console.log();

  // Verification
  let allChecksPassed = true;

  if (tenant.name !== HAIRCUT_TENANT_NAME) {
    console.log(`❌ Name mismatch (expected "${HAIRCUT_TENANT_NAME}", got "${tenant.name}")`);
    allChecksPassed = false;
  } else {
    console.log(`✅ Name matches: ${HAIRCUT_TENANT_NAME}`);
  }

  if (tenant.product_key !== 'bella_haircut') {
    console.log(`❌ product_key mismatch (expected "bella_haircut", got "${tenant.product_key}")`);
    allChecksPassed = false;
  } else {
    console.log('✅ product_key = bella_haircut');
  }

  if (!allChecksPassed) {
    console.log('\n❌ Database state verification FAILED');
    console.log('   Run manual SQL scripts first:');
    console.log('   1. scripts/manual-add-product-key.sql');
    console.log('   2. scripts/manual-haircut-pilot.sql');
    process.exit(1);
  }

  console.log();

  // Step 2: Verify ProductRegistry
  console.log('📋 Step 2: Verify ProductRegistry\n');

  const haircutProduct = productRegistry.get('bella_haircut');
  if (!haircutProduct) {
    console.error('❌ bella_haircut not found in ProductRegistry');
    process.exit(1);
  }

  console.log('ProductRegistry:');
  console.log(`  productKey: ${haircutProduct.productKey}`);
  console.log(`  displayName: ${haircutProduct.displayName}`);
  console.log(`  requiredModules: ${JSON.stringify(haircutProduct.requiredModules)}`);
  console.log(`  serviceProfile: ${haircutProduct.serviceProfile}`);
  console.log(`  defaultRoute: ${haircutProduct.defaultRoute}`);
  console.log(`  navigationProfile: ${haircutProduct.navigationProfile}`);
  console.log();

  if (haircutProduct.displayName === 'Bella Haircut Shop') {
    console.log('✅ ProductRegistry contains Bella Haircut Shop');
  } else {
    console.log(`❌ displayName mismatch: ${haircutProduct.displayName}`);
    process.exit(1);
  }

  console.log();

  // Step 3: Verify ProductResolver
  console.log('📋 Step 3: Verify ProductResolver\n');

  const resolved = productResolver.tryResolve({
    id: tenant.id,
    product_key: tenant.product_key
  });

  if (!resolved) {
    console.error('❌ ProductResolver.tryResolve() returned undefined');
    console.error('   Expected: ResolvedProduct');
    process.exit(1);
  }

  console.log('ProductResolver Result:');
  console.log(`  tenant.id: ${resolved.tenant.id}`);
  console.log(`  tenant.product_key: ${resolved.tenant.product_key}`);
  console.log(`  product.productKey: ${resolved.product.productKey}`);
  console.log(`  product.displayName: ${resolved.product.displayName}`);
  console.log();

  if (resolved.product.productKey === 'bella_haircut') {
    console.log('✅ ProductResolver resolved bella_haircut');
  } else {
    console.log(`❌ productKey mismatch: ${resolved.product.productKey}`);
    process.exit(1);
  }

  if (resolved.product.displayName === 'Bella Haircut Shop') {
    console.log('✅ Resolved displayName: Bella Haircut Shop');
  } else {
    console.log(`❌ displayName mismatch: ${resolved.product.displayName}`);
    process.exit(1);
  }

  console.log();

  // Step 4: Verify End-to-End Chain
  console.log('📋 Step 4: End-to-End Chain Summary\n');

  console.log('✅ Runtime Chain VERIFIED:');
  console.log();
  console.log('   Database (E2E)');
  console.log('   ├─ product_key: bella_haircut ✓');
  console.log(`   └─ name: ${HAIRCUT_TENANT_NAME} ✓`);
  console.log();
  console.log('   ProductRegistry');
  console.log('   ├─ bella_haircut registered ✓');
  console.log('   └─ displayName: Bella Haircut Shop ✓');
  console.log();
  console.log('   ProductResolver');
  console.log('   ├─ tryResolve() → ResolvedProduct ✓');
  console.log('   ├─ product.productKey: bella_haircut ✓');
  console.log('   └─ product.displayName: Bella Haircut Shop ✓');
  console.log();
  console.log('🎯 P5.6 Haircut Pilot: Runtime Chain COMPLETE');
  console.log();
  console.log('Next Steps:');
  console.log('1. Verify UserProvider integration (login as Haircut Shop tenant)');
  console.log('2. UI integration: Update Sidebar/Dashboard to consume product context');
  console.log('3. E2E smoke test: Navigation shows Haircut branding');
}

verifyRuntimeChain().catch(console.error);
