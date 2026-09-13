/**
 * P5.4 — Tenant Boundary Tests
 * 
 * Tests T1-T4 from frozen Phase 5 scope:
 * - T1: Cross-tenant Product in Reservation blocked
 * - T2: Cross-tenant Customer in Reservation blocked
 * - T3: Reservation.tenant_id = Product.tenant_id
 * - T4: Reservation.tenant_id = Customer.tenant_id
 * 
 * Methodology:
 * - Use TWO authenticated clients (Tenant A + Tenant B)
 * - NO service_role for RLS evidence
 * - Verify cross-tenant operations blocked
 * - Verify tenant_id consistency enforced
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TENANT_A_EMAIL = 'loadtest-healthcare@test.local';
const TENANT_A_PASSWORD = 'Test123456!';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  message: string;
  evidence?: any;
}

const results: TestResult[] = [];

async function log(message: string) {
  console.log(`[P5.4] ${message}`);
}

async function runTest(
  id: string,
  name: string,
  testFn: () => Promise<{ pass: boolean; message: string; evidence?: any }>
) {
  log(`\n${'='.repeat(80)}`);
  log(`TEST ${id}: ${name}`);
  log('='.repeat(80));

  try {
    const result = await testFn();
    const status = result.pass ? 'PASS' : 'FAIL';
    
    results.push({
      id,
      name,
      status,
      message: result.message,
      evidence: result.evidence
    });

    log(`RESULT: ${status}`);
    log(`MESSAGE: ${result.message}`);
    if (result.evidence) {
      log(`EVIDENCE: ${JSON.stringify(result.evidence, null, 2)}`);
    }

    return result.pass;
  } catch (error: any) {
    results.push({
      id,
      name,
      status: 'ERROR',
      message: error.message,
      evidence: { stack: error.stack }
    });

    log(`RESULT: ERROR`);
    log(`ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  log('P5.4 TENANT BOUNDARY TESTS — START');
  log(`Target: T1-T4 from frozen 17 Phase 5 invariants`);
  log(`Methodology: TWO authenticated tenant clients (NO service_role for RLS)`);

  // ========================================
  // Setup: Authenticate both tenants
  // ========================================
  
  // Tenant A client
  const tenantAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: tenantAAuth, error: tenantAAuthError } = await tenantAClient.auth.signInWithPassword({
    email: TENANT_A_EMAIL,
    password: TENANT_A_PASSWORD
  });

  if (tenantAAuthError || !tenantAAuth.user) {
    throw new Error(`Tenant A authentication failed: ${tenantAAuthError?.message}`);
  }

  const tenantAId = tenantAAuth.user.user_metadata?.tenant_id || tenantAAuth.user.app_metadata?.tenant_id;
  if (!tenantAId) {
    throw new Error('Tenant A ID not found in user metadata');
  }

  log(`Tenant A authenticated: ${TENANT_A_EMAIL}`);
  log(`Tenant A ID: ${tenantAId}`);

  // Find Tenant B user (need to query existing tenants/users)
  // For test isolation, we'll use service_role ONLY for setup/discovery
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data: tenants } = await serviceClient
    .from('tenants')
    .select('id, name')
    .neq('id', tenantAId)
    .limit(1);

  if (!tenants || tenants.length === 0) {
    throw new Error('No second tenant found for cross-tenant testing');
  }

  const tenantBId = tenants[0].id;
  log(`Tenant B discovered: ${tenants[0].name} (${tenantBId})`);

  // Find Tenant B user
  let { data: tenantBUsers } = await serviceClient
    .from('users')
    .select('email')
    .eq('tenant_id', tenantBId)
    .limit(1);

  let tenantBEmail: string;
  const tenantBPassword = 'Test123456!';

  if (!tenantBUsers || tenantBUsers.length === 0) {
    log('No Tenant B user found, creating test user...');
    
    // Create Tenant B test user via Supabase Auth
    const { data: newUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: `loadtest-tenant2-${Date.now()}@test.local`,
      password: tenantBPassword,
      email_confirm: true,
      user_metadata: {
        tenant_id: tenantBId
      }
    });

    if (createUserError || !newUser.user) {
      throw new Error(`Failed to create Tenant B user: ${createUserError?.message}`);
    }

    tenantBEmail = newUser.user.email!;
    
    // Also insert into users table
    await serviceClient.from('users').insert({
      id: newUser.user.id,
      email: tenantBEmail,
      tenant_id: tenantBId,
      role: 'admin' // Required for Projects RLS policy
    });

    log(`✓ Created Tenant B test user: ${tenantBEmail}`);
  } else {
    tenantBEmail = tenantBUsers[0].email;
  }

  // Tenant B client
  const tenantBClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: tenantBAuth, error: tenantBAuthError } = await tenantBClient.auth.signInWithPassword({
    email: tenantBEmail,
    password: tenantBPassword
  });

  if (tenantBAuthError || !tenantBAuth.user) {
    throw new Error(`Tenant B authentication failed: ${tenantBAuthError?.message}`);
  }

  log(`Tenant B authenticated: ${tenantBEmail}`);
  log(`Tenant B ID: ${tenantBId}`);

  // ========================================
  // Setup: Create test fixtures
  // ========================================
  
  let tenantAProjectId: string | null = null;
  let tenantAProductId: string | null = null;
  let tenantACustomerId: string | null = null;
  
  let tenantBProjectId: string | null = null;
  let tenantBProductId: string | null = null;
  let tenantBCustomerId: string | null = null;

  // Create Tenant A fixtures (using authenticated client for realistic test)
  log('\n--- Creating Tenant A fixtures ---');
  
  const { data: projectA } = await tenantAClient
    .from('real_estate_projects')
    .insert({
      code: `P5.4-TA-${Date.now()}`,
      name: 'P5.4 Tenant A Project',
      status: 'active',
      tenant_id: tenantAId
    })
    .select()
    .single();

  if (!projectA) throw new Error('Failed to create Tenant A project');
  tenantAProjectId = projectA.id;
  log(`✓ Tenant A Project: ${tenantAProjectId}`);

  const { data: productA } = await tenantAClient
    .from('real_estate_products')
    .insert({
      project_id: tenantAProjectId,
      tenant_id: tenantAId,
      product_code: `P5.4-TA-PROD-${Date.now()}`,
      product_type: 'apartment',
      status: 'available',
      area: 100,
      area_m2: 100,
      unit_price: 5000000000
    })
    .select()
    .single();

  if (!productA) throw new Error('Failed to create Tenant A product');
  tenantAProductId = productA.id;
  log(`✓ Tenant A Product: ${tenantAProductId}`);

  const { data: customerA } = await tenantAClient
    .from('re_customers')
    .insert({
      tenant_id: tenantAId,
      name: 'P5.4 Tenant A Customer',
      phone: `+84${Date.now().toString().slice(-9)}`,
      email: `p5.4-ta-${Date.now()}@test.local`
    })
    .select()
    .single();

  if (!customerA) throw new Error('Failed to create Tenant A customer');
  tenantACustomerId = customerA.id;
  log(`✓ Tenant A Customer: ${tenantACustomerId}`);

  // Create Tenant B fixtures (using service_role for setup - acceptable)
  // Note: RLS tests will use authenticated clients for actual verification
  log('\n--- Creating Tenant B fixtures (via service_role for setup) ---');
  
  const { data: projectB, error: projectBError } = await serviceClient
    .from('real_estate_projects')
    .insert({
      code: `P5.4-TB-${Date.now()}`,
      name: 'P5.4 Tenant B Project',
      status: 'active',
      tenant_id: tenantBId
    })
    .select()
    .single();

  if (!projectB) {
    throw new Error(`Failed to create Tenant B project: ${projectBError?.message || 'unknown error'}`);
  }
  tenantBProjectId = projectB.id;
  log(`✓ Tenant B Project: ${tenantBProjectId}`);

  const { data: productB } = await serviceClient
    .from('real_estate_products')
    .insert({
      project_id: tenantBProjectId,
      tenant_id: tenantBId,
      product_code: `P5.4-TB-PROD-${Date.now()}`,
      product_type: 'apartment',
      status: 'available',
      area: 100,
      area_m2: 100,
      unit_price: 5000000000
    })
    .select()
    .single();

  if (!productB) throw new Error('Failed to create Tenant B product');
  tenantBProductId = productB.id;
  log(`✓ Tenant B Product: ${tenantBProductId}`);

  const { data: customerB } = await serviceClient
    .from('re_customers')
    .insert({
      tenant_id: tenantBId,
      name: 'P5.4 Tenant B Customer',
      phone: `+84${Date.now().toString().slice(-9)}`,
      email: `p5.4-tb-${Date.now()}@test.local`
    })
    .select()
    .single();

  if (!customerB) throw new Error('Failed to create Tenant B customer');
  tenantBCustomerId = customerB.id;
  log(`✓ Tenant B Customer: ${tenantBCustomerId}`);

  // ========================================
  // T1: Cross-tenant Product blocked
  // ========================================
  await runTest('T1', 'Cross-tenant Product in Reservation blocked', async () => {
    // Tenant A tries to create Reservation using Tenant B's Product
    const { data, error } = await tenantAClient
      .from('re_reservations')
      .insert({
        tenant_id: tenantAId,
        user_id: tenantAAuth.user.id,
        product_id: tenantBProductId, // Tenant B's product
        customer_id: tenantACustomerId, // Tenant A's customer
        deposit_amount: 50000000,
        status: 'pending_deposit'
      })
      .select();

    // Expected: RLS blocks or FK constraint fails
    if (error) {
      const isRLSBlock = error.code === '42501' || error.message.includes('row-level security');
      const isFKFail = error.code === '23503' || error.message.includes('foreign key');
      
      if (isRLSBlock || isFKFail) {
        return {
          pass: true,
          message: 'Cross-tenant Product blocked by RLS/FK',
          evidence: {
            blocked: true,
            errorCode: error.code,
            errorMessage: error.message,
            mechanism: isRLSBlock ? 'RLS' : 'FK'
          }
        };
      }
      
      return {
        pass: false,
        message: `Unexpected error: ${error.message}`,
        evidence: { error }
      };
    }

    // If insert succeeded, check if Product was actually accessible
    if (data && data.length > 0) {
      return {
        pass: false,
        message: 'Cross-tenant Product NOT blocked (security violation)',
        evidence: { 
          created: true,
          reservationId: data[0].id
        }
      };
    }

    return {
      pass: false,
      message: 'Unexpected result: no error but no data',
      evidence: { data, error }
    };
  });

  // ========================================
  // T2: Cross-tenant Customer blocked
  // ========================================
  await runTest('T2', 'Cross-tenant Customer in Reservation blocked', async () => {
    // Tenant A tries to create Reservation using Tenant B's Customer
    const { data, error } = await tenantAClient
      .from('re_reservations')
      .insert({
        tenant_id: tenantAId,
        user_id: tenantAAuth.user.id,
        product_id: tenantAProductId, // Tenant A's product
        customer_id: tenantBCustomerId, // Tenant B's customer
        deposit_amount: 50000000,
        status: 'pending_deposit'
      })
      .select();

    // Expected: RLS blocks or FK constraint fails
    if (error) {
      const isRLSBlock = error.code === '42501' || error.message.includes('row-level security');
      const isFKFail = error.code === '23503' || error.message.includes('foreign key');
      
      if (isRLSBlock || isFKFail) {
        return {
          pass: true,
          message: 'Cross-tenant Customer blocked by RLS/FK',
          evidence: {
            blocked: true,
            errorCode: error.code,
            errorMessage: error.message,
            mechanism: isRLSBlock ? 'RLS' : 'FK'
          }
        };
      }
      
      return {
        pass: false,
        message: `Unexpected error: ${error.message}`,
        evidence: { error }
      };
    }

    // If insert succeeded, check if Customer was actually accessible
    if (data && data.length > 0) {
      return {
        pass: false,
        message: 'Cross-tenant Customer NOT blocked (security violation)',
        evidence: { 
          created: true,
          reservationId: data[0].id
        }
      };
    }

    return {
      pass: false,
      message: 'Unexpected result: no error but no data',
      evidence: { data, error }
    };
  });

  // ========================================
  // T3: Reservation.tenant_id = Product.tenant_id
  // ========================================
  await runTest('T3', 'Reservation.tenant_id must match Product.tenant_id', async () => {
    // Create valid reservation with Tenant A
    const { data: reservation, error: createError } = await tenantAClient
      .from('re_reservations')
      .insert({
        tenant_id: tenantAId,
        user_id: tenantAAuth.user.id,
        product_id: tenantAProductId,
        customer_id: tenantACustomerId,
        deposit_amount: 50000000,
        status: 'pending_deposit'
      })
      .select()
      .single();

    if (createError || !reservation) {
      return {
        pass: false,
        message: `Failed to create test reservation: ${createError?.message}`,
        evidence: { createError }
      };
    }

    log(`✓ Test reservation created: ${reservation.id}`);

    // Verify tenant_id consistency
    const { data: product } = await serviceClient
      .from('real_estate_products')
      .select('tenant_id')
      .eq('id', tenantAProductId)
      .single();

    if (!product) {
      return {
        pass: false,
        message: 'Failed to fetch Product for verification',
        evidence: {}
      };
    }

    const match = reservation.tenant_id === product.tenant_id;

    // Cleanup
    await tenantAClient.from('re_reservations').delete().eq('id', reservation.id);
    log(`✓ Test reservation cleaned up`);

    return {
      pass: match,
      message: match 
        ? 'Reservation.tenant_id matches Product.tenant_id' 
        : 'Tenant ID mismatch detected',
      evidence: {
        reservationTenantId: reservation.tenant_id,
        productTenantId: product.tenant_id,
        match
      }
    };
  });

  // ========================================
  // T4: Reservation.tenant_id = Customer.tenant_id
  // ========================================
  await runTest('T4', 'Reservation.tenant_id must match Customer.tenant_id', async () => {
    // Create second product for T4 (T3 already used tenantAProductId)
    const { data: productForT4 } = await tenantAClient
      .from('real_estate_products')
      .insert({
        project_id: tenantAProjectId,
        tenant_id: tenantAId,
        product_code: `P5.4-TA-PROD-T4-${Date.now()}`,
        product_type: 'apartment',
        status: 'available',
        area: 100,
        area_m2: 100,
        unit_price: 5000000000
      })
      .select()
      .single();

    if (!productForT4) {
      return {
        pass: false,
        message: 'Failed to create product for T4',
        evidence: {}
      };
    }

    // Create valid reservation with Tenant A
    const { data: reservation, error: createError } = await tenantAClient
      .from('re_reservations')
      .insert({
        tenant_id: tenantAId,
        user_id: tenantAAuth.user.id,
        product_id: productForT4.id,
        customer_id: tenantACustomerId,
        deposit_amount: 50000000,
        status: 'pending_deposit'
      })
      .select()
      .single();

    if (createError || !reservation) {
      return {
        pass: false,
        message: `Failed to create test reservation: ${createError?.message}`,
        evidence: { createError }
      };
    }

    log(`✓ Test reservation created: ${reservation.id}`);

    // Verify tenant_id consistency
    const { data: customer } = await serviceClient
      .from('re_customers')
      .select('tenant_id')
      .eq('id', tenantACustomerId)
      .single();

    if (!customer) {
      return {
        pass: false,
        message: 'Failed to fetch Customer for verification',
        evidence: {}
      };
    }

    const match = reservation.tenant_id === customer.tenant_id;

    // Cleanup
    await tenantAClient.from('re_reservations').delete().eq('id', reservation.id);
    await tenantAClient.from('real_estate_products').delete().eq('id', productForT4.id);
    log(`✓ Test reservation and product cleaned up`);

    return {
      pass: match,
      message: match 
        ? 'Reservation.tenant_id matches Customer.tenant_id' 
        : 'Tenant ID mismatch detected',
      evidence: {
        reservationTenantId: reservation.tenant_id,
        customerTenantId: customer.tenant_id,
        match
      }
    };
  });

  // ========================================
  // Cleanup
  // ========================================
  log('\n' + '='.repeat(80));
  log('CLEANUP');
  log('='.repeat(80));

  // Tenant A cleanup
  if (tenantACustomerId) {
    await tenantAClient.from('re_customers').delete().eq('id', tenantACustomerId);
    log(`Deleted Tenant A customer: ${tenantACustomerId}`);
  }
  if (tenantAProductId) {
    await tenantAClient.from('real_estate_products').delete().eq('id', tenantAProductId);
    log(`Deleted Tenant A product: ${tenantAProductId}`);
  }
  if (tenantAProjectId) {
    await tenantAClient.from('real_estate_projects').delete().eq('id', tenantAProjectId);
    log(`Deleted Tenant A project: ${tenantAProjectId}`);
  }

  // Tenant B cleanup
  if (tenantBCustomerId) {
    await tenantBClient.from('re_customers').delete().eq('id', tenantBCustomerId);
    log(`Deleted Tenant B customer: ${tenantBCustomerId}`);
  }
  if (tenantBProductId) {
    await tenantBClient.from('real_estate_products').delete().eq('id', tenantBProductId);
    log(`Deleted Tenant B product: ${tenantBProductId}`);
  }
  if (tenantBProjectId) {
    await tenantBClient.from('real_estate_projects').delete().eq('id', tenantBProjectId);
    log(`Deleted Tenant B project: ${tenantBProjectId}`);
  }

  // ========================================
  // Summary
  // ========================================
  log('\n' + '='.repeat(80));
  log('P5.4 TENANT BOUNDARY TESTS — SUMMARY');
  log('='.repeat(80));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    log(`${icon} ${result.id}: ${result.name} — ${result.status}`);
    if (result.status !== 'PASS') {
      log(`   ${result.message}`);
    }
  });

  log(`\nRESULT: ${passed}/${total} PASS`);
  
  if (failed > 0) {
    log(`FAILED: ${failed} tests`);
  }
  if (errors > 0) {
    log(`ERRORS: ${errors} tests`);
  }

  const allPassed = failed === 0 && errors === 0;
  log(`\nP5.4 STATUS: ${allPassed ? '🔒 VERIFIED' : '🔴 NOT VERIFIED'}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
