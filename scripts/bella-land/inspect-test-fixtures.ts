/**
 * Bella Land v2 — P2.2 Test Fixture Inspector
 * 
 * Purpose: Find existing tenants with authenticated users and projects
 * 
 * Requirements:
 * - Tenant A: Has admin/manager user + valid project
 * - Tenant B: Has admin/manager user + valid project
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

interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  user_count: number;
  project_count: number;
  users: Array<{
    id: string;
    email: string;
    role: string;
  }>;
  projects: Array<{
    id: string;
    project_name: string;
  }>;
}

async function inspectFixtures() {
  console.log('🔍 BELLA LAND V2 — TEST FIXTURE INSPECTION\n');
  console.log('=' .repeat(60));

  // 1. Get all tenants (limit to first 100 for performance)
  console.log('\n📊 Step 1: Query tenants\n');
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name')
    .order('created_at')
    .limit(100);

  if (tenantsError) {
    console.error('❌ Error fetching tenants:', tenantsError);
    process.exit(1);
  }

  console.log(`Inspecting first ${tenants.length} tenants...\n`);

  const tenantInfo: TenantInfo[] = [];
  let validCount = 0;

  // 2. For each tenant, get users and projects (stop after finding 2 valid)
  for (const tenant of tenants) {
    if (validCount >= 2) break; // Stop early if we found enough

    console.log(`\n--- Tenant: ${tenant.name} (${tenant.id.substring(0, 8)}...) ---`);

    // Get users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('tenant_id', tenant.id);

    if (usersError) {
      console.error(`  ❌ Error fetching users:`, usersError);
      continue;
    }

    // Get projects
    const { data: projects, error: projectsError } = await supabase
      .from('real_estate_projects')
      .select('id, name')
      .eq('tenant_id', tenant.id);

    if (projectsError) {
      console.error(`  ❌ Error fetching projects:`, projectsError);
      continue;
    }

    const adminUsers = users.filter(u => 
      u.role === 'admin' || u.role === 'manager'
    );

    console.log(`  Users: ${users.length} total, ${adminUsers.length} admin/manager`);
    console.log(`  Projects: ${projects.length}`);

    if (adminUsers.length > 0) {
      console.log(`\n  Admin/Manager users:`);
      adminUsers.forEach(u => {
        console.log(`    - ${u.email} (${u.role}) [${u.id}]`);
      });
    }

    if (projects.length > 0) {
      console.log(`\n  Projects:`);
      projects.forEach(p => {
        console.log(`    - ${p.name} [${p.id}]`);
      });
    }

    tenantInfo.push({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      user_count: adminUsers.length,
      project_count: projects.length,
      users: adminUsers.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role
      })),
      projects: projects.map(p => ({
        id: p.id,
        project_name: p.name
      }))
    });

    // Count valid fixtures (with both users and projects)
    if (adminUsers.length > 0 && projects.length > 0) {
      validCount++;
    }
  }

  // 3. Analyze fixture candidates
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 FIXTURE ANALYSIS\n');

  const validTenants = tenantInfo.filter(t => 
    t.user_count > 0 && t.project_count > 0
  );

  console.log(`Valid tenants (with users + projects): ${validTenants.length}\n`);

  if (validTenants.length >= 2) {
    console.log('✅ SUFFICIENT FIXTURES FOUND\n');
    console.log('Recommended fixture:\n');
    
    const tenantA = validTenants[0];
    const tenantB = validTenants[1];

    console.log('Tenant A:');
    console.log(`  tenant_id: ${tenantA.tenant_id}`);
    console.log(`  tenant_name: ${tenantA.tenant_name}`);
    console.log(`  user_id: ${tenantA.users[0].id}`);
    console.log(`  user_email: ${tenantA.users[0].email}`);
    console.log(`  project_id: ${tenantA.projects[0].id}`);
    console.log(`  project_name: ${tenantA.projects[0].project_name}`);

    console.log('\nTenant B:');
    console.log(`  tenant_id: ${tenantB.tenant_id}`);
    console.log(`  tenant_name: ${tenantB.tenant_name}`);
    console.log(`  user_id: ${tenantB.users[0].id}`);
    console.log(`  user_email: ${tenantB.users[0].email}`);
    console.log(`  project_id: ${tenantB.projects[0].id}`);
    console.log(`  project_name: ${tenantB.projects[0].project_name}`);

    console.log('\n✅ Ready to execute P2.2 A1-A10');
  } else {
    console.log('⚠️ INSUFFICIENT FIXTURES\n');
    
    console.log('Current state:');
    tenantInfo.forEach(t => {
      const status = (t.user_count > 0 && t.project_count > 0) ? '✅' : '❌';
      console.log(`  ${status} ${t.tenant_name}: ${t.user_count} users, ${t.project_count} projects`);
    });

    console.log('\n📋 Required actions:');
    
    const tenantsWithUsers = tenantInfo.filter(t => t.user_count > 0);
    const tenantsNeedingProjects = tenantsWithUsers.filter(t => t.project_count === 0);

    if (tenantsNeedingProjects.length > 0) {
      console.log('\n  Missing projects for tenants with users:');
      tenantsNeedingProjects.forEach(t => {
        console.log(`    - ${t.tenant_name} (${t.tenant_id})`);
        console.log(`      → Create project via production path`);
      });
    }

    const tenantsNeedingUsers = tenantInfo.filter(t => t.user_count === 0);
    if (tenantsNeedingUsers.length > 0 && tenantsWithUsers.length < 2) {
      console.log('\n  Missing users for tenants:');
      tenantsNeedingUsers.slice(0, 2 - tenantsWithUsers.length).forEach(t => {
        console.log(`    - ${t.tenant_name} (${t.tenant_id})`);
        console.log(`      → Create test user via Auth Admin API`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
}

inspectFixtures().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
