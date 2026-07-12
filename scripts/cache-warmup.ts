/**
 * Decision Engine Cache Warmup Script
 * 
 * Preloads critical rules into Redis cache for fast cold-start performance.
 * 
 * Usage:
 *   ts-node scripts/cache-warmup.ts --env=production
 *   npm run cache:warmup -- --env=production
 * 
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - REDIS_URL
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface CacheWarmupStats {
  totalRules: number;
  cached: number;
  failed: number;
  duration: number;
}

async function warmupCache(): Promise<CacheWarmupStats> {
  const startTime = Date.now();
  const env = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'local';
  
  console.log(`[Cache Warmup] Starting for ${env} environment...`);
  console.log(`[Cache Warmup] Target: ${process.env.REDIS_URL?.substring(0, 30)}...`);
  
  // Initialize clients
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const redis = new Redis(process.env.REDIS_URL!, {
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    }
  });
  
  const stats: CacheWarmupStats = {
    totalRules: 0,
    cached: 0,
    failed: 0,
    duration: 0
  };
  
  try {
    // Load all active rules
    const { data: rules, error } = await supabase
      .from('policy_registry')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to load rules: ${error.message}`);
    }
    
    if (!rules || rules.length === 0) {
      console.warn('[Cache Warmup] No active rules found in database');
      return stats;
    }
    
    stats.totalRules = rules.length;
    console.log(`[Cache Warmup] Loading ${rules.length} active rules into cache...`);
    
    // Cache each rule
    for (const rule of rules) {
      try {
        const cacheKey = `decision:rule:${rule.rule_id}`;
        await redis.set(
          cacheKey,
          JSON.stringify(rule),
          'EX',
          3600 // 1 hour TTL
        );
        stats.cached++;
        
        if (stats.cached % 10 === 0) {
          console.log(`[Cache Warmup] Progress: ${stats.cached}/${stats.totalRules} rules cached`);
        }
      } catch (cacheError) {
        console.error(`[Cache Warmup] Failed to cache rule ${rule.rule_id}:`, cacheError);
        stats.failed++;
      }
    }
    
    stats.duration = Date.now() - startTime;
    
    console.log('\n[Cache Warmup] ✅ Complete!');
    console.log(`  Total rules: ${stats.totalRules}`);
    console.log(`  Cached: ${stats.cached}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Duration: ${stats.duration}ms`);
    
    return stats;
    
  } catch (error) {
    console.error('[Cache Warmup] ❌ Fatal error:', error);
    throw error;
  } finally {
    await redis.quit();
  }
}

// Execute
warmupCache()
  .then(stats => {
    process.exit(stats.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('[Cache Warmup] Unhandled error:', error);
    process.exit(1);
  });
