/**
 * Gate 3 Monitoring Cron Job
 * 
 * Runs every 5 minutes to collect operational metrics
 * Stores results in database for later analysis
 * 
 * Vercel Cron: Configured in vercel.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Thresholds
const THRESHOLDS = {
  queueDepth: 100,
  dlqSize: 10,
  circuitUptimeMin: 95.0,
};

/**
 * Fetch health endpoint
 */
async function fetchHealthMetrics() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bella-spa-erp.vercel.app';
  const response = await fetch(`${baseUrl}/api/decision-engine/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Store metrics snapshot in database
 */
async function storeMetrics(health: any) {
  const supabase = await createClient();
  
  const snapshot = {
    timestamp: new Date().toISOString(),
    status: health.status,
    queue_depth: health.auditQueue?.pending || 0,
    queue_failed: health.auditQueue?.failed || 0,
    dlq_size: health.auditQueue?.deadLetters || 0,
    circuit_breaker_state: health.auditQueue?.circuitBreaker || 'unknown',
    success_count: health.auditQueue?.successCount || 0,
    failure_count: health.auditQueue?.failureCount || 0,
    raw_health_data: health,
  };
  
  const { error } = await supabase
    .from('gate3_monitoring_snapshots')
    .insert(snapshot);
  
  if (error) {
    console.error('[Gate3 Cron] Failed to store snapshot:', error);
    // Don't throw - we want cron to continue even if DB fails
  }
  
  return snapshot;
}

/**
 * Check thresholds and generate alerts
 */
function checkThresholds(snapshot: any) {
  const alerts = [];
  
  if (snapshot.queue_depth > THRESHOLDS.queueDepth) {
    alerts.push({
      metric: 'queue_depth',
      value: snapshot.queue_depth,
      threshold: THRESHOLDS.queueDepth,
      severity: 'warning',
    });
  }
  
  if (snapshot.dlq_size > THRESHOLDS.dlqSize) {
    alerts.push({
      metric: 'dlq_size',
      value: snapshot.dlq_size,
      threshold: THRESHOLDS.dlqSize,
      severity: 'warning',
    });
  }
  
  if (snapshot.circuit_breaker_state === 'OPEN') {
    alerts.push({
      metric: 'circuit_breaker',
      value: 'OPEN',
      threshold: 'CLOSED',
      severity: 'critical',
    });
  }
  
  return alerts;
}

/**
 * GET handler (for manual trigger or webhook)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel passes this automatically)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[Gate3 Cron] Starting health check...');
    
    // Fetch health metrics
    const health = await fetchHealthMetrics();
    
    // Store in database
    const snapshot = await storeMetrics(health);
    
    // Check thresholds
    const alerts = checkThresholds(snapshot);
    
    console.log('[Gate3 Cron] Health check complete:', {
      status: snapshot.status,
      queueDepth: snapshot.queue_depth,
      circuitState: snapshot.circuit_breaker_state,
      alertsCount: alerts.length,
    });
    
    // Log alerts to console (Vercel logs)
    if (alerts.length > 0) {
      console.warn('[Gate3 Cron] ⚠️  Alerts fired:', alerts);
    }
    
    return NextResponse.json({
      success: true,
      timestamp: snapshot.timestamp,
      snapshot,
      alerts,
    });
  } catch (error) {
    console.error('[Gate3 Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
