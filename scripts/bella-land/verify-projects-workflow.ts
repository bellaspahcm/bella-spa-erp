/**
 * Bella Land Projects - Quick Database Verification
 * 
 * Checks:
 * 1. Projects exist with correct status values
 * 2. Tenant isolation intact
 * 3. No orphan/invalid status values
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

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];

const VALID_STATUSES = ['planning', 'active', 'completed', 'cancelled'];

async function verifyProjects() {
  console.log('\n🔍 Bella Land Projects - Database Verification\n');
  console.log('═'.repeat(70));

  // 1. Check all projects
  const { data: allProjects, error } = await supabase
    .from('real_estate_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch projects:', error.message);
    return;
  }

  console.log(`\n📊 Total projects in database: ${allProjects?.length || 0}`);

  if (!allProjects || allProjects.length === 0) {
    console.log('\n⚠️  No projects found. Create test projects first.');
    return;
  }

  // 2. Group by tenant
  const projectsByTenant = new Map<string, ProjectRow[]>();
  for (const project of allProjects) {
    if (!projectsByTenant.has(project.tenant_id)) {
      projectsByTenant.set(project.tenant_id, []);
    }
    projectsByTenant.get(project.tenant_id)!.push(project);
  }

  console.log(`\n👥 Tenants with projects: ${projectsByTenant.size}`);

  // 3. Check status values
  console.log('\n━'.repeat(70));
  console.log('📋 STATUS VALIDATION');
  console.log('━'.repeat(70));

  let validCount = 0;
  let invalidCount = 0;
  const invalidProjects: Array<{ name: string; status: string; tenant_id: string }> = [];

  for (const project of allProjects) {
    if (VALID_STATUSES.includes(project.status)) {
      validCount++;
    } else {
      invalidCount++;
      invalidProjects.push({
        name: project.name,
        status: project.status,
        tenant_id: project.tenant_id
      });
    }
  }

  console.log(`\n✅ Valid status values: ${validCount}`);
  console.log(`🔴 Invalid status values: ${invalidCount}`);

  if (invalidProjects.length > 0) {
    console.log('\n⚠️  INVALID STATUS FOUND:');
    for (const p of invalidProjects) {
      console.log(`   - "${p.name}": status="${p.status}" (tenant: ${p.tenant_id.slice(0, 8)}...)`);
    }
    console.log('\n   Expected: planning | active | completed | cancelled');
  }

  // 4. Status distribution
  console.log('\n━'.repeat(70));
  console.log('📈 STATUS DISTRIBUTION');
  console.log('━'.repeat(70));

  const statusCount = new Map<string, number>();
  for (const project of allProjects) {
    statusCount.set(project.status, (statusCount.get(project.status) || 0) + 1);
  }

  for (const [status, count] of Array.from(statusCount.entries()).sort((a, b) => b[1] - a[1])) {
    const isValid = VALID_STATUSES.includes(status);
    const icon = isValid ? '✅' : '🔴';
    console.log(`   ${icon} ${status.padEnd(15)} ${count}`);
  }

  // 5. Tenant isolation check
  console.log('\n━'.repeat(70));
  console.log('🔒 TENANT ISOLATION');
  console.log('━'.repeat(70));

  for (const [tenantId, projects] of projectsByTenant.entries()) {
    console.log(`\n   Tenant: ${tenantId.slice(0, 8)}...`);
    console.log(`   Projects: ${projects.length}`);
    
    // Check for any null tenant_id
    const nullTenantProjects = projects.filter(p => !p.tenant_id);
    if (nullTenantProjects.length > 0) {
      console.log(`   🔴 WARNING: ${nullTenantProjects.length} projects with null tenant_id`);
    } else {
      console.log(`   ✅ All projects have tenant_id`);
    }
  }

  // 6. Recent projects
  console.log('\n━'.repeat(70));
  console.log('🕐 RECENT PROJECTS (Last 5)');
  console.log('━'.repeat(70));

  const recentProjects = allProjects.slice(0, 5);
  for (const project of recentProjects) {
    const statusIcon = VALID_STATUSES.includes(project.status) ? '✅' : '🔴';
    const createdAt = new Date(project.created_at).toLocaleString('vi-VN');
    console.log(`\n   ${statusIcon} ${project.name}`);
    console.log(`      Status: ${project.status}`);
    console.log(`      Tenant: ${project.tenant_id.slice(0, 8)}...`);
    console.log(`      Created: ${createdAt}`);
  }

  // 7. Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  const allValid = invalidCount === 0;
  const allHaveTenant = allProjects.every(p => p.tenant_id);

  console.log(`\n   Total projects: ${allProjects.length}`);
  console.log(`   Valid statuses: ${validCount}/${allProjects.length} ${allValid ? '✅' : '🔴'}`);
  console.log(`   Tenant isolation: ${allHaveTenant ? '✅ All projects have tenant_id' : '🔴 Some missing tenant_id'}`);
  console.log(`   Unique tenants: ${projectsByTenant.size}`);

  if (allValid && allHaveTenant) {
    console.log('\n   🎉 ALL CHECKS PASSED');
  } else {
    console.log('\n   ⚠️  ISSUES FOUND - Review above');
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  // Exit code
  process.exit(allValid && allHaveTenant ? 0 : 1);
}

verifyProjects().catch(console.error);
