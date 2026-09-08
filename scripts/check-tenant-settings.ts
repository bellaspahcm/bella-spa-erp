/**
 * Check Tenant Settings
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TENANT_ID = 'b5d38901-f9c1-4451-9e16-eaeab35aaeae';

async function main() {
  console.log('🔍 Checking tenant settings...\n');
  console.log('DB URL:', SUPABASE_URL);
  console.log('Tenant ID:', TENANT_ID);
  console.log('');

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, enabled_modules')
    .eq('id', TENANT_ID)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Tenant found:');
  console.log('  Name:', data.name);
  console.log('  Enabled modules:', JSON.stringify(data.enabled_modules, null, 2));
  
  if (data.enabled_modules?.bella_education) {
    console.log('\n✅ bella_education is ENABLED');
  } else {
    console.log('\n❌ bella_education is NOT enabled');
    console.log('Current modules:', Object.keys(data.enabled_modules || {}).filter(k => data.enabled_modules[k]));
  }
}

main();
