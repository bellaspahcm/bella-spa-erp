/**
 * Decision Engine Health Check Endpoint
 * 
 * Production monitoring endpoint for Ops team.
 * 
 * Returns:
 * - Audit logger status
 * - Recent decision metrics
 * - Storage usage
 * - Error rates
 * - Trace coverage
 * 
 * Access: GET /api/decision-engine/health
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Check audit logger health
    const auditHealth = await checkAuditHealth(supabase);

    // 2. Get queue metrics (if using ResilientDecisionAuditLogger)
    const queueMetrics = await getQueueMetrics();

    // 3. Get recent metrics (last 24 hours)
    const metrics = await getRecentMetrics(supabase);

    // 4. Get storage usage
    const storage = await getStorageUsage(supabase);

    // 5. Get trace coverage
    const traceCoverage = await getTraceCoverage(supabase);

    // 6. Check for failures
    const failures = await getRecentFailures(supabase);

    // Overall health status
    const isHealthy = 
      auditHealth.canWrite &&
      metrics.errorRate < 1.0 && // < 1% error rate
      failures.count < 100 && // < 100 failures in last hour
      (!queueMetrics || queueMetrics.status !== 'unhealthy'); // Queue not unhealthy

    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      
      // Decision Engine Status
      decisionEngine: {
        uptime: process.uptime(), // seconds
        version: '1.0.0',
        policyVersion: 'v1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      
      // Audit Logger Status
      audit: {
        enabled: true,
        canWrite: auditHealth.canWrite,
        lastWrite: auditHealth.lastWrite,
        avgWriteMs: auditHealth.avgWriteMs,
      },

      // Queue Metrics (Resilient Logger)
      auditQueue: queueMetrics || {
        status: 'not-available',
        pending: 0,
        processing: 0,
        failed: 0,
        deadLetters: 0,
        retrying: 0,
        successCount: 0,
        failureCount: 0,
        circuitBreaker: 'unknown',
      },

      // Recent Metrics (24h)
      metrics: {
        totalDecisions: metrics.totalDecisions,
        successRate: metrics.successRate,
        errorRate: metrics.errorRate,
        avgExecutionMs: metrics.avgExecutionMs,
        p95ExecutionMs: metrics.p95ExecutionMs,
        p99ExecutionMs: metrics.p99ExecutionMs,
      },

      // Storage
      storage: {
        totalRecords: storage.totalRecords,
        sizeEstimate: storage.sizeEstimate,
        oldestRecord: storage.oldestRecord,
        retentionDays: storage.retentionDays,
      },

      // Tracing
      tracing: {
        coverage: traceCoverage.coverage,
        totalTraces: traceCoverage.totalTraces,
        avgDecisionsPerTrace: traceCoverage.avgDecisionsPerTrace,
      },

      // Failures
      failures: {
        last1Hour: failures.count,
        lastError: failures.lastError,
        errorTypes: failures.errorTypes,
      },

      // Last Activities
      lastActivities: {
        lastDecision: metrics.lastDecision,
        lastReplay: await getLastReplay(supabase),
        lastTrace: await getLastTrace(supabase),
      },
    };

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Get queue metrics from global audit logger instance
 */
async function getQueueMetrics(): Promise<{ status: string; pending: number; [key: string]: any } | null> {
  try {
    // Access global audit logger via registry
    const { auditLoggerRegistry } = await import('@/lib/decision-engine/audit/AuditLoggerRegistry');
    const health = auditLoggerRegistry.getHealth();
    
    if (!health || health.status === 'not-initialized' || health.status === 'error') {
      return {
        status: health?.status || 'not-available',
        pending: 0,
        processing: 0,
        failed: 0,
        deadLetters: 0,
        retrying: 0,
        successCount: 0,
        failureCount: 0,
        circuitBreaker: 'unknown',
      };
    }
    
    // Map health metrics to queue metrics
    const queueMetrics = health.queueMetrics || {};
    const circuitBreaker = health.circuitBreaker || {};
    
    return {
      status: health.status,
      pending: queueMetrics.pending || 0,
      processing: queueMetrics.processing || 0,
      failed: queueMetrics.failed || 0,
      deadLetters: health.dlqSize || 0,
      retrying: queueMetrics.retrying || 0,
      successCount: queueMetrics.successCount || 0,
      failureCount: queueMetrics.failureCount || 0,
      circuitBreaker: circuitBreaker.state || 'unknown',
      circuitBreakerHealthy: circuitBreaker.healthy || false,
    };
  } catch (error) {
    console.error('Failed to get queue metrics:', error);
    return null;
  }
}

/**
 * Check if audit logger can write to database
 */
async function checkAuditHealth(supabase: any) {
  try {
    // Get most recent audit log entry
    const { data, error } = await supabase
      .from('decision_audit_log')
      .select('created_at, execution_time_ms')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return {
        canWrite: false,
        lastWrite: null,
        avgWriteMs: null,
      };
    }

    const lastWrite = data?.[0]?.created_at || null;
    const avgWriteMs = data?.length > 0
      ? data.reduce((sum: number, d: any) => sum + (d.execution_time_ms || 0), 0) / data.length
      : null;

    return {
      canWrite: true,
      lastWrite,
      avgWriteMs: avgWriteMs ? parseFloat(avgWriteMs.toFixed(2)) : null,
    };
  } catch (error) {
    return {
      canWrite: false,
      lastWrite: null,
      avgWriteMs: null,
    };
  }
}

/**
 * Get metrics from last 24 hours
 */
async function getRecentMetrics(supabase: any) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('decision_audit_log')
      .select('status, execution_time_ms, created_at, decision_id')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return {
        totalDecisions: 0,
        successRate: 0,
        errorRate: 0,
        avgExecutionMs: 0,
        p95ExecutionMs: 0,
        p99ExecutionMs: 0,
        lastDecision: null,
      };
    }

    const totalDecisions = data.length;
    const successCount = data.filter((d: any) => d.status === 'success').length;
    const errorCount = data.filter((d: any) => d.status === 'error').length;

    // Execution time percentiles
    const execTimes = data
      .map((d: any) => d.execution_time_ms)
      .filter((t: any) => t != null)
      .sort((a: number, b: number) => a - b);

    const p95Index = Math.floor(execTimes.length * 0.95);
    const p99Index = Math.floor(execTimes.length * 0.99);

    const avgExecutionMs =
      execTimes.length > 0
        ? execTimes.reduce((sum: number, t: number) => sum + t, 0) / execTimes.length
        : 0;

    return {
      totalDecisions,
      successRate: parseFloat(((successCount / totalDecisions) * 100).toFixed(2)),
      errorRate: parseFloat(((errorCount / totalDecisions) * 100).toFixed(2)),
      avgExecutionMs: parseFloat(avgExecutionMs.toFixed(2)),
      p95ExecutionMs: execTimes[p95Index] || 0,
      p99ExecutionMs: execTimes[p99Index] || 0,
      lastDecision: data[0]?.decision_id || null,
    };
  } catch (error) {
    return {
      totalDecisions: 0,
      successRate: 0,
      errorRate: 0,
      avgExecutionMs: 0,
      p95ExecutionMs: 0,
      p99ExecutionMs: 0,
      lastDecision: null,
    };
  }
}

/**
 * Get storage usage estimate
 */
async function getStorageUsage(supabase: any) {
  try {
    // Get total record count
    const { count, error: countError } = await supabase
      .from('decision_audit_log')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return {
        totalRecords: 0,
        sizeEstimate: 'unknown',
        oldestRecord: null,
        retentionDays: null,
      };
    }

    // Get oldest record
    const { data: oldestData } = await supabase
      .from('decision_audit_log')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1);

    const oldestRecord = oldestData?.[0]?.created_at || null;
    
    // Calculate retention days
    const retentionDays = oldestRecord
      ? Math.floor((Date.now() - new Date(oldestRecord).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    // Estimate size (rough: ~2KB per record)
    const estimatedSizeMB = ((count || 0) * 2) / 1024;
    const sizeEstimate =
      estimatedSizeMB > 1024
        ? `${(estimatedSizeMB / 1024).toFixed(2)} GB`
        : `${estimatedSizeMB.toFixed(2)} MB`;

    return {
      totalRecords: count || 0,
      sizeEstimate,
      oldestRecord,
      retentionDays,
    };
  } catch (error) {
    return {
      totalRecords: 0,
      sizeEstimate: 'unknown',
      oldestRecord: null,
      retentionDays: null,
    };
  }
}

/**
 * Get trace coverage (% of decisions with traceId)
 */
async function getTraceCoverage(supabase: any) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Total decisions
    const { count: totalCount } = await supabase
      .from('decision_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    // Decisions with traceId
    const { count: tracedCount } = await supabase
      .from('decision_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
      .not('trace_id', 'is', null);

    // Unique traces
    const { data: traceData } = await supabase
      .from('decision_audit_log')
      .select('trace_id')
      .gte('created_at', oneDayAgo)
      .not('trace_id', 'is', null);

    const uniqueTraces = new Set(traceData?.map((d: any) => d.trace_id) || []).size;

    const coverage = totalCount > 0 ? (tracedCount / totalCount) * 100 : 0;
    const avgDecisionsPerTrace =
      uniqueTraces > 0 ? tracedCount / uniqueTraces : 0;

    return {
      coverage: parseFloat(coverage.toFixed(2)),
      totalTraces: uniqueTraces,
      avgDecisionsPerTrace: parseFloat(avgDecisionsPerTrace.toFixed(2)),
    };
  } catch (error) {
    return {
      coverage: 0,
      totalTraces: 0,
      avgDecisionsPerTrace: 0,
    };
  }
}

/**
 * Get recent failures (last 1 hour)
 */
async function getRecentFailures(supabase: any) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('decision_audit_log')
      .select('decision_type, output, created_at')
      .eq('status', 'error')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return {
        count: 0,
        lastError: null,
        errorTypes: [],
      };
    }

    // Group by decision type
    const errorTypes = data.reduce((acc: any, d: any) => {
      const type = d.decision_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      count: data.length,
      lastError: data[0]?.output?.error || null,
      errorTypes: Object.entries(errorTypes).map(([type, count]) => ({
        type,
        count,
      })),
    };
  } catch (error) {
    return {
      count: 0,
      lastError: null,
      errorTypes: [],
    };
  }
}

/**
 * Get last replay timestamp
 */
async function getLastReplay(supabase: any) {
  try {
    // Note: Replay actions không được log riêng trong Sprint 1
    // Có thể detect via audit_log entries hoặc thêm replay_log table sau
    return null; // TODO: Implement replay tracking
  } catch (error) {
    return null;
  }
}

/**
 * Get last trace timestamp
 */
async function getLastTrace(supabase: any) {
  try {
    const { data } = await supabase
      .from('decision_audit_log')
      .select('created_at')
      .not('trace_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    return data?.[0]?.created_at || null;
  } catch (error) {
    return null;
  }
}
