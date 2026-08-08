#!/usr/bin/env node
/**
 * Query Hospital Tenants and Calculate Risk Categorization
 * For Progressive Rollout Stage Selection
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queryTenantRiskProfile() {
  console.log('🏥 Querying Tenants for Progressive Rollout...\n');

  // Get all active tenants
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, subscription_tier, status, created_at, enabled_modules')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error querying tenants:', error);
    return;
  }

  if (!tenants || tenants.length === 0) {
    console.log('⚠️  No active tenants found');
    return;
  }

  console.log(`Found ${tenants.length} active tenants\n`);
  console.log('='.repeat(100));

  // Calculate risk profile for each tenant
  const tenantProfiles = [];

  for (const tenant of tenants) {
    // Determine business type from enabled_modules
    const modules = tenant.enabled_modules || {};
    const businessType = modules.babycare ? 'Baby Care' : 
                        modules.beauty_spa ? 'Beauty Spa' : 
                        modules.student_training ? 'Training' : 'Unknown';

    // For now, treat all tenants as "hospital-like" businesses with beds/services
    // In real scenario, we'd query specific tables based on business type
    
    // Get bed/room count (for beauty spa: treatment rooms, for baby care: care rooms)
    const { count: bedCount } = await supabase
      .from('hc_beds')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id);

    // Get active users (last 30 days) from audit logs
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('user_id')
      .eq('tenant_id', tenant.id)
      .gte('created_at', thirtyDaysAgo);
    
    const activeUsers = auditLogs ? new Set(auditLogs.map(l => l.user_id)).size : 0;

    // Get booking/session count (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .gte('created_at', sevenDaysAgo);

    const avgDailyBookings = (recentBookings || 0) / 7;

    // Check if dev/test environment
    const isProduction = !/dev|test|staging|demo/i.test(tenant.name);

    // Calculate risk score (0-100)
    let riskScore = 0;
    riskScore += Math.min((bedCount || 0) / 5, 30); // 0-30 points (adjusted for smaller spas)
    riskScore += Math.min(activeUsers / 10, 20); // 0-20 points (spas have fewer users)
    riskScore += Math.min(avgDailyBookings / 5, 20); // 0-20 points (booking volume)
    riskScore += isProduction ? 20 : 0; // 0-20 points (production weight)
    
    // Subscription tier weight (premium = higher risk)
    if (tenant.subscription_tier === 'premium' || tenant.subscription_tier === 'enterprise') {
      riskScore += 10;
    }

    // Determine risk category
    let riskCategory = 'medium';
    if (!isProduction || ((bedCount || 0) < 5 && activeUsers < 10 && avgDailyBookings < 2)) {
      riskCategory = 'low';
    } else if ((bedCount || 0) > 20 || activeUsers > 50 || avgDailyBookings > 20) {
      riskCategory = 'high';
    }

    // Check if already enabled
    const { data: flagData } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('tenant_id', tenant.id)
      .eq('flag_key', 'phase_a_platform_of_platforms')
      .maybeSingle();

    const alreadyEnabled = flagData?.enabled || false;

    tenantProfiles.push({
      ...tenant,
      businessType,
      bedCount: bedCount || 0,
      activeUsers,
      avgDailyBookings: Math.round(avgDailyBookings * 10) / 10,
      isProduction,
      riskScore: Math.round(riskScore),
      riskCategory,
      alreadyEnabled,
    });
  }

  // Sort by risk score (lowest first)
  tenantProfiles.sort((a, b) => a.riskScore - b.riskScore);

  // Display results
  console.log('\nTenant Risk Profile:');
  console.log('='.repeat(100));
  
  tenantProfiles.forEach((t, i) => {
    const icon = t.riskCategory === 'low' ? '🟢' : t.riskCategory === 'medium' ? '🟡' : '🔴';
    const status = t.alreadyEnabled ? '✅ ENABLED' : '⏸️  Not enabled';
    
    console.log(`${i + 1}. ${icon} ${t.name} (${status})`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Type: ${t.businessType} | Tier: ${t.subscription_tier}`);
    console.log(`   Risk: ${t.riskCategory.toUpperCase()} (Score: ${t.riskScore}/100)`);
    console.log(`   Rooms/Beds: ${t.bedCount}, Users: ${t.activeUsers}, Avg Daily Bookings: ${t.avgDailyBookings}`);
    console.log(`   Production: ${t.isProduction ? 'Yes' : 'No (dev/test)'}`);
    console.log('');
  });

  // Summary statistics
  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY STATISTICS:');
  console.log('='.repeat(100));

  const summary = {
    low: tenantProfiles.filter(t => t.riskCategory === 'low'),
    medium: tenantProfiles.filter(t => t.riskCategory === 'medium'),
    high: tenantProfiles.filter(t => t.riskCategory === 'high'),
  };

  const alreadyEnabledCount = tenantProfiles.filter(t => t.alreadyEnabled).length;

  console.log(`🟢 Low Risk:    ${summary.low.length} tenants (${((summary.low.length / tenantProfiles.length) * 100).toFixed(1)}%)`);
  console.log(`🟡 Medium Risk: ${summary.medium.length} tenants (${((summary.medium.length / tenantProfiles.length) * 100).toFixed(1)}%)`);
  console.log(`🔴 High Risk:   ${summary.high.length} tenants (${((summary.high.length / tenantProfiles.length) * 100).toFixed(1)}%)`);
  console.log(`\nAlready Enabled: ${alreadyEnabledCount}/${tenantProfiles.length} tenants`);

  // Stage recommendations
  console.log('\n' + '='.repeat(100));
  console.log('ROLLOUT STAGE RECOMMENDATIONS:');
  console.log('='.repeat(100));

  const stage1Count = Math.ceil(tenantProfiles.length * 0.10);
  const stage2Count = Math.ceil(tenantProfiles.length * 0.25);
  const stage3Count = Math.ceil(tenantProfiles.length * 0.50);

  const stage1Tenants = tenantProfiles.slice(0, stage1Count).filter(t => !t.alreadyEnabled);
  const stage2Tenants = tenantProfiles.slice(stage1Count, stage2Count).filter(t => !t.alreadyEnabled);
  const stage3Tenants = tenantProfiles.slice(stage2Count, stage3Count).filter(t => !t.alreadyEnabled);
  const stage4Tenants = tenantProfiles.slice(stage3Count).filter(t => !t.alreadyEnabled);

  console.log(`\nStage 1 (10%): ${stage1Tenants.length} tenants`);
  stage1Tenants.forEach(t => console.log(`  - ${t.name} (${t.riskCategory})`));

  console.log(`\nStage 2 (25%): ${stage2Tenants.length} tenants`);
  stage2Tenants.forEach(t => console.log(`  - ${t.name} (${t.riskCategory})`));

  console.log(`\nStage 3 (50%): ${stage3Tenants.length} tenants`);
  stage3Tenants.forEach(t => console.log(`  - ${t.name} (${t.riskCategory})`));

  console.log(`\nStage 4 (100%): ${stage4Tenants.length} tenants`);
  stage4Tenants.forEach(t => console.log(`  - ${t.name} (${t.riskCategory})`));

  console.log('\n' + '='.repeat(100));
  console.log('✅ Query complete!\n');
}

queryTenantRiskProfile().catch(console.error);
