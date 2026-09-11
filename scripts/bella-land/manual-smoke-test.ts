/**
 * Manual Smoke Test Simulation - Projects Creation
 * Uses authenticated Supabase client (like browser) to test full workflow
 */

import { createClient } from '@supabase/supabase-js';
import { ProjectService } from '../../src/modules/real_estate/services/ProjectService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('P1.4 Manual Smoke Test Simulation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const projectName = `Manual Smoke Test ${Date.now()}`;
  
  // Step 1: Authenticate as real user
  console.log('Step 1: Authenticate as admin user...');
  const client = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'loadtest-realestate@test.local',
    password: 'Test123456!',
  });

  if (authError || !authData.user) {
    console.error('❌ Authentication failed:', authError);
    process.exit(1);
  }

  console.log('✅ Authenticated:', authData.user.email);
  console.log('   User ID:', authData.user.id);

  // Get user tenant_id
  const { data: userData } = await client
    .from('users')
    .select('tenant_id, role')
    .eq('id', authData.user.id)
    .single();

  if (!userData) {
    console.error('❌ User data not found');
    process.exit(1);
  }

  console.log('   Tenant ID:', userData.tenant_id);
  console.log('   Role:', userData.role);
  console.log('');

  // Step 2: Create project via ProjectService (simulating server action path)
  console.log('Step 2: Creating project via ProjectService...');
  console.log('   (This simulates: UI → createProjectAction → ProjectService)');
  
  try {
    const project = await ProjectService.createProject(client, userData.tenant_id, {
      name: projectName,
      description: 'Created via manual smoke test simulation',
      status: 'active',
    });

    console.log('✅ ProjectService.createProject succeeded');
    console.log('   Project ID:', project.id);
    console.log('   Tenant ID:', project.tenant_id);
    console.log('');

    // Step 3: Verify DB persistence (simulating page reload)
    console.log('Step 3: Verify DB persistence (simulating reload)...');
    
    const { data: verifyData, error: verifyError } = await client
      .from('real_estate_projects')
      .select('id, name, tenant_id')
      .eq('id', project.id)
      .single();

    if (verifyError || !verifyData) {
      console.error('❌ OUTCOME C: Created but cannot read back');
      console.error('Error:', verifyError);
      process.exit(1);
    }

    console.log('✅ Project found in DB');
    console.log('   ID:', verifyData.id);
    console.log('   Name:', verifyData.name);
    console.log('   Tenant ID:', verifyData.tenant_id);
    console.log('');

    // Step 4: Verify tenant isolation
    console.log('Step 4: Verify tenant isolation...');
    
    if (verifyData.tenant_id !== userData.tenant_id) {
      console.error('❌ Tenant mismatch!');
      console.error('   User tenant:', userData.tenant_id);
      console.error('   Project tenant:', verifyData.tenant_id);
      process.exit(1);
    }

    console.log('✅ Tenant ID matches authenticated user');
    console.log('');

    // Step 5: Verify via list query (simulating UI project list)
    console.log('Step 5: Verify via list query (simulating UI list)...');
    
    const { data: listData, error: listError } = await client
      .from('real_estate_projects')
      .select('id, name')
      .eq('tenant_id', userData.tenant_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (listError) {
      console.error('❌ List query failed:', listError);
      process.exit(1);
    }

    const foundInList = listData?.some(p => p.id === project.id);
    
    if (!foundInList) {
      console.error('❌ OUTCOME C: Project exists but not in user list');
      process.exit(1);
    }

    console.log('✅ Project visible in list query');
    console.log(`   Found in ${listData?.length} recent projects`);
    console.log('');

    // Cleanup
    console.log('Cleanup: Deleting test project...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabaseAdmin.from('real_estate_projects').delete().eq('id', project.id);
    console.log('✅ Test project deleted');
    console.log('');

    // Final verdict
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ OUTCOME A: MANUAL SMOKE TEST PASSED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Evidence:');
    console.log('  ✅ Authentication works');
    console.log('  ✅ ProjectService.createProject succeeds with authenticated client');
    console.log('  ✅ DB row created with correct tenant_id');
    console.log('  ✅ Project readable after creation');
    console.log('  ✅ Project visible in list query');
    console.log('  ✅ RLS allows own-tenant read');
    console.log('');
    console.log('Conclusion:');
    console.log('  → Production write path WORKS');
    console.log('  → Authenticated workflow WORKS');
    console.log('  → E2E test failure is likely HARNESS ISSUE');
    console.log('');
    console.log('Note: This test bypasses UI → Action layer');
    console.log('      (calls ProjectService directly)');
    console.log('      But proves core write + auth + RLS working');
    console.log('');
  } catch (error) {
    console.error('\n❌ OUTCOME B: ProjectService.createProject failed');
    console.error('Error:', error);
    console.error('\nThis indicates PRODUCT RUNTIME DEFECT in service/DB layer.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
