/**
 * Gate 3 Metrics API
 * 
 * GET /api/gate3/metrics
 * 
 * Returns aggregated metrics from 72-hour monitoring period
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get monitoring window (last 72 hours)
    const { data: snapshots, error } = await supabase
      .from('gate3_monitoring_snapshots')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch snapshots: ${error.message}`);
    }
    
    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No monitoring data yet',
        metrics: null,
      });
    }
    
    // Calculate metrics
    const totalChecks = snapshots.length;
    const closedCount = snapshots.filter(s => s.circuit_breaker_state === 'CLOSED').length;
    const circuitUptime = (closedCount / totalChecks) * 100;
    
    const maxQueueDepth = Math.max(...snapshots.map(s => s.queue_depth));
    const avgQueueDepth = snapshots.reduce((sum, s) => sum + s.queue_depth, 0) / totalChecks;
    
    const maxDlqSize = Math.max(...snapshots.map(s => s.dlq_size));
    
    const statusCounts = snapshots.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Detect alerts
    const alerts = snapshots.filter(s => 
      s.queue_depth > 100 || 
      s.dlq_size > 10 || 
      s.circuit_breaker_state === 'OPEN'
    );
    
    // Calculate progress
    const startTime = new Date(snapshots[snapshots.length - 1].timestamp).getTime();
    const endTime = startTime + (72 * 60 * 60 * 1000);
    const now = Date.now();
    const progress = Math.min(100, ((now - startTime) / (endTime - startTime)) * 100);
    
    const metrics = {
      monitoringPeriod: {
        startTime: snapshots[snapshots.length - 1].timestamp,
        latestCheck: snapshots[0].timestamp,
        totalChecks,
        expectedChecks: 864, // 72 hours * 12 checks/hour
        progress: progress.toFixed(1) + '%',
      },
      queueMetrics: {
        current: snapshots[0].queue_depth,
        max: maxQueueDepth,
        avg: avgQueueDepth.toFixed(1),
        threshold: 100,
        pass: maxQueueDepth < 100,
      },
      dlqMetrics: {
        current: snapshots[0].dlq_size,
        max: maxDlqSize,
        threshold: 10,
        pass: maxDlqSize < 10,
      },
      circuitBreakerMetrics: {
        currentState: snapshots[0].circuit_breaker_state,
        uptime: circuitUptime.toFixed(1) + '%',
        closedChecks: closedCount,
        totalChecks,
        threshold: '95%',
        pass: circuitUptime >= 95,
      },
      statusDistribution: statusCounts,
      alerts: {
        total: alerts.length,
        percentage: ((alerts.length / totalChecks) * 100).toFixed(1) + '%',
        recent: alerts.slice(0, 5).map(a => ({
          timestamp: a.timestamp,
          queueDepth: a.queue_depth,
          dlqSize: a.dlq_size,
          circuitState: a.circuit_breaker_state,
        })),
      },
      summary: {
        status: circuitUptime >= 95 ? 'PASS' : 'INVESTIGATE',
        message: circuitUptime >= 95 
          ? 'All thresholds met (warnings acceptable)'
          : `Circuit uptime below 95% (${circuitUptime.toFixed(1)}%)`,
      },
    };
    
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('[Gate3 Metrics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
