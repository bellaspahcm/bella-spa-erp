/**
 * P1.3 — Projects Authenticated Tenant Isolation Tests
 * 
 * Tests A1-A8: Verify RLS enforcement with authenticated users (NOT service-role)
 * 
 * Decision criteria:
 * - 8/8 PASS → P1.3 VERIFIED → Continue to P1.4
 * - ANY FAIL → Stop, freeze evidence, RCA, fix, rerun
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Test users from different tenants
const TENANT_A = {
  email: 'loadtest-realestate@test.local',
  password: 'Test123456!',
  tenant_id: '1a6643da-3806-4793-a301-7a6d60b0d888',
  tenant_name: 'K6 Load Test — Real Estate',
};

const TENANT_B = {
  email: 'loadtest-healthcare@test.local',
  password: 'Test123456!',
  tenant_id: '60135a61-d8a0-47f2-a0d9-835ff0bd437e',
  tenant_name: 'K6 Load Test — Healthcare OS',
};

interface TestResult {
  test: string;
  passed: boolean;
  expected: string;
  actual: string;
  evidence: any;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, expected: string, actual: string, evidence: any = null) {
  results.push({ test, passed, expected, actual, evidence });
  const emoji = passed ? '✅' : '❌';
  console.log(`${emoji} ${test}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual: ${actual}`);
  if (evidence) {
    console.log(`   Evidence:`, JSON.stringify(evidence, null, 2));
  }
  console.log('');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('P1.3 — Projects Authenticated Tenant Isolation Tests');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Create authenticated clients (NOT service-role)
  const clientA = createClient(supabaseUrl, supabaseAnonKey);
  const clientB = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Authenticating Tenant A user...');
  const { data: authA, error: authErrorA } = await clientA.auth.signInWithPassword({
    email: TENANT_A.email,
    password: TENANT_A.password,
  });

  if (authErrorA) {
    console.error('❌ Failed to authenticate Tenant A:', authErrorA);
    console.log('\nNote: Test users may need password setup. Checking for alternative auth method...\n');
    process.exit(1);
  }

  console.log('✅ Tenant A authenticated:', authA.user?.email);
  console.log('   User ID:', authA.user?.id);
  console.log('');

  console.log('Authenticating Tenant B user...');
  const { data: authB, error: authErrorB } = await clientB.auth.signInWithPassword({
    email: TENANT_B.email,
    password: TENANT_B.password,
  });

  if (authErrorB) {
    console.error('❌ Failed to authenticate Tenant B:', authErrorB);
    process.exit(1);
  }

  console.log('✅ Tenant B authenticated:', authB.user?.email);
  console.log('   User ID:', authB.user?.id);
  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Verify tenant membership before tests
  const { data: userAData } = await clientA.from('users').select('tenant_id').eq('id', authA.user!.id).single();
  const { data: userBData } = await clientB.from('users').select('tenant_id').eq('id', authB.user!.id).single();

  console.log('Tenant A user tenant_id:', userAData?.tenant_id);
  console.log('Tenant B user tenant_id:', userBData?.tenant_id);
  console.log('');

  if (userAData?.tenant_id !== TENANT_A.tenant_id) {
    console.error('❌ Tenant A user has wrong tenant_id!');
    process.exit(1);
  }

  if (userBData?.tenant_id !== TENANT_B.tenant_id) {
    console.error('❌ Tenant B user has wrong tenant_id!');
    process.exit(1);
  }

  let projectAId: string;

  // ═══════════════════════════════════════════════════════════
  // A1: Tenant A creates Project A → ALLOW
  // ═══════════════════════════════════════════════════════════
  console.log('A1: Tenant A creates Project A (own-tenant create)');
  const { data: projectA, error: createError } = await clientA
    .from('real_estate_projects')
    .insert({
      name: `A1 Test Project - ${Date.now()}`,
      description: 'P1.3 A1 test project',
      status: 'planning',
      tenant_id: TENANT_A.tenant_id, // Production code provides tenant_id explicitly
    })
    .select()
    .single();

  if (createError || !projectA) {
    logTest('A1', false, 'Project created successfully', `Error: ${createError?.message}`, createError);
  } else {
    projectAId = projectA.id;
    const tenantMatch = projectA.tenant_id === TENANT_A.tenant_id;
    logTest(
      'A1',
      tenantMatch,
      `Project created with tenant_id=${TENANT_A.tenant_id}`,
      `Project created with tenant_id=${projectA.tenant_id}`,
      { projectId: projectA.id, tenant_id: projectA.tenant_id }
    );
  }

  if (!projectAId!) {
    console.error('❌ Cannot continue tests without Project A. Stopping.');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════
  // A2: Tenant A reads Project A → ALLOW
  // ═══════════════════════════════════════════════════════════
  console.log('A2: Tenant A reads Project A (own-tenant read)');
  const { data: readOwn, error: readOwnError } = await clientA
    .from('real_estate_projects')
    .select('*')
    .eq('id', projectAId)
    .single();

  logTest(
    'A2',
    !!readOwn && !readOwnError,
    'Tenant A can read own project',
    readOwn ? 'Project visible' : `Not visible: ${readOwnError?.message}`,
    { found: !!readOwn }
  );

  // ═══════════════════════════════════════════════════════════
  // A3: Tenant B reads Project A → BLOCK/invisible
  // ═══════════════════════════════════════════════════════════
  console.log('A3: Tenant B reads Project A (cross-tenant read blocked)');
  const { data: readCross, error: readCrossError } = await clientB
    .from('real_estate_projects')
    .select('*')
    .eq('id', projectAId)
    .single();

  logTest(
    'A3',
    !readCross && readCrossError?.code === 'PGRST116', // "not found" because RLS filtered it
    'Project invisible to Tenant B (RLS filtered)',
    readCross ? 'Project LEAKED (visible to Tenant B!)' : 'Project not visible (RLS working)',
    { leaked: !!readCross, error: readCrossError?.message }
  );

  // ═══════════════════════════════════════════════════════════
  // A4: Tenant B updates Project A → BLOCK
  // ═══════════════════════════════════════════════════════════
  console.log('A4: Tenant B updates Project A (cross-tenant update blocked)');
  const { data: updateCross, error: updateCrossError } = await clientB
    .from('real_estate_projects')
    .update({ name: 'HACKED BY TENANT B' })
    .eq('id', projectAId)
    .select();

  logTest(
    'A4',
    !updateCross || updateCross.length === 0,
    'Update blocked (0 rows affected)',
    updateCross && updateCross.length > 0
      ? `Update succeeded (${updateCross.length} rows) — RLS FAILED!`
      : 'Update blocked (RLS working)',
    { rowsAffected: updateCross?.length || 0 }
  );

  // ═══════════════════════════════════════════════════════════
  // A5: Tenant B deletes Project A → BLOCK
  // ═══════════════════════════════════════════════════════════
  console.log('A5: Tenant B deletes Project A (cross-tenant delete blocked)');
  const { data: deleteCross, error: deleteCrossError } = await clientB
    .from('real_estate_projects')
    .delete()
    .eq('id', projectAId)
    .select();

  logTest(
    'A5',
    !deleteCross || deleteCross.length === 0,
    'Delete blocked (0 rows affected)',
    deleteCross && deleteCross.length > 0
      ? `Delete succeeded (${deleteCross.length} rows) — RLS FAILED!`
      : 'Delete blocked (RLS working)',
    { rowsAffected: deleteCross?.length || 0 }
  );

  // ═══════════════════════════════════════════════════════════
  // A6: Tenant B inserts with tenant_id=A → BLOCK (WITH CHECK)
  // ═══════════════════════════════════════════════════════════
  console.log('A6: Tenant B inserts project with tenant_id=A (tenant forgery blocked by WITH CHECK)');
  const { data: forgery, error: forgeryError } = await clientB
    .from('real_estate_projects')
    .insert({
      name: `A6 Forgery Attempt - ${Date.now()}`,
      description: 'Attempting to forge Tenant A project',
      status: 'planning',
      tenant_id: TENANT_A.tenant_id, // Explicit forgery attempt
    })
    .select();

  logTest(
    'A6',
    !!forgeryError && !forgery,
    'Insert blocked by WITH CHECK (policy violation)',
    forgeryError
      ? `Blocked: ${forgeryError.message}`
      : 'Insert succeeded — WITH CHECK NOT WORKING!',
    { error: forgeryError?.message, inserted: !!forgery }
  );

  // ═══════════════════════════════════════════════════════════
  // A7: Tenant A updates tenant_id A→B → BLOCK (WITH CHECK)
  // ═══════════════════════════════════════════════════════════
  console.log('A7: Tenant A attempts to change tenant_id A→B (tenant escape blocked by WITH CHECK)');
  const { data: escape, error: escapeError } = await clientA
    .from('real_estate_projects')
    .update({ tenant_id: TENANT_B.tenant_id })
    .eq('id', projectAId)
    .select();

  logTest(
    'A7',
    !!escapeError && (!escape || escape.length === 0),
    'Update blocked by WITH CHECK (policy violation)',
    escapeError
      ? `Blocked: ${escapeError.message}`
      : 'Update succeeded — WITH CHECK NOT WORKING!',
    { error: escapeError?.message, rowsAffected: escape?.length || 0 }
  );

  // ═══════════════════════════════════════════════════════════
  // A8: Tenant B queries don't leak Project A → PASS
  // ═══════════════════════════════════════════════════════════
  console.log('A8: Tenant B normal project queries (no leakage)');
  const { data: tenantBProjects } = await clientB
    .from('real_estate_projects')
    .select('id')
    .eq('id', projectAId);

  const leaked = tenantBProjects && tenantBProjects.length > 0;

  logTest(
    'A8',
    !leaked,
    'Project A not visible in Tenant B queries',
    leaked ? 'PROJECT LEAKED IN QUERY!' : 'No leakage (RLS working)',
    { projectsFound: tenantBProjects?.length || 0 }
  );

  // ═══════════════════════════════════════════════════════════
  // Cleanup: Delete test project
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Cleanup: Deleting test project...');
  await clientA.from('real_estate_projects').delete().eq('id', projectAId);
  console.log('✅ Test project deleted');

  // Sign out
  await clientA.auth.signOut();
  await clientB.auth.signOut();

  // ═══════════════════════════════════════════════════════════
  // Final Results
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  results.forEach((r) => {
    const emoji = r.passed ? '✅' : '❌';
    console.log(`${emoji} ${r.test}: ${r.passed ? 'PASS' : 'FAIL'}`);
  });

  console.log('');
  console.log(`Total: ${passedCount}/${totalCount} tests passed`);
  console.log('');

  if (passedCount === totalCount) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ P1.3 VERDICT: TENANT ISOLATION VERIFIED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('All 8 authenticated tenant isolation tests passed.');
    console.log('RLS WITH CHECK enforcement confirmed.');
    console.log('Cross-tenant read/write/delete operations blocked.');
    console.log('Tenant forgery attempts blocked.');
    console.log('');
    console.log('Next: P1.4 UI → Service → DB trace');
    console.log('      P1.5 Regression & Projects seal');
    process.exit(0);
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ P1.3 VERDICT: TENANT ISOLATION FAILED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`${totalCount - passedCount} test(s) failed.`);
    console.log('');
    console.log('Action required:');
    console.log('1. Freeze this evidence');
    console.log('2. Root cause analysis');
    console.log('3. Fix RLS policy or service layer');
    console.log('4. Rerun all A1-A8 tests');
    console.log('5. Do NOT continue to P1.4 until 8/8 PASS');
    console.log('');
    console.log('Failed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.test}: ${r.actual}`);
      });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
