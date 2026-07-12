/**
 * Decision Engine Health Check Script
 * 
 * Performs comprehensive health check of Decision Engine infrastructure.
 * 
 * Usage:
 *   ts-node scripts/health-check.ts --env=production
 *   npm run health:check -- --env=production
 * 
 * Exit codes:
 *   0 - Healthy
 *   1 - Critical failure (requires immediate attention)
 *   2 - Degraded (some components failing)
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  checks: {
    database: { status: boolean; latency: number; error?: string };
    redis: { status: boolean; latency: number; error?: string };
    providers: { status: boolean; count: number; error?: string };
    rules: { status: boolean; count: number; enabled: number; error?: string };
  };
  overall: {
    healthy: number;
    total: number;
    percentage: number;
  };
}

async function performHealthCheck(): Promise<HealthCheckResult> {
  const env = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'local';
  console.log(`[Health Check] Starting for ${env} environment...`);
  
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: false, latency: 0 },
      redis: { status: false, latency: 0 },
      providers: { status: false, count: 0 },
      rules: { status: false, count: 0, enabled: 0 }
    },
    overall: {
      healthy: 0,
      total: 4,
      percentage: 0
    }
  };
  
  // Check 1: Database
  console.log('[Health Check] Checking database...');
  const dbStart = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('policy_registry')
      .select('count')
      .limit(1)
      .single();
    
    if (error) throw error;
    
    result.checks.database.status = true;
    result.checks.database.latency = Date.now() - dbStart;
    result.overall.healthy++;
    console.log(`  ✅ Database: ${result.checks.database.latency}ms`);
  } catch (error) {
    result.checks.database.error = error instanceof Error ? error.message : String(error);
    result.status = 'critical';
    console.error(`  ❌ Database failed: ${result.checks.database.error}`);
  }
  
  // Check 2: Redis
  console.log('[Health Check] Checking Redis...');
  const redisStart = Date.now();
  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL!, {
      connectTimeout: 5000,
      retryStrategy: () => null
    });
    
    await redis.ping();
    
    result.checks.redis.status = true;
    result.checks.redis.latency = Date.now() - redisStart;
    result.overall.healthy++;
    console.log(`  ✅ Redis: ${result.checks.redis.latency}ms`);
  } catch (error) {
    result.checks.redis.error = error instanceof Error ? error.message : String(error);
    result.status = result.status === 'critical' ? 'critical' : 'degraded';
    console.error(`  ⚠️  Redis failed: ${result.checks.redis.error}`);
  } finally {
    if (redis) await redis.quit();
  }
  
  // Check 3: Providers count
  console.log('[Health Check] Checking providers...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('policy_registry')
      .select('provider')
      .eq('enabled', true);
    
    if (error) throw error;
    
    const providers = new Set(data?.map(r => r.provider) || []);
    result.checks.providers.count = providers.size;
    result.checks.providers.status = providers.size >= 5; // Expect at least 5 providers
    
    if (result.checks.providers.status) {
      result.overall.healthy++;
      console.log(`  ✅ Providers: ${result.checks.providers.count} active`);
    } else {
      result.status = 'degraded';
      console.warn(`  ⚠️  Providers: Only ${result.checks.providers.count} active (expected >= 5)`);
    }
  } catch (error) {
    result.checks.providers.error = error instanceof Error ? error.message : String(error);
    result.status = 'degraded';
    console.error(`  ⚠️  Providers check failed: ${result.checks.providers.error}`);
  }
  
  // Check 4: Rules count
  console.log('[Health Check] Checking rules...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { count: totalCount, error: totalError } = await supabase
      .from('policy_registry')
      .select('*', { count: 'exact', head: true });
    
    const { count: enabledCount, error: enabledError } = await supabase
      .from('policy_registry')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);
    
    if (totalError || enabledError) throw totalError || enabledError;
    
    result.checks.rules.count = totalCount || 0;
    result.checks.rules.enabled = enabledCount || 0;
    result.checks.rules.status = (enabledCount || 0) >= 50; // Expect at least 50 active rules
    
    if (result.checks.rules.status) {
      result.overall.healthy++;
      console.log(`  ✅ Rules: ${result.checks.rules.enabled}/${result.checks.rules.count} enabled`);
    } else {
      result.status = 'degraded';
      console.warn(`  ⚠️  Rules: Only ${result.checks.rules.enabled} enabled (expected >= 50)`);
    }
  } catch (error) {
    result.checks.rules.error = error instanceof Error ? error.message : String(error);
    result.status = 'degraded';
    console.error(`  ⚠️  Rules check failed: ${result.checks.rules.error}`);
  }
  
  // Calculate overall health
  result.overall.percentage = Math.round((result.overall.healthy / result.overall.total) * 100);
  
  console.log('\n[Health Check] Summary:');
  console.log(`  Status: ${result.status.toUpperCase()}`);
  console.log(`  Healthy: ${result.overall.healthy}/${result.overall.total} (${result.overall.percentage}%)`);
  
  return result;
}

// Execute
performHealthCheck()
  .then(result => {
    console.log('\n[Health Check] Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === 'critical') {
      console.error('\n❌ CRITICAL: Decision Engine requires immediate attention!');
      process.exit(1);
    } else if (result.status === 'degraded') {
      console.warn('\n⚠️  DEGRADED: Some components are failing');
      process.exit(2);
    } else {
      console.log('\n✅ HEALTHY: All systems operational');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('[Health Check] Unhandled error:', error);
    process.exit(1);
  });
