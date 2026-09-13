/**
 * Check if loadtest tenants have projects for P2.2 testing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const TENANT_A_ID = '1a6643da-3806-4793-a301-7a6d60b0d888'; // K6 Load Test — Real Estate
  const TENANT_B_ID = '60135a61-d8a0-47f2-a0d9-835ff0bd437e'; // K6 Load Test — Healthcare OS

  console.log('Checking loadtest tenant fixtures...\n');

  // Check Tenant A
  const { data: tenantA } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', TENANT_A_ID)
    .single();

  const { data: projectsA } = await supabase
    .from('real_estate_projects')
    .select('id, name')
    .eq('tenant_id', TENANT_A_ID);

  console.log(`Tenant A: ${tenantA?.name}`);
  console.log(`  ID: ${TENANT_A_ID}`);
  console.log(`  Projects: ${projectsA?.length || 0}`);
  if (projectsA && projectsA.length > 0) {
    projectsA.forEach(p => console.log(`    - ${p.name} [${p.id}]`));
  }

  // Check Tenant B
  const { data: tenantB } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', TENANT_B_ID)
    .single();

  const { data: projectsB } = await supabase
    .from('real_estate_projects')
    .select('id, name')
    .eq('tenant_id', TENANT_B_ID);

  console.log(`\nTenant B: ${tenantB?.name}`);
  console.log(`  ID: ${TENANT_B_ID}`);
  console.log(`  Projects: ${projectsB?.length || 0}`);
  if (projectsB && projectsB.length > 0) {
    projectsB.forEach(p => console.log(`    - ${p.name} [${p.id}]`));
  }

  console.log('\n---');
  const needProjectA = !projectsA || projectsA.length === 0;
  const needProjectB = !projectsB || projectsB.length === 0;

  if (needProjectA || needProjectB) {
    console.log('⚠️  Missing projects:');
    if (needProjectA) console.log('  - Tenant A needs project');
    if (needProjectB) console.log('  - Tenant B needs project');
    console.log('\nWill create projects if needed...');
  } else {
    console.log('✅ Both tenants have projects');
  }
}

main().catch(console.error);
