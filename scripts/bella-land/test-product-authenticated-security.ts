#!/usr/bin/env tsx

/**
 * P2.2: Products Authenticated Security — A1-A10
 * 
 * METHODOLOGY: ALL tests use authenticated clients (NOT service_role)
 * 
 * Tests (10 total):
 * A1. Own-tenant create (Tenant A creates product under Tenant A project)
 * A2. Own-tenant read (Tenant A sees own products)
 * A3. Cross-tenant read blocked (Tenant A cannot see Tenant B product)
 * A4. Cross-tenant update blocked (Tenant A cannot update Tenant B product)
 * A5. Cross-tenant delete blocked (Tenant A cannot delete Tenant B product)
 * A6. Tenant forgery blocked (WITH CHECK on INSERT)
 * A7. Tenant escape blocked (WITH CHECK on UPDATE)
 * A8. No query leakage (Tenant A queries never return Tenant B data)
 * A9. Cross-entity forgery blocked (Layer 5: Tenant A product → Tenant B project)
 * A10. Cross-entity escape blocked (Layer 5: Move product to other tenant's project)
 * 
 * Security Model:
 * - Layers 1-4 (Standard RLS): A1-A8
 * - Layer 5 (Cross-Entity Integrity): A9-A10
 * - ALL tests use AUTHENTICATED user contexts
 * - service_role ONLY for fixture setup/cleanup and independent verification
 * 
 * Pass criteria: 10/10 PASS → P2.2 VERIFIED
 * Any fail: RCA on correct methodology → Real security issue
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for setup/cleanup ONLY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test fixtures (loadtest users with known passwords)
const TENANT_A = {
  id: '1a6643da-3806-4793-a301-7a6d60b0d888',
  name: 'K6 Load Test — Real Estate',
  email: 'loadtest-realestate@test.local',
  password: 'Test123456!',
  project_id: '47685225-5b46-4cbc-a191-2426e6873cb7'
};

const TENANT_B = {
  id: '60135a61-d8a0-47f2-a0d9-835ff0bd437e',
  name: 'K6 Load Test — Healthcare OS',
  email: 'loadtest-healthcare@test.local',
  password: 'Test123456!',
  project_id: 'f44d3f79-c615-48f9-892d-9d61caea13c6'
};

interface TestResult {
  test: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  notes?: string;
}

async function main() {
  console.log('\n🧪 P2.2: Products Authenticated Security — A1-A10');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎯 METHODOLOGY: ALL tests use authenticated clients (NOT service_role)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: TestResult[] = [];
  let tenantAProductId: string | null = null;
  let tenantBProductId: string | null = null;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Create authenticated clients
    // ─────────────────────────────────────────────────────────────────────────
    console.log('SETUP: Authenticate Tenant A and Tenant B users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Create authenticated client for Tenant A
    const clientA = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authA, error: authErrorA } = await clientA.auth.signInWithPassword({
      email: TENANT_A.email,
      password: TENANT_A.password,
    });

    if (authErrorA || !authA.user) {
      console.error('❌ Failed to authenticate Tenant A:', authErrorA);
      process.exit(1);
    }

    console.log(`✅ Tenant A authenticated: ${authA.user.email}`);
    console.log(`   User ID: ${authA.user.id}`);

    // Create authenticated client for Tenant B
    const clientB = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authB, error: authErrorB } = await clientB.auth.signInWithPassword({
      email: TENANT_B.email,
      password: TENANT_B.password,
    });

    if (authErrorB || !authB.user) {
      console.error('❌ Failed to authenticate Tenant B:', authErrorB);
      process.exit(1);
    }

    console.log(`✅ Tenant B authenticated: ${authB.user.email}`);
    console.log(`   User ID: ${authB.user.id}`);

    // Verify tenant membership
    const { data: userAData } = await clientA.from('users').select('tenant_id').eq('id', authA.user.id).single();
    const { data: userBData } = await clientB.from('users').select('tenant_id').eq('id', authB.user.id).single();

    console.log(`\n✅ Verified: User A tenant_id = ${userAData?.tenant_id}`);
    console.log(`✅ Verified: User B tenant_id = ${userBData?.tenant_id}`);

    if (userAData?.tenant_id !== TENANT_A.id || userBData?.tenant_id !== TENANT_B.id) {
      console.error('❌ Tenant membership mismatch!');
      process.exit(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A1: Own-tenant create
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A1: Own-Tenant Create (Tenant A creates product)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const productCode = `A1-AUTH-${Date.now()}`;

    // Use authenticated clientA (NOT service_role)
    const { data: productA, error: createError } = await clientA
      .from('real_estate_products')
      .insert({
        tenant_id: TENANT_A.id,
        project_id: TENANT_A.project_id,
        product_code: productCode,
        product_type: 'apartment',
        area: 85.5,
        unit_price: 2500000000,
        status: 'available'
      })
      .select()
      .single();

    if (createError || !productA) {
      results.push({
        test: 'A1',
        passed: false,
        actual: `Error: ${createError?.message}`,
        expected: 'Product created successfully',
        notes: createError?.message
      });
      console.log('❌ FAIL');
      console.log(`   Error: ${createError?.message}`);
    } else {
      tenantAProductId = productA.id;
      const a1Pass = productA.tenant_id === TENANT_A.id;
      results.push({
        test: 'A1',
        passed: a1Pass,
        actual: a1Pass ? 'Created' : 'Wrong tenant_id',
        expected: 'Product created with Tenant A tenant_id',
        notes: `Product ID: ${productA.id.substring(0, 8)}...`
      });
      console.log(a1Pass ? '✅ PASS' : '❌ FAIL');
      console.log(`   Product created: ${!!productA}`);
      console.log(`   tenant_id matches: ${a1Pass}`);
    }

    if (!tenantAProductId) {
      console.error('\n❌ Cannot continue without Product A');
      process.exit(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A2: Own-tenant read
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A2: Own-Tenant Read (Tenant A sees own product)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use authenticated clientA
    const { data: productsA, error: readError } = await clientA
      .from('real_estate_products')
      .select('id')
      .eq('tenant_id', TENANT_A.id);

    const a2Pass = !readError && productsA && productsA.some(p => p.id === tenantAProductId);
    results.push({
      test: 'A2',
      passed: a2Pass,
      actual: a2Pass ? 'Product found' : 'Product NOT found',
      expected: 'Own product visible in list',
      notes: `Total products: ${productsA?.length || 0}`
    });

    console.log(a2Pass ? '✅ PASS' : '❌ FAIL');
    console.log(`   Product found in list: ${a2Pass}`);
    console.log(`   Total products for Tenant A: ${productsA?.length || 0}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Create Tenant B product (for cross-tenant tests)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SETUP: Create Tenant B Product (for cross-tenant tests)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use authenticated clientB
    const { data: productB, error: createBError } = await clientB
      .from('real_estate_products')
      .insert({
        tenant_id: TENANT_B.id,
        project_id: TENANT_B.project_id,
        product_code: `B-AUTH-${Date.now()}`,
        product_type: 'apartment',
        area: 90.0,
        unit_price: 3000000000,
        status: 'available'
      })
      .select()
      .single();

    if (createBError || !productB) {
      console.error('❌ Failed to create Tenant B product:', createBError);
      process.exit(1);
    }

    tenantBProductId = productB.id;
    console.log(`✅ Tenant B product created: ${tenantBProductId.substring(0, 8)}...`);

    // ─────────────────────────────────────────────────────────────────────────
    // A3: Cross-tenant read blocked
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A3: Cross-Tenant Read Blocked (Tenant A cannot see Tenant B product)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use authenticated clientA trying to read Tenant B product
    const { data: crossRead, error: crossReadError } = await clientA
      .from('real_estate_products')
      .select('id')
      .eq('id', tenantBProductId)
      .single();

    const a3Pass = !crossRead || crossReadError !== null;
    results.push({
      test: 'A3',
      passed: a3Pass,
      actual: a3Pass ? 'Blocked (not visible)' : 'ALLOWED (visible)',
      expected: 'Cross-tenant product NOT visible',
      notes: `Query result: ${crossRead ? 'FOUND' : 'NOT FOUND'}`
    });

    console.log(a3Pass ? '✅ PASS' : '❌ FAIL');
    console.log(`   Cross-tenant product invisible: ${a3Pass}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A4: Cross-tenant update blocked
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A4: Cross-Tenant Update Blocked');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use authenticated clientA trying to update Tenant B product
    const { data: updateResult, error: updateError } = await clientA
      .from('real_estate_products')
      .update({ area: 100.0 })
      .eq('id', tenantBProductId)
      .select();

    const a4Pass = !updateResult || updateResult.length === 0;
    results.push({
      test: 'A4',
      passed: a4Pass,
      actual: a4Pass ? 'Blocked (0 rows)' : 'ALLOWED',
      expected: 'Cross-tenant update returns 0 rows',
      notes: `Rows affected: ${updateResult?.length || 0}`
    });

    console.log(a4Pass ? '✅ PASS' : '❌ FAIL');
    console.log(`   Update blocked: ${a4Pass}`);
    console.log(`   Rows affected: ${updateResult?.length || 0}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A5: Cross-tenant delete blocked
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A5: Cross-Tenant Delete Blocked');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use authenticated clientA trying to delete Tenant B product
    const { data: deleteResult, error: deleteError } = await clientA
      .from('real_estate_products')
      .delete()
      .eq('id', tenantBProductId)
      .select();

    const a5Pass = !deleteResult || deleteResult.length === 0;
    results.push({
      test: 'A5',
      passed: a5Pass,
      actual: a5Pass ? 'Blocked (0 rows)' : 'ALLOWED',
      expected: 'Cross-tenant delete returns 0 rows',
      notes: `Rows affected: ${deleteResult?.length || 0}`
    });

    console.log(a5Pass ? '✅ PASS' : '❌ FAIL');
    console.log(`   Delete blocked: ${a5Pass}`);
    console.log(`   Rows affected: ${deleteResult?.length || 0}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A6: Tenant forgery blocked (WITH CHECK on INSERT)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A6: Tenant Forgery Blocked (WITH CHECK on INSERT)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let a6Blocked = false;
    let a6Error = '';

    try {
      // Use authenticated clientA attempting to forge Tenant B's tenant_id
      const { data: forgeryAttempt, error: forgeryError } = await clientA
        .from('real_estate_products')
        .insert({
          tenant_id: TENANT_B.id,  // ← Forged tenant_id
          project_id: TENANT_A.project_id,
          product_code: `FORGE-${Date.now()}`,
          product_type: 'apartment',
          area: 85.0,
          unit_price: 2000000000,
          status: 'available'
        })
        .select();

      a6Blocked = !forgeryAttempt || forgeryAttempt.length === 0 || forgeryError !== null;
      if (forgeryError) a6Error = forgeryError.message;
    } catch (error) {
      a6Blocked = true;
      a6Error = error instanceof Error ? error.message : 'Unknown error';
    }

    results.push({
      test: 'A6',
      passed: a6Blocked,
      actual: a6Blocked ? 'Forgery blocked' : 'Forgery ALLOWED',
      expected: 'WITH CHECK prevents tenant_id forgery',
      notes: a6Error || 'RLS WITH CHECK enforcement'
    });

    console.log(a6Blocked ? '✅ PASS' : '❌ FAIL');
    console.log(`   Forgery blocked: ${a6Blocked}`);
    if (a6Error) console.log(`   Error: ${a6Error}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A7: Tenant escape blocked (WITH CHECK on UPDATE)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A7: Tenant Escape Blocked (WITH CHECK on UPDATE)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let a7Blocked = false;
    let a7Error = '';

    try {
      // Use authenticated clientA attempting to change own product's tenant_id
      const { data: escapeAttempt, error: escapeError } = await clientA
        .from('real_estate_products')
        .update({ tenant_id: TENANT_B.id })  // ← Try to escape to Tenant B
        .eq('id', tenantAProductId)
        .select();

      a7Blocked = !escapeAttempt || escapeAttempt.length === 0 || escapeError !== null;
      if (escapeError) a7Error = escapeError.message;
    } catch (error) {
      a7Blocked = true;
      a7Error = error instanceof Error ? error.message : 'Unknown error';
    }

    results.push({
      test: 'A7',
      passed: a7Blocked,
      actual: a7Blocked ? 'Escape blocked' : 'Escape ALLOWED',
      expected: 'WITH CHECK prevents tenant_id modification',
      notes: a7Error || 'RLS WITH CHECK enforcement'
    });

    console.log(a7Blocked ? '✅ PASS' : '❌ FAIL');
    console.log(`   Escape blocked: ${a7Blocked}`);
    if (a7Error) console.log(`   Error: ${a7Error}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A8: No query leakage
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A8: No Query Leakage');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use authenticated clientA querying all products
    const { data: allProducts } = await clientA
      .from('real_estate_products')
      .select('id, tenant_id');

    const hasTenantBData = allProducts?.some(p => p.tenant_id === TENANT_B.id) || false;
    const a8Pass = !hasTenantBData;

    results.push({
      test: 'A8',
      passed: a8Pass,
      actual: a8Pass ? 'No leakage' : 'LEAK DETECTED',
      expected: 'Tenant A queries return only Tenant A data',
      notes: `Total products queried: ${allProducts?.length || 0}, Tenant B data: ${hasTenantBData ? 'FOUND' : 'NONE'}`
    });

    console.log(a8Pass ? '✅ PASS' : '❌ FAIL');
    console.log(`   No Tenant B data in Tenant A queries: ${a8Pass}`);
    console.log(`   Total products queried: ${allProducts?.length || 0}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A9: Cross-entity forgery blocked (Layer 5)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A9: Cross-Entity Forgery Blocked (Layer 5)');
    console.log('Tenant A product → Tenant B project (MUST BLOCK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let a9Blocked = false;
    let a9Error = '';

    try {
      // Use authenticated clientA attempting to create product with Tenant B project
      const { data: crossEntityAttempt, error: crossEntityError } = await clientA
        .from('real_estate_products')
        .insert({
          tenant_id: TENANT_A.id,
          project_id: TENANT_B.project_id,  // ← Cross-tenant project
          product_code: `CROSS-${Date.now()}`,
          product_type: 'apartment',
          area: 85.0,
          unit_price: 2000000000,
          status: 'available'
        })
        .select();

      a9Blocked = !crossEntityAttempt || crossEntityAttempt.length === 0 || crossEntityError !== null;
      if (crossEntityError) a9Error = crossEntityError.message;
    } catch (error) {
      a9Blocked = true;
      a9Error = error instanceof Error ? error.message : 'Unknown error';
    }

    results.push({
      test: 'A9',
      passed: a9Blocked,
      actual: a9Blocked ? 'Cross-entity forgery blocked' : 'Cross-entity forgery ALLOWED',
      expected: 'Product cannot reference cross-tenant project',
      notes: a9Error || 'Layer 5 enforcement (Service + DB)'
    });

    console.log(a9Blocked ? '✅ PASS' : '❌ FAIL');
    console.log(`   Cross-entity forgery blocked: ${a9Blocked}`);
    if (a9Error) console.log(`   Error: ${a9Error}`);

    // ─────────────────────────────────────────────────────────────────────────
    // A10: Cross-entity escape blocked (Layer 5)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('A10: Cross-Entity Escape Blocked (Layer 5)');
    console.log('Move Tenant A product → Tenant B project via UPDATE (MUST BLOCK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let a10Blocked = false;
    let a10Error = '';

    try {
      // Use authenticated clientA attempting to re-parent to Tenant B project
      const { data: reparentAttempt, error: reparentError } = await clientA
        .from('real_estate_products')
        .update({ project_id: TENANT_B.project_id })  // ← Cross-tenant project
        .eq('id', tenantAProductId)
        .select();

      a10Blocked = !reparentAttempt || reparentAttempt.length === 0 || reparentError !== null;
      if (reparentError) a10Error = reparentError.message;
    } catch (error) {
      a10Blocked = true;
      a10Error = error instanceof Error ? error.message : 'Unknown error';
    }

    results.push({
      test: 'A10',
      passed: a10Blocked,
      actual: a10Blocked ? 'Cross-entity escape blocked' : 'Cross-entity escape ALLOWED',
      expected: 'Cannot update to cross-tenant project',
      notes: a10Error || 'Layer 5 enforcement (DB RLS + FK)'
    });

    console.log(a10Blocked ? '✅ PASS' : '❌ FAIL');
    console.log(`   Cross-entity escape blocked: ${a10Blocked}`);
    if (a10Error) console.log(`   Error/Note: ${a10Error || 'Update returned 0 rows'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP (using service_role for admin operations)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLEANUP (using service_role for admin operations)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (tenantAProductId) {
      await supabaseAdmin.from('real_estate_products').delete().eq('id', tenantAProductId);
      console.log('✅ Tenant A test product deleted');
    }

    if (tenantBProductId) {
      await supabaseAdmin.from('real_estate_products').delete().eq('id', tenantBProductId);
      console.log('✅ Tenant B test product deleted');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════════');

    const passCount = results.filter(r => r.passed).length;
    const failCount = results.length - passCount;

    console.log('\nStandard RLS (Layers 1-4):');
    results.filter(r => parseInt(r.test.substring(1)) <= 8).forEach(r => {
      const emoji = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${emoji} ${r.test}: ${r.notes || r.actual}`);
      if (!r.passed) {
        console.log(`   Expected: "${r.expected}"`);
        console.log(`   Actual: "${r.actual}"`);
      }
    });

    console.log('\nLayer 5 (Cross-Entity Integrity):');
    results.filter(r => parseInt(r.test.substring(1)) > 8).forEach(r => {
      const emoji = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${emoji} ${r.test}: ${r.notes || r.actual}`);
      if (!r.passed) {
        console.log(`   Expected: "${r.expected}"`);
        console.log(`   Actual: "${r.actual}"`);
      }
    });

    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log(`Result: ${passCount}/10 tests passed`);
    console.log('──────────────────────────────────────────────────────────────────────');

    if (failCount === 0) {
      console.log('\n✅ P2.2 PASS — 10/10 with authenticated methodology');
      console.log('🎯 AUTHENTICATED SECURITY VERIFIED');
      console.log('▶️  Proceed to P2.3 Browser Runtime');
      process.exit(0);
    } else {
      console.log(`\n❌ P2.2 FAIL — ${failCount} test(s) failed with authenticated methodology`);
      console.log('🔴 Freeze evidence → RCA → Real security issue or defect');
      console.log('⏸️  DO NOT proceed to P2.3 until P2.2 passes 10/10');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during test execution:', error);
    process.exit(1);
  }
}

main();
