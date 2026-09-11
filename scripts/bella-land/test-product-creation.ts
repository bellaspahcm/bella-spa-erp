#!/usr/bin/env tsx

/**
 * P2.1: Products Write-Flow Verification
 * 
 * Tests:
 * T1. Create product (apartment) via production path (action → service → DB)
 * T2. Field semantics (product_code, product_type, status, area, unit_price)
 * T3. Reload/read-back (product appears in list)
 * T4. Service tenant injection (tenant_id matches authenticated user)
 * T5. Parent relationship + Layer 5 (project ownership validation)
 * 
 * Security Boundary:
 * - Test application layer with authenticated context
 * - Layer 5: Verify parent project ownership enforced
 * - P2.2 will test RLS policies with cross-tenant scenarios
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TestResult {
  test: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  notes?: string;
}

async function main() {
  console.log('\n🧪 P2.1: Products Write-Flow Verification');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎯 GOAL: Verify product creation workflow via production path');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: TestResult[] = [];
  let testProductId: string | null = null;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Get test tenant + project
    // ─────────────────────────────────────────────────────────────────────────
    console.log('SETUP: Get Test Tenant + Project');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Get tenant with existing projects
    const { data: existingProjects } = await supabase
      .from('real_estate_projects')
      .select('id, tenant_id, name')
      .limit(1);

    if (!existingProjects || existingProjects.length === 0) {
      console.error('❌ No existing projects found - need tenant + project context');
      process.exit(1);
    }

    const testProject = existingProjects[0];
    const testTenantId = testProject.tenant_id;
    const testProjectId = testProject.id;

    // Get tenant details
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', testTenantId)
      .single();

    if (!tenant) {
      console.error('❌ Test tenant not found');
      process.exit(1);
    }

    console.log(`✅ Test Tenant: ${tenant.name}`);
    console.log(`   ID: ${tenant.id.substring(0, 8)}...`);
    console.log(`✅ Test Project: ${testProject.name}`);
    console.log(`   ID: ${testProject.id.substring(0, 8)}...`);

    // Get another tenant for Layer 5 test
    const { data: otherTenants } = await supabase
      .from('tenants')
      .select('id')
      .neq('id', tenant.id)
      .limit(1);

    const otherTenantId = otherTenants && otherTenants.length > 0 ? otherTenants[0].id : null;

    if (otherTenantId) {
      console.log(`✅ Other Tenant ID (for Layer 5 test): ${otherTenantId.substring(0, 8)}...`);
    } else {
      console.log('⚠️  No other tenant found - T5 Layer 5 test will be limited');
    }

    // Get another tenant's project (for Layer 5 negative test)
    let otherTenantProjectId: string | null = null;
    if (otherTenantId) {
      const { data: otherProjects } = await supabase
        .from('real_estate_projects')
        .select('id')
        .eq('tenant_id', otherTenantId)
        .limit(1);

      if (otherProjects && otherProjects.length > 0) {
        otherTenantProjectId = otherProjects[0].id;
        console.log(`✅ Other Tenant Project ID: ${otherTenantProjectId.substring(0, 8)}...`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // T1: Create Product via Production Path
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('T1: Create Product (Apartment) via Production Path');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const productCode = `TEST-P2.1-${Date.now()}`;
    const productData = {
      product_code: productCode,
      product_type: 'apartment' as const,
      status: 'available' as const,
      area: 85.5,
      unit_price: 2500000000,
      block: 'A',
      floor: '10'
    };

    console.log(`Creating product: ${productCode}`);
    console.log(`Project ID: ${testProjectId.substring(0, 8)}...`);
    console.log(`Tenant ID: ${testTenantId.substring(0, 8)}...`);

    // Use ProductService.createProduct (production path)
    const { ProductService } = await import('../../src/modules/real_estate/services/ProductService');

    const createdProduct = await ProductService.createProduct(
      supabase,
      testTenantId,
      testProjectId,
      productData
    );

    testProductId = createdProduct.id;

    const t1Pass = !!createdProduct && !!createdProduct.id;
    results.push({
      test: 'T1',
      passed: t1Pass,
      actual: createdProduct ? 'Product created' : 'No product',
      expected: 'Product created with ID',
      notes: `Product ID: ${createdProduct?.id?.substring(0, 8)}...`
    });

    console.log(t1Pass ? '✅ PASS' : '❌ FAIL');
    console.log(`   Product ID: ${createdProduct.id.substring(0, 8)}...`);

    // ─────────────────────────────────────────────────────────────────────────
    // T2: Field Semantics
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('T2: Field Semantics (5 key fields)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const fieldsMatch = 
      createdProduct.product_code === productCode &&
      createdProduct.product_type === 'apartment' &&
      createdProduct.status === 'available' &&
      createdProduct.area === 85.5 &&
      createdProduct.unit_price === 2500000000;

    results.push({
      test: 'T2',
      passed: fieldsMatch,
      actual: {
        code: createdProduct.product_code,
        type: createdProduct.product_type,
        status: createdProduct.status,
        area: createdProduct.area,
        price: createdProduct.unit_price
      },
      expected: productData,
      notes: 'product_code, product_type, status, area, unit_price'
    });

    console.log(fieldsMatch ? '✅ PASS' : '❌ FAIL');
    console.log(`   product_code: ${createdProduct.product_code}`);
    console.log(`   product_type: ${createdProduct.product_type}`);
    console.log(`   status: ${createdProduct.status}`);
    console.log(`   area: ${createdProduct.area}`);
    console.log(`   unit_price: ${createdProduct.unit_price}`);

    // ─────────────────────────────────────────────────────────────────────────
    // T3: Reload/Read-back
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('T3: Reload/Read-back');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const reloadedProducts = await ProductService.getProducts(
      supabase,
      testTenantId,
      testProjectId
    );

    const productFound = reloadedProducts.some(p => p.id === testProductId);

    results.push({
      test: 'T3',
      passed: productFound,
      actual: productFound ? 'Product found' : 'Product not found',
      expected: 'Product found in project list',
      notes: `Total products in project: ${reloadedProducts.length}`
    });

    console.log(productFound ? '✅ PASS' : '❌ FAIL');
    console.log(`   Product found in list: ${productFound}`);
    console.log(`   Total products in project: ${reloadedProducts.length}`);

    // ─────────────────────────────────────────────────────────────────────────
    // T4: Service Tenant Injection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('T4: Service Tenant Injection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const tenantMatches = createdProduct.tenant_id === testTenantId;

    results.push({
      test: 'T4',
      passed: tenantMatches,
      actual: createdProduct.tenant_id,
      expected: testTenantId,
      notes: 'tenant_id injected by service, not from client'
    });

    console.log(tenantMatches ? '✅ PASS' : '❌ FAIL');
    console.log(`   Product tenant_id: ${createdProduct.tenant_id.substring(0, 8)}...`);
    console.log(`   Expected tenant_id: ${testTenantId.substring(0, 8)}...`);
    console.log(`   Match: ${tenantMatches}`);

    // ─────────────────────────────────────────────────────────────────────────
    // T5: Parent Relationship + Layer 5
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('T5: Parent Relationship + Layer 5 (Cross-Entity Integrity)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\nT5.1: Valid parent (same tenant)');
    const projectMatches = createdProduct.project_id === testProjectId;
    console.log(projectMatches ? '✅ PASS' : '❌ FAIL');
    console.log(`   Product project_id: ${createdProduct.project_id.substring(0, 8)}...`);
    console.log(`   Expected project_id: ${testProjectId.substring(0, 8)}...`);

    console.log('\nT5.2: Layer 5 — Cross-tenant parent rejection');
    
    if (otherTenantProjectId) {
      let layer5Blocked = false;
      let layer5Error = '';

      try {
        // Attempt to create product under Tenant A, but with Tenant B's project
        await ProductService.createProduct(
          supabase,
          testTenantId, // Tenant A
          otherTenantProjectId, // Tenant B's project
          {
            product_code: `LAYER5-FAIL-${Date.now()}`,
            product_type: 'apartment'
          }
        );
      } catch (error) {
        layer5Blocked = true;
        layer5Error = error instanceof Error ? error.message : 'Unknown error';
      }

      results.push({
        test: 'T5',
        passed: projectMatches && layer5Blocked,
        actual: layer5Blocked ? 'Cross-tenant parent blocked' : 'Cross-tenant parent ALLOWED',
        expected: 'Cross-tenant parent blocked (Layer 5)',
        notes: `Error: ${layer5Error}`
      });

      console.log(layer5Blocked ? '✅ PASS' : '❌ FAIL');
      console.log(`   Cross-tenant parent blocked: ${layer5Blocked}`);
      console.log(`   Error message: ${layer5Error}`);
    } else {
      results.push({
        test: 'T5',
        passed: projectMatches,
        actual: 'Only T5.1 tested (no other tenant project)',
        expected: 'T5.1 + T5.2 both pass',
        notes: 'Limited test - no cross-tenant project available'
      });

      console.log('⚠️  PARTIAL PASS (T5.1 only)');
      console.log('   Layer 5 test limited: No other tenant project available');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLEANUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (testProductId) {
      const { error: deleteError } = await supabase
        .from('real_estate_products')
        .delete()
        .eq('id', testProductId);

      if (deleteError) {
        console.log(`⚠️  Warning: Could not delete test product: ${deleteError.message}`);
      } else {
        console.log('✅ Test product deleted');
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════════\n');

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    results.forEach(r => {
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${r.test}: ${r.notes || ''}`);
      if (!r.passed) {
        console.log(`   Expected: ${JSON.stringify(r.expected)}`);
        console.log(`   Actual: ${JSON.stringify(r.actual)}`);
      }
    });

    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log(`Result: ${passedCount}/${totalCount} tests passed`);
    console.log('──────────────────────────────────────────────────────────────────────\n');

    if (passedCount === totalCount) {
      console.log('🎉 P2.1 PASS — Products write flow verified');
      console.log('▶️  NEXT: P2.2 Tenant Isolation + Layer 5 (10 tests)\n');
      process.exit(0);
    } else {
      console.log('❌ P2.1 FAIL — Freeze evidence → RCA → Remediation → Rerun');
      console.log('⏸️  DO NOT proceed to P2.2 until P2.1 passes\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:');
    console.error(error);
    process.exit(1);
  }
}

main();
