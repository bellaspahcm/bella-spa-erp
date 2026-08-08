#!/usr/bin/env node
/**
 * Progressive Rollout Stage 1: Enable 10% Low-Risk Tenants
 * Update phase_a_platform_of_platforms flag with Stage 1 tenant IDs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Stage 1 tenant IDs (first 8 lowest-risk tenants from analysis)
const STAGE_1_TENANT_IDS = [
  '993744e7-6999-4b70-b963-9555e4c2bf33', // Tenant A Leak Test
  '0bc7860e-d617-47fe-9c95-b173323f0a11', // Test Tenant VAT
  '163a951b-6939-43da-8324-c07770d33437', // Test Webhook Tenant
  '4b2d5bd0-bf2b-4d50-a3d6-6c8105eb1170', // Test Tenant Branch Scope
  '7bf44d21-40d0-4b1c-abcf-eb447dea1c83', // Test Tenant Manual Reversal
  'da6e66d0-2dc3-4f21-9323-1d894162438d', // Test Tenant Commission Clawback
  '05c1b40b-6780-4c06-bffb-754815b51102', // Test Concurrent Tenant
  'ee1ffaff-f430-4d1f-9055-15b9cfa8c83a', // Tenant B Leak Test
];

const FLAG_KEY = 'phase_a_platform_of_platforms';

async function enableStage1() {
  console.log('🚀 Progressive Rollout: Stage 1 (10% - 8 tenants)');
  console.log('='.repeat(80));
  console.log(`Feature Flag: ${FLAG_KEY}\n`);

  // Get tenant names for logging
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name')
    .in('id', STAGE_1_TENANT_IDS);

  const tenantMap = new Map(tenants?.map(t => [t.id, t.name]) || []);

  console.log('Stage 1 Tenants:');
  STAGE_1_TENANT_IDS.forEach((id, i) => {
    console.log(`  ${i + 1}. ${tenantMap.get(id) || id}`);
  });
  console.log('');

  // Check if flag exists
  const { data: existingFlag } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('key', FLAG_KEY)
    .maybeSingle();

  if (existingFlag) {
    // Update existing flag
    const currentTenants = existingFlag.rollout_config?.enabledTenants || [];
    const newTenants = [...new Set([...currentTenants, ...STAGE_1_TENANT_IDS])];

    const { error: updateError } = await supabase
      .from('feature_flags')
      .update({
        enabled: true,
        rollout_strategy: 'progressive',
        rollout_config: {
          enabledTenants: newTenants,
          stage: 'stage_1',
          rollout_percentage: 10,
          stage_start: new Date().toISOString(),
        },
        metadata: {
          ...existingFlag.metadata,
          stage_1_tenants: STAGE_1_TENANT_IDS,
          stage_1_enabled_at: new Date().toISOString(),
        },
      })
      .eq('key', FLAG_KEY);

    if (updateError) {
      console.error('❌ Failed to update feature flag:', updateError);
      return;
    }

    console.log(`✅ Feature flag updated successfully`);
    console.log(`   Total enabled tenants: ${newTenants.length}`);
    console.log(`   New in Stage 1: ${STAGE_1_TENANT_IDS.length}`);
  } else {
    // Create new flag
    const { error: insertError } = await supabase
      .from('feature_flags')
      .insert({
        key: FLAG_KEY,
        name: 'Phase A: Platform-of-Platforms',
        description: 'Event Bus architecture with cross-engine communication',
        enabled: true,
        rollout_strategy: 'progressive',
        rollout_config: {
          enabledTenants: STAGE_1_TENANT_IDS,
          stage: 'stage_1',
          rollout_percentage: 10,
          stage_start: new Date().toISOString(),
        },
        metadata: {
          phase: 'Phase A',
          engines: ['BedEngine', 'NursingEngine', 'PharmacyEngine'],
          event_flows: ['BedAllocated→Billing', 'MedicationAdministered→Timeline', 'VitalsRecorded→AIAlerts'],
          stage_1_tenants: STAGE_1_TENANT_IDS,
          stage_1_enabled_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.error('❌ Failed to create feature flag:', insertError);
      return;
    }

    console.log(`✅ Feature flag created successfully`);
    console.log(`   Enabled tenants: ${STAGE_1_TENANT_IDS.length}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎉 STAGE 1 ROLLOUT COMPLETE!');
  console.log('='.repeat(80));
  console.log('\n📊 NEXT STEPS:');
  console.log('1. Monitor metrics for 48 hours');
  console.log('2. Check success criteria:');
  console.log('   ✓ Zero HTTP 500 errors');
  console.log('   ✓ Event Bus latency <50ms (p95)');
  console.log('   ✓ API response <200ms (p95)');
  console.log('   ✓ No user-reported bugs');
  console.log('   ✓ All 3 event flows working');
  console.log('3. If stable → Proceed to Stage 2 (25%)');
  console.log('4. If issues → Execute rollback: node scripts/enable-stage1-tenants.mjs --rollback');
}

// Rollback function (if needed)
async function rollbackStage1() {
  console.log('🔄 ROLLBACK: Disabling Stage 1 tenants...\n');

  const { data: flag } = await supabase
    .from('feature_flags')
    .select('rollout_config')
    .eq('key', FLAG_KEY)
    .single();

  if (!flag) {
    console.log('⚠️  Feature flag not found');
    return;
  }

  const currentTenants = flag.rollout_config?.enabledTenants || [];
  const remainingTenants = currentTenants.filter(id => !STAGE_1_TENANT_IDS.includes(id));

  const { error } = await supabase
    .from('feature_flags')
    .update({
      rollout_config: {
        enabledTenants: remainingTenants,
        stage: remainingTenants.length === 0 ? 'rollback' : 'stage_0',
        rollback_at: new Date().toISOString(),
      },
    })
    .eq('key', FLAG_KEY);

  if (error) {
    console.error('❌ Rollback failed:', error);
    return;
  }

  console.log(`✅ Stage 1 rolled back successfully`);
  console.log(`   Removed: ${STAGE_1_TENANT_IDS.length} tenants`);
  console.log(`   Remaining: ${remainingTenants.length} tenants`);
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--rollback')) {
  rollbackStage1().catch(console.error);
} else {
  enableStage1().catch(console.error);
}
