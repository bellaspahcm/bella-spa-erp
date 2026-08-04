/**
 * Update Bella Auto Pilot tenant to enable bella_auto module
 * 
 * Usage: npx tsx scripts/update-bella-auto-enabled-modules.ts
 * 
 * This script:
 * 1. Finds the Bella Auto pilot tenant (60b2af9f-82b0-44d3-b0ff-1beabd65258e)
 * 2. Updates enabled_modules to {"bella_auto": true}
 * 3. Verifies the update
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BELLA_AUTO_TENANT_ID = '60b2af9f-82b0-44d3-b0ff-1beabd65258e';

async function main() {
  console.log('🚀 Starting Bella Auto module enablement...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
    process.exit(1);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. Check current tenant state
  console.log('📊 Step 1: Checking current tenant state...');
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select('id, name, enabled_modules')
    .eq('id', BELLA_AUTO_TENANT_ID)
    .single();

  if (fetchError) {
    console.error('❌ Failed to fetch tenant:', fetchError.message);
    process.exit(1);
  }

  if (!tenant) {
    console.error('❌ Tenant not found:', BELLA_AUTO_TENANT_ID);
    process.exit(1);
  }

  console.log('✅ Found tenant:');
  console.log('   - ID:', tenant.id);
  console.log('   - Name:', tenant.name);
  console.log('   - Current enabled_modules:', JSON.stringify(tenant.enabled_modules));
  console.log('');

  // 2. Update enabled_modules
  console.log('🔄 Step 2: Updating enabled_modules to {"bella_auto": true}...');
  const { data: updated, error: updateError } = await supabase
    .from('tenants')
    .update({
      enabled_modules: { bella_auto: true } as any,
    })
    .eq('id', BELLA_AUTO_TENANT_ID)
    .select('id, name, enabled_modules')
    .single();

  if (updateError) {
    console.error('❌ Failed to update tenant:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Update successful!');
  console.log('   - New enabled_modules:', JSON.stringify(updated.enabled_modules));
  console.log('');

  // 3. Verify
  console.log('✔️  Step 3: Verifying update...');
  const { data: verified, error: verifyError } = await supabase
    .from('tenants')
    .select('id, name, enabled_modules')
    .eq('id', BELLA_AUTO_TENANT_ID)
    .single();

  if (verifyError) {
    console.error('⚠️  Verification failed:', verifyError.message);
    process.exit(1);
  }

  if (verified.enabled_modules && typeof verified.enabled_modules === 'object' && 'bella_auto' in verified.enabled_modules) {
    console.log('✅ Verification PASS: bella_auto module is enabled');
    console.log('   - Final state:', JSON.stringify(verified.enabled_modules));
  } else {
    console.error('❌ Verification FAIL: bella_auto module not found in enabled_modules');
    console.error('   - Current state:', JSON.stringify(verified.enabled_modules));
    process.exit(1);
  }

  console.log('');
  console.log('🎉 Bella Auto module enablement complete!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Login with: auto.test@bellaspa.vn');
  console.log('   2. Verify sidebar shows "BELLA AUTO" (not "BELLA SPA PILOT")');
  console.log('   3. Check Ocean Clean theme (cyan/teal colors, not pink/rose)');
  console.log('   4. Test menu navigation (Kho Xe, Xưởng Dịch Vụ, etc.)');
}

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
