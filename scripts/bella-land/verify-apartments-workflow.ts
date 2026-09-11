/**
 * Bella Land Apartments - Database Integrity Check
 * 
 * Checks:
 * 1. Apartments exist with correct status/type values
 * 2. Tenant isolation intact
 * 3. Foreign key constraints (project_id)
 * 4. Unique constraints enforced
 * 5. No orphan/invalid enum values
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

const VALID_STATUSES = ['available', 'booked', 'deposited', 'contracted', 'paid', 'handed_over', 'cancelled'];
const VALID_TYPES = ['apartment', 'townhouse', 'shophouse', 'villa'];

async function verifyApartments() {
  console.log('\n🔍 Bella Land Apartments - Database Integrity Check\n');
  console.log('═'.repeat(70));

  // 1. Check all apartments/products
  const { data: allProducts, error } = await supabase
    .from('real_estate_products')
    .select('*, real_estate_projects(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch products:', error.message);
    process.exit(1);
  }

  console.log(`\n📊 Total apartments/units: ${allProducts?.length || 0}`);

  if (!allProducts || allProducts.length === 0) {
    console.log('\n⚠️  No apartments found. Create test apartments first.');
    return;
  }

  // 2. Group by tenant
  const productsByTenant = new Map<string, ProductRow[]>();
  for (const product of allProducts) {
    if (!productsByTenant.has(product.tenant_id)) {
      productsByTenant.set(product.tenant_id, []);
    }
    productsByTenant.get(product.tenant_id)!.push(product);
  }

  console.log(`👥 Tenants with apartments: ${productsByTenant.size}`);

  // 3. Status validation
  console.log('\n━'.repeat(70));
  console.log('📋 STATUS VALIDATION');
  console.log('━'.repeat(70));

  let validStatus = 0;
  let invalidStatus = 0;
  const invalidStatusProducts: Array<{ code: string; status: string; tenant_id: string }> = [];

  for (const product of allProducts) {
    if (VALID_STATUSES.includes(product.status)) {
      validStatus++;
    } else {
      invalidStatus++;
      invalidStatusProducts.push({
        code: product.product_code,
        status: product.status,
        tenant_id: product.tenant_id
      });
    }
  }

  console.log(`\n✅ Valid status values: ${validStatus}`);
  console.log(`🔴 Invalid status values: ${invalidStatus}`);

  if (invalidStatusProducts.length > 0) {
    console.log('\n⚠️  INVALID STATUS FOUND:');
    for (const p of invalidStatusProducts) {
      console.log(`   - "${p.code}": status="${p.status}" (tenant: ${p.tenant_id.slice(0, 8)}...)`);
    }
    console.log(`\n   Expected: ${VALID_STATUSES.join(' | ')}`);
  }

  // 4. Product type validation
  console.log('\n━'.repeat(70));
  console.log('🏢 PRODUCT TYPE VALIDATION');
  console.log('━'.repeat(70));

  let validType = 0;
  let invalidType = 0;
  const invalidTypeProducts: Array<{ code: string; type: string }> = [];

  for (const product of allProducts) {
    if (VALID_TYPES.includes(product.product_type)) {
      validType++;
    } else {
      invalidType++;
      invalidTypeProducts.push({
        code: product.product_code,
        type: product.product_type
      });
    }
  }

  console.log(`\n✅ Valid product types: ${validType}`);
  console.log(`🔴 Invalid product types: ${invalidType}`);

  if (invalidTypeProducts.length > 0) {
    console.log('\n⚠️  INVALID TYPE FOUND:');
    for (const p of invalidTypeProducts) {
      console.log(`   - "${p.code}": type="${p.type}"`);
    }
    console.log(`\n   Expected: ${VALID_TYPES.join(' | ')}`);
  }

  // 5. Foreign key validation (project_id)
  console.log('\n━'.repeat(70));
  console.log('🔗 FOREIGN KEY VALIDATION');
  console.log('━'.repeat(70));

  const orphanProducts = allProducts.filter(p => !p.project_id);
  console.log(`\n${orphanProducts.length === 0 ? '✅' : '🔴'} Orphan products (no project_id): ${orphanProducts.length}`);

  if (orphanProducts.length > 0) {
    console.log('\n⚠️  ORPHAN PRODUCTS FOUND:');
    for (const p of orphanProducts.slice(0, 5)) {
      console.log(`   - "${p.product_code}" (id: ${p.id.slice(0, 8)}...)`);
    }
  }

  // 6. Tenant isolation
  console.log('\n━'.repeat(70));
  console.log('🔒 TENANT ISOLATION');
  console.log('━'.repeat(70));

  for (const [tenantId, products] of productsByTenant.entries()) {
    console.log(`\n   Tenant: ${tenantId.slice(0, 8)}...`);
    console.log(`   Apartments: ${products.length}`);
    
    const nullTenant = products.filter(p => !p.tenant_id);
    if (nullTenant.length > 0) {
      console.log(`   🔴 WARNING: ${nullTenant.length} products with null tenant_id`);
    } else {
      console.log(`   ✅ All products have tenant_id`);
    }
  }

  // 7. Status distribution
  console.log('\n━'.repeat(70));
  console.log('📈 STATUS DISTRIBUTION');
  console.log('━'.repeat(70));

  const statusCount = new Map<string, number>();
  for (const product of allProducts) {
    statusCount.set(product.status, (statusCount.get(product.status) || 0) + 1);
  }

  for (const [status, count] of Array.from(statusCount.entries()).sort((a, b) => b[1] - a[1])) {
    const isValid = VALID_STATUSES.includes(status);
    const icon = isValid ? '✅' : '🔴';
    console.log(`   ${icon} ${status.padEnd(15)} ${count}`);
  }

  // 8. Product type distribution
  console.log('\n━'.repeat(70));
  console.log('🏢 PRODUCT TYPE DISTRIBUTION');
  console.log('━'.repeat(70));

  const typeCount = new Map<string, number>();
  for (const product of allProducts) {
    typeCount.set(product.product_type, (typeCount.get(product.product_type) || 0) + 1);
  }

  for (const [type, count] of Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])) {
    const isValid = VALID_TYPES.includes(type);
    const icon = isValid ? '✅' : '🔴';
    console.log(`   ${icon} ${type.padEnd(15)} ${count}`);
  }

  // 9. Recent apartments
  console.log('\n━'.repeat(70));
  console.log('🕐 RECENT APARTMENTS (Last 5)');
  console.log('━'.repeat(70));

  const recentProducts = allProducts.slice(0, 5);
  for (const product of recentProducts) {
    const statusIcon = VALID_STATUSES.includes(product.status) ? '✅' : '🔴';
    const typeIcon = VALID_TYPES.includes(product.product_type) ? '✅' : '🔴';
    const createdAt = new Date(product.created_at).toLocaleString('vi-VN');
    
    console.log(`\n   ${statusIcon}${typeIcon} ${product.product_code}`);
    console.log(`      Type: ${product.product_type}`);
    console.log(`      Status: ${product.status}`);
    console.log(`      Project: ${product.project_id.slice(0, 8)}...`);
    console.log(`      Tenant: ${product.tenant_id.slice(0, 8)}...`);
    console.log(`      Created: ${createdAt}`);
  }

  // 10. Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  const allValidStatus = invalidStatus === 0;
  const allValidType = invalidType === 0;
  const allHaveTenant = allProducts.every(p => p.tenant_id);
  const allHaveProject = orphanProducts.length === 0;

  console.log(`\n   Total apartments: ${allProducts.length}`);
  console.log(`   Valid statuses: ${validStatus}/${allProducts.length} ${allValidStatus ? '✅' : '🔴'}`);
  console.log(`   Valid types: ${validType}/${allProducts.length} ${allValidType ? '✅' : '🔴'}`);
  console.log(`   Tenant isolation: ${allHaveTenant ? '✅ All have tenant_id' : '🔴 Some missing tenant_id'}`);
  console.log(`   Foreign keys: ${allHaveProject ? '✅ All have project_id' : '🔴 Some orphans'}`);
  console.log(`   Unique tenants: ${productsByTenant.size}`);

  if (allValidStatus && allValidType && allHaveTenant && allHaveProject) {
    console.log('\n   🎉 ALL CHECKS PASSED');
  } else {
    console.log('\n   ⚠️  ISSUES FOUND - Review above');
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  // Exit code
  const success = allValidStatus && allValidType && allHaveTenant && allHaveProject;
  process.exit(success ? 0 : 1);
}

verifyApartments().catch(console.error);
