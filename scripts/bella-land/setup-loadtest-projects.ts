/**
 * Setup projects for loadtest tenants (for P2.2 authenticated testing)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const TENANT_A_ID = '1a6643da-3806-4793-a301-7a6d60b0d888';
  const TENANT_B_ID = '60135a61-d8a0-47f2-a0d9-835ff0bd437e';

  console.log('Setting up loadtest tenant projects...\n');

  // Create project for Tenant A
  console.log('Creating project for Tenant A (Real Estate)...');
  const { data: projectA, error: errorA } = await supabase
    .from('real_estate_projects')
    .insert({
      tenant_id: TENANT_A_ID,
      name: 'P2.2 Test Project - Real Estate',
      location: 'Test Location A',
      description: 'Project for P2.2 authenticated security testing',
      status: 'active'
    })
    .select()
    .single();

  if (errorA) {
    console.error('❌ Error creating Tenant A project:', errorA);
    process.exit(1);
  }

  console.log(`✅ Tenant A project created: ${projectA.id}`);

  // Create project for Tenant B
  console.log('\nCreating project for Tenant B (Healthcare)...');
  const { data: projectB, error: errorB } = await supabase
    .from('real_estate_projects')
    .insert({
      tenant_id: TENANT_B_ID,
      name: 'P2.2 Test Project - Healthcare',
      location: 'Test Location B',
      description: 'Project for P2.2 authenticated security testing',
      status: 'active'
    })
    .select()
    .single();

  if (errorB) {
    console.error('❌ Error creating Tenant B project:', errorB);
    process.exit(1);
  }

  console.log(`✅ Tenant B project created: ${projectB.id}`);

  console.log('\n✅ Setup complete!');
  console.log('\nFixture summary:');
  console.log('Tenant A:', TENANT_A_ID);
  console.log('  Project:', projectA.id);
  console.log('Tenant B:', TENANT_B_ID);
  console.log('  Project:', projectB.id);
}

main().catch(console.error);
