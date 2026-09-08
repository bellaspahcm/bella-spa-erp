/**
 * Update Preschool Tenant Settings to enable bella_preschool module
 * 
 * Usage: npx tsx scripts/update-preschool-tenant-settings.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TENANT_ID = 'b5d38901-f9c1-4451-9e16-eaeab35aaeae';

async function main() {
  console.log('🔧 Updating Preschool tenant settings...\n');

  // Update tenants.enabled_modules to enable bella_preschool
  const { data, error } = await supabase
    .from('tenants')
    .update({
      enabled_modules: {
        bella_preschool: true,
        babycare: false,
        beauty_spa: false,
        student_training: false,
        industrial_cleaning: false,
        real_estate: false,
        bella_auto: false,
        bella_healthcare: false,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', TENANT_ID)
    .select();

  if (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }

  console.log('✅ Tenant settings updated:');
  console.log(JSON.stringify(data, null, 2));
}

main();
