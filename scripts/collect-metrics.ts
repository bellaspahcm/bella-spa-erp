/**
 * Decision Engine Metrics Collection Script
 * 
 * Collects and aggregates metrics from audit logs into time-series database.
 * Run via cron every 5 minutes.
 * 
 * Usage:
 *   ts-node scripts/collect-metrics.ts
 *   npm run metrics:collect
 * 
 * Vercel Cron:
 *   Add to vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/cron/collect-metrics",
 *       "schedule": "* /5 * * * *"
 *     }]
 *   }
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface ProviderMetrics {
  provider: string;
  count: number;
  totalLatency: number;
  avgLatency: number;
  p95Latency: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  errors: number;
  errorRate: number;
}

async function collectMetrics() {
  console.log('[Metrics] Starting collection...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const redis = new Redis(process.env.REDIS_URL!);
  
  // Aggregate metrics from last 5 minutes
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  console.log(`[Metrics] Collecting data from ${fiveMinutesAgo.toISOString()} to ${now.toISOString()}`);
  
  try {
    const { data: decisions, error } = await supabase
      .from('decision_audit_logs')
      .select('provider, duration_ms, cache_hit, result')
      .gte('created_at', fiveMinutesAgo.toISOString())
      .lt('created_at', now.toISOString());
    
    if (error) throw error;
    
    if (!decisions || decisions.length === 0) {
      console.log('[Metrics] No decisions in last 5 minutes - system may be idle');
      return;
    }
    
    console.log(`[Metrics] Processing ${decisions.length} decisions`);
    
    // Group by provider
    const providerMap = new Map<string, any[]>();
    for (const decision of decisions) {
      if (!providerMap.has(decision.provider)) {
        providerMap.set(decision.provider, []);
      }
      providerMap.get(decision.provider)!.push(decision);
    }
    
    // Calculate metrics per provider
    const metrics: ProviderMetrics[] = [];
    
    for (const [provider, providerDecisions] of providerMap.entries()) {
      const latencies = providerDecisions
        .map(d => d.duration_ms)
        .filter(l => typeof l === 'number')
        .sort((a, b) => a - b);
      
      const cacheHits = providerDecisions.filter(d => d.cache_hit === true).length;
      const cacheMisses = providerDecisions.length - cacheHits;
      
      // Check for errors in result
      const errors = providerDecisions.filter(d => {
        if (typeof d.result === 'string') {
          try {
            const parsed = JSON.parse(d.result);
            return parsed.error || parsed.success === false;
          } catch {
            return false;
          }
        }
        return false;
      }).length;
      
      const p95Index = Math.floor(latencies.length * 0.95);
      
      const providerMetrics: ProviderMetrics = {
        provider,
        count: providerDecisions.length,
        totalLatency: latencies.reduce((sum, l) => sum + l, 0),
        avgLatency: latencies.length > 0 
          ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
          : 0,
        p95Latency: latencies[p95Index] || 0,
        cacheHits,
        cacheMisses,
        cacheHitRate: providerDecisions.length > 0 
          ? cacheHits / providerDecisions.length 
          : 0,
        errors,
        errorRate: providerDecisions.length > 0 
          ? errors / providerDecisions.length 
          : 0
      };
      
      metrics.push(providerMetrics);
    }
    
    // Store metrics in database
    for (const metric of metrics) {
      const { error: insertError } = await supabase
        .from('decision_metrics')
        .insert({
          provider: metric.provider,
          timestamp: now.toISOString(),
          window_minutes: 5,
          total_decisions: metric.count,
          avg_latency_ms: metric.avgLatency,
          p95_latency_ms: metric.p95Latency,
          cache_hit_rate: metric.cacheHitRate,
          error_rate: metric.errorRate
        });
      
      if (insertError) {
        console.error(`[Metrics] Failed to store metrics for ${metric.provider}:`, insertError);
      } else {
        console.log(`[Metrics] ${metric.provider}: ${metric.count} decisions, ${metric.avgLatency.toFixed(2)}ms avg, ${(metric.cacheHitRate * 100).toFixed(1)}% cache hit`);
      }
      
      // Store in Redis for real-time access
      const redisKey = `metrics:${metric.provider}:latest`;
      await redis.set(redisKey, JSON.stringify(metric), 'EX', 600); // 10 min TTL
    }
    
    console.log('[Metrics] ✅ Collection complete');
    
  } catch (error) {
    console.error('[Metrics] ❌ Collection failed:', error);
    throw error;
  } finally {
    await redis.quit();
  }
}

// Execute
collectMetrics()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[Metrics] Unhandled error:', error);
    process.exit(1);
  });
