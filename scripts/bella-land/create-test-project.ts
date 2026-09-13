/**
 * Bella Land v2 — Create Test Project for P2.2 Fixture
 * 
 * Purpose: Create a real_estate_project for Bella General Hospital tenant
 * to enable P2.2 A1-A10 isolation testing
 * 
 * Tenant: Bella General Hospital (c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d)
 * User: healthcare.admin@bellaspa.vn (242288f2-1246-44ed-bb5e-f1b43c0886b3)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestProject() {
  console.log('\n🏗️  CREATE TEST PROJECT FOR P2.2 FIXTURE\n');
  console.log('=' .repeat(60));

  const tenantId = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d'; // Bella General Hospital
  const tenantName = 'Bella General Hospital';

  console.log(`\n📍 Target Tenant: ${tenantName}`);
  console.log(`   ID: ${tenantId.substring(0, 8)}...`);

  // Verify tenant exists
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    console.error('❌ Tenant not found:', tenantError);
    process.exit(1);
  }

  console.log(`✅ Tenant verified: ${tenant.name}`);

  // Check if project already exists
  const { data: existingProjects } = await supabase
    .from('real_estate_projects')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (existingProjects && existingProjects.length > 0) {
    console.log(`\n⚠️  Projects already exist for this tenant:`);
    existingProjects.forEach(p => {
      console.log(`   - ${p.name} [${p.id.substring(0, 8)}...]`);
    });
    console.log('\n✅ Fixture already complete - no action needed');
    process.exit(0);
  }

  // Create test project
  console.log('\n🔨 Creating test project...');

  const projectData = {
    tenant_id: tenantId,
    name: 'P2.2 Test Project - Bella General Hospital',
    location: 'Test Location',
    description: 'Test project created for P2.2 tenant isolation testing',
    status: 'active'
  };

  const { data: newProject, error: projectError } = await supabase
    .from('real_estate_projects')
    .insert(projectData)
    .select()
    .single();

  if (projectError) {
    console.error('❌ Error creating project:', projectError);
    process.exit(1);
  }

  console.log(`\n✅ Project created successfully!`);
  console.log(`   ID: ${newProject.id}`);
  console.log(`   Name: ${newProject.name}`);
  console.log(`   Status: ${newProject.status}`);

  // Verify we can read it back
  const { data: verifyProject } = await supabase
    .from('real_estate_projects')
    .select('id, name, tenant_id')
    .eq('id', newProject.id)
    .single();

  if (verifyProject) {
    console.log(`\n✅ Verification: Project readable`);
    console.log(`   tenant_id: ${verifyProject.tenant_id.substring(0, 8)}... (matches: ${verifyProject.tenant_id === tenantId})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST FIXTURE COMPONENT CREATED');
  console.log('\nNext: Run inspect-test-fixtures.ts to verify 2 valid tenants');
  console.log('=' .repeat(60));
}

createTestProject().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
