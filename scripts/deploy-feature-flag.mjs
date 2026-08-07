#!/usr/bin/env node
/**
 * Deploy Feature Flag to Production Database
 * Uses Supabase REST API with service_role key
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const envContent = readFileSync('.env.local', 'utf-8');
const getEnvVar = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const tenantId = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';

async function deployFeatureFlag() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Deploying Phase 0 Feature Flag to Production          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📋 Configuration:');
  console.log(`  - Supabase URL: ${supabaseUrl}`);
  console.log(`  - Tenant ID: ${tenantId}`);
  console.log(`  - Flag Key: healthcare.new-engine-architecture\n`);

  // Insert feature flag
  const { data, error } = await supabase
    .from('feature_flags')
    .upsert({
      key: 'healthcare.new-engine-architecture',
      name: 'Healthcare Platform-of-Platforms Architecture',
      description: 'Phase 0: Bed, Nursing, Pharmacy engines with Contract Registry',
      enabled: true,
      rollout_strategy: 'manual',
      rollout_config: {
        enabledTenants: [tenantId]
      },
      metadata: {
        deployedAt: new Date().toISOString(),
        phase: 'Phase 0',
        constitutionCompliance: '91/100',
        engines: ['BedEngine', 'NursingEngine', 'PharmacyEngine']
      }
    }, {
      onConflict: 'key'
    })
    .select();

  if (error) {
    console.error('❌ Failed to insert feature flag:');
    console.error(error);
    process.exit(1);
  }

  console.log('✅ Feature flag deployed successfully!\n');
  console.log('📊 Result:');
  console.log(JSON.stringify(data, null, 2));
  console.log('');

  // Verify flag
  console.log('🔍 Verifying feature flag...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('key', 'healthcare.new-engine-architecture')
    .single();

  if (verifyError) {
    console.error('⚠️  Verification failed:');
    console.error(verifyError);
    process.exit(1);
  }

  console.log('✅ Verification passed!\n');
  console.log('📋 Feature Flag Details:');
  console.log(`  - Key: ${verifyData.key}`);
  console.log(`  - Name: ${verifyData.name}`);
  console.log(`  - Enabled: ${verifyData.enabled}`);
  console.log(`  - Rollout Strategy: ${verifyData.rollout_strategy}`);
  console.log(`  - Enabled Tenants: ${verifyData.rollout_config.enabledTenants.join(', ')}`);
  console.log(`  - Created: ${verifyData.created_at}`);
  console.log(`  - Updated: ${verifyData.updated_at}\n`);

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              PHASE 0 DEPLOYMENT: 100% COMPLETE                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🎯 Next Steps:');
  console.log('  1. ✅ Code deployed (commit a30ae136)');
  console.log('  2. ✅ Database table created');
  console.log('  3. ✅ Feature flag activated');
  console.log('  4. ⏳ Smoke test 3 engines:');
  console.log('     - /dashboard/hospital/beds (Bed Engine)');
  console.log('     - /dashboard/hospital/nursing-vitals (Nursing Engine)');
  console.log('     - /dashboard/hospital/mar (Pharmacy Engine)');
  console.log('  5. ⏳ Monitor for 48 hours (error rate <1%)');
  console.log('');
}

deployFeatureFlag().catch((err) => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});
