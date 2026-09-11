#!/usr/bin/env tsx
/**
 * C3.2: Customers Authenticated Security — A1-A9
 * 
 * METHODOLOGY: ALL tests use authenticated clients (NOT service_role)
 * 
 * CRITICAL: Test users MUST be regular tenant users (NOT HQ super admin)
 * - `is_hq_super_admin()` bypasses tenant isolation
 * - Using HQ super admin would give FALSE PASS on isolation tests
 * - C3.2 proves tenant isolation, not HQ override
 * 
 * Test Users:
 * - Tenant A: loadtest-realestate@test.local (regular tenant admin)
 * - Tenant B: loadtest-healthcare@test.local (regular tenant admin)
 * 
 * Tests RLS policies on re_customers:
 * A1. Tenant A can SELECT own customer
 * A2. Tenant A cannot SELECT Tenant B customer
 * A3. Tenant A can INSERT own customer
 * A4. Tenant A cannot INSERT with tenant_id = Tenant B (forgery)
 * A5. Tenant A can UPDATE own customer
 * A6. Tenant A cannot UPDATE Tenant B customer
 * A7. Tenant A cannot UPDATE own customer tenant_id → Tenant B (escape)
 * A8. Tenant A can DELETE own test customer
 * A9. Tenant A cannot DELETE Tenant B customer
 * 
 * Security Layers Tested:
 * - Layers 1-4: Standard RLS (tenant isolation)
 * - Canonical Pattern: Matches Projects/Products authorization
 *   - Helper: public.get_auth_tenant_id()
 *   - Override: public.is_hq_super_admin() (NOT tested in C3.2)
 *   - Roles: admin, super_admin, admin_staff (exact match)
 * 
 * Layer 5: NOT APPLICABLE at C3 level (customers is root entity, no parent ownership)
 * 
 * NOTE: Cross-entity invariants (Customer ↔ Reservation ↔ Product)
 * will be verified in Phase 5 Integration, not in C3.2.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface TestResult {
  gate: string;
  passed: boolean;
  details?: string;
}

async function authenticateUser(email: string, password: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error(`Authentication failed for ${email}: ${error?.message}`);
  }

  return client;
}

async function getUserTenantId(client: any, userId: string): Promise<string> {
  const { data, error } = await client
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to get tenant_id: ${error?.message}`);
  }

  return data.tenant_id;
}

const TENANT_A = {
  email: 'loadtest-realestate@test.local',
  password: 'Test123456!',
};

const TENANT_B = {
  email: 'loadtest-healthcare@test.local',
  password: 'Test123456!',
};

async function main() {
  console.log('🧪 C3.2: Customers Authenticated Security — A1-A9');
  console.log('═'.repeat(70));
  console.log('🎯 METHODOLOGY: ALL tests use authenticated clients (NOT service_role)');
  console.log('━'.repeat(70));

  const results: TestResult[] = [];

  // ───────────────────────────────────────────────────────────────────────────
  // SETUP: Authenticate Tenant A and Tenant B users
  // ───────────────────────────────────────────────────────────────────────────
  console.log('SETUP: Authenticate Tenant A and Tenant B users');
  console.log('━'.repeat(70));

  const clientA = await authenticateUser(
    TENANT_A.email,
    TENANT_A.password
  );
  const userA = (await clientA.auth.getUser()).data.user!;
  const tenantA = await getUserTenantId(clientA, userA.id);

  console.log(`✅ Tenant A authenticated: ${TENANT_A.email}`);
  console.log(`   User ID: ${userA.id}`);

  const clientB = await authenticateUser(
    TENANT_B.email,
    TENANT_B.password
  );
  const userB = (await clientB.auth.getUser()).data.user!;
  const tenantB = await getUserTenantId(clientB, userB.id);

  console.log(`✅ Tenant B authenticated: ${TENANT_B.email}`);
  console.log(`   User ID: ${userB.id}`);

  console.log(`✅ Verified: User A tenant_id = ${tenantA}`);
  console.log(`✅ Verified: User B tenant_id = ${tenantB}`);

  let customerA_id: string | null = null;
  let customerB_id: string | null = null;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // A1: Tenant A can SELECT own customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A1: Tenant A can SELECT own customer');
    console.log('━'.repeat(70));

    // First, create a customer for Tenant A
    const { data: createdA, error: createErrorA } = await clientA
      .from('re_customers')
      .insert({
        tenant_id: tenantA,
        name: `Test Customer A1-${Date.now()}`,
        phone: `+8490${Date.now().toString().slice(-7)}`,
      })
      .select()
      .single();

    if (createErrorA || !createdA) {
      console.log('❌ FAIL');
      console.log(`   Setup failed: ${createErrorA?.message}`);
      results.push({ gate: 'A1', passed: false, details: 'Setup failed' });
    } else {
      customerA_id = createdA.id;

      // Now try to SELECT it
      const { data: selectedA, error: selectErrorA } = await clientA
        .from('re_customers')
        .select('*')
        .eq('id', customerA_id)
        .single();

      if (selectErrorA || !selectedA) {
        console.log('❌ FAIL');
        console.log(`   Cannot read own customer: ${selectErrorA?.message}`);
        results.push({ gate: 'A1', passed: false, details: selectErrorA?.message });
      } else {
        console.log('✅ PASS');
        console.log(`   Customer readable: ${selectedA.name}`);
        results.push({ gate: 'A1', passed: true });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Create Tenant B customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('SETUP: Create Tenant B customer (for cross-tenant tests)');
    console.log('━'.repeat(70));

    const { data: createdB, error: createErrorB } = await clientB
      .from('re_customers')
      .insert({
        tenant_id: tenantB,
        name: `Test Customer B-${Date.now()}`,
        phone: `+8491${Date.now().toString().slice(-7)}`,
      })
      .select()
      .single();

    if (createErrorB || !createdB) {
      console.log('❌ Setup failed:', createErrorB?.message);
      throw new Error('Cannot proceed without Tenant B customer');
    }

    customerB_id = createdB.id;
    console.log(`✅ Tenant B customer created: ${customerB_id.substring(0, 8)}...`);

    // ─────────────────────────────────────────────────────────────────────────
    // A2: Tenant A cannot SELECT Tenant B customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A2: Tenant A cannot SELECT Tenant B customer');
    console.log('━'.repeat(70));

    const { data: crossRead, error: crossReadError } = await clientA
      .from('re_customers')
      .select('*')
      .eq('id', customerB_id)
      .single();

    if (crossRead) {
      console.log('❌ FAIL');
      console.log('   Cross-tenant read NOT blocked (customer visible)');
      results.push({ gate: 'A2', passed: false, details: 'Cross-tenant visible' });
    } else if (crossReadError?.code === 'PGRST116') {
      // No rows returned (correct behavior)
      console.log('✅ PASS');
      console.log('   Cross-tenant customer invisible (RLS blocked)');
      results.push({ gate: 'A2', passed: true });
    } else {
      console.log('❌ FAIL');
      console.log(`   Unexpected error: ${crossReadError?.message}`);
      results.push({ gate: 'A2', passed: false, details: crossReadError?.message });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A3: Tenant A can INSERT own customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A3: Tenant A can INSERT own customer');
    console.log('━'.repeat(70));

    const { data: insertedA3, error: insertErrorA3 } = await clientA
      .from('re_customers')
      .insert({
        tenant_id: tenantA,
        name: `Test Customer A3-${Date.now()}`,
        phone: `+8492${Date.now().toString().slice(-7)}`,
      })
      .select()
      .single();

    if (insertErrorA3 || !insertedA3) {
      console.log('❌ FAIL');
      console.log(`   Cannot insert own customer: ${insertErrorA3?.message}`);
      results.push({ gate: 'A3', passed: false, details: insertErrorA3?.message });
    } else {
      console.log('✅ PASS');
      console.log(`   Customer created: ${insertedA3.id.substring(0, 8)}...`);
      results.push({ gate: 'A3', passed: true });

      // Cleanup A3 customer
      await clientA.from('re_customers').delete().eq('id', insertedA3.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A4: Tenant A cannot INSERT with tenant_id = Tenant B (forgery)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A4: Tenant A cannot INSERT tenant_id = Tenant B (forgery)');
    console.log('━'.repeat(70));

    const { data: forgeryAttempt, error: forgeryError } = await clientA
      .from('re_customers')
      .insert({
        tenant_id: tenantB, // Attempting forgery!
        name: 'Forged Customer',
        phone: `+8493${Date.now().toString().slice(-7)}`,
      })
      .select()
      .single();

    if (forgeryAttempt) {
      console.log('❌ FAIL');
      console.log('   Tenant forgery NOT blocked (customer created with wrong tenant_id)');
      results.push({ gate: 'A4', passed: false, details: 'Forgery succeeded' });
      
      // Cleanup forged customer
      const serviceRole = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await serviceRole.from('re_customers').delete().eq('id', forgeryAttempt.id);
    } else if (forgeryError) {
      console.log('✅ PASS');
      console.log('   Tenant forgery blocked (WITH CHECK on INSERT)');
      console.log(`   Error: ${forgeryError.message}`);
      results.push({ gate: 'A4', passed: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A5: Tenant A can UPDATE own customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A5: Tenant A can UPDATE own customer');
    console.log('━'.repeat(70));

    if (!customerA_id) {
      console.log('⏭️  SKIPPED (A1 failed)');
      results.push({ gate: 'A5', passed: false, details: 'A1 failed' });
    } else {
      const { data: updatedA, error: updateErrorA } = await clientA
        .from('re_customers')
        .update({ name: 'Updated Name A5' })
        .eq('id', customerA_id)
        .select()
        .single();

      if (updateErrorA || !updatedA) {
        console.log('❌ FAIL');
        console.log(`   Cannot update own customer: ${updateErrorA?.message}`);
        results.push({ gate: 'A5', passed: false, details: updateErrorA?.message });
      } else {
        console.log('✅ PASS');
        console.log(`   Customer updated: ${updatedA.name}`);
        results.push({ gate: 'A5', passed: true });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A6: Tenant A cannot UPDATE Tenant B customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A6: Tenant A cannot UPDATE Tenant B customer');
    console.log('━'.repeat(70));

    const { data: crossUpdate, error: crossUpdateError } = await clientA
      .from('re_customers')
      .update({ name: 'Hacked Name' })
      .eq('id', customerB_id)
      .select();

    if (crossUpdate && crossUpdate.length > 0) {
      console.log('❌ FAIL');
      console.log('   Cross-tenant update NOT blocked');
      results.push({ gate: 'A6', passed: false, details: 'Cross-tenant update succeeded' });
    } else {
      console.log('✅ PASS');
      console.log('   Cross-tenant update blocked (RLS USING clause)');
      console.log(`   Rows affected: 0`);
      results.push({ gate: 'A6', passed: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A7: Tenant A cannot UPDATE customer.tenant_id → Tenant B (escape)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A7: Tenant A cannot UPDATE tenant_id → Tenant B (escape)');
    console.log('━'.repeat(70));

    if (!customerA_id) {
      console.log('⏭️  SKIPPED (A1 failed)');
      results.push({ gate: 'A7', passed: false, details: 'A1 failed' });
    } else {
      const { data: escapeAttempt, error: escapeError } = await clientA
        .from('re_customers')
        .update({ tenant_id: tenantB }) // Attempting escape!
        .eq('id', customerA_id)
        .select();

      if (escapeAttempt && escapeAttempt.length > 0) {
        console.log('❌ FAIL');
        console.log('   Tenant escape NOT blocked (tenant_id changed)');
        results.push({ gate: 'A7', passed: false, details: 'Escape succeeded' });
        
        // Restore correct tenant_id
        const serviceRole = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await serviceRole.from('re_customers').update({ tenant_id: tenantA }).eq('id', customerA_id);
      } else if (escapeError) {
        console.log('✅ PASS');
        console.log('   Tenant escape blocked (WITH CHECK on UPDATE)');
        console.log(`   Error: ${escapeError.message}`);
        results.push({ gate: 'A7', passed: true });
      } else {
        console.log('✅ PASS');
        console.log('   Tenant escape blocked (no rows affected)');
        results.push({ gate: 'A7', passed: true });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A8: Tenant A can DELETE own test customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A8: Tenant A can DELETE own test customer');
    console.log('━'.repeat(70));

    if (!customerA_id) {
      console.log('⏭️  SKIPPED (A1 failed)');
      results.push({ gate: 'A8', passed: false, details: 'A1 failed' });
    } else {
      const { data: deletedA, error: deleteErrorA } = await clientA
        .from('re_customers')
        .delete()
        .eq('id', customerA_id)
        .select();

      if (deleteErrorA) {
        console.log('❌ FAIL');
        console.log(`   Cannot delete own customer: ${deleteErrorA.message}`);
        results.push({ gate: 'A8', passed: false, details: deleteErrorA.message });
      } else if (deletedA && deletedA.length > 0) {
        console.log('✅ PASS');
        console.log('   Own customer deleted');
        customerA_id = null; // Prevent double cleanup
        results.push({ gate: 'A8', passed: true });
      } else {
        console.log('❌ FAIL');
        console.log('   Delete returned 0 rows');
        results.push({ gate: 'A8', passed: false, details: 'No rows deleted' });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A9: Tenant A cannot DELETE Tenant B customer
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('A9: Tenant A cannot DELETE Tenant B customer');
    console.log('━'.repeat(70));

    const { data: crossDelete, error: crossDeleteError } = await clientA
      .from('re_customers')
      .delete()
      .eq('id', customerB_id)
      .select();

    if (crossDelete && crossDelete.length > 0) {
      console.log('❌ FAIL');
      console.log('   Cross-tenant delete NOT blocked');
      results.push({ gate: 'A9', passed: false, details: 'Cross-tenant delete succeeded' });
    } else {
      console.log('✅ PASS');
      console.log('   Cross-tenant delete blocked (RLS USING clause)');
      console.log('   Rows affected: 0');
      results.push({ gate: 'A9', passed: true });
    }

  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP (using service_role for admin operations)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('CLEANUP (using service_role for admin operations)');
    console.log('━'.repeat(70));

    const serviceRole = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    if (customerA_id) {
      await serviceRole.from('re_customers').delete().eq('id', customerA_id);
      console.log('✅ Tenant A test customer deleted');
    }

    if (customerB_id) {
      await serviceRole.from('re_customers').delete().eq('id', customerB_id);
      console.log('✅ Tenant B test customer deleted');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));

  console.log('Standard RLS (Layers 1-4):');
  results.forEach((r) => {
    const icon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} ${r.gate}: ${r.details || ''}`);
  });

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log('─'.repeat(70));
  console.log(`Result: ${passedCount}/${totalCount} tests passed`);
  console.log('─'.repeat(70));

  if (passedCount === totalCount) {
    console.log('✅ C3.2 PASS — Authenticated security verified');
    console.log('🎯 RLS POLICIES ENFORCED');
    console.log('▶️  Proceed to C3.3 Production Browser Runtime');
    process.exit(0);
  } else {
    console.log('❌ C3.2 FAIL — Some security gates did not pass');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ UNEXPECTED ERROR:');
  console.error(err);
  process.exit(1);
});
