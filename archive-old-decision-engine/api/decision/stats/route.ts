/**
 * Decision Engine Statistics API
 * 
 * Returns aggregated statistics for Decision Engine.
 * Provides high-level overview for dashboards and monitoring.
 * 
 * GET /api/decision/stats
 * 
 * @module API/Decision/Stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector, auditTrail } from '@/lib/decision-engine/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision/stats
 * 
 * Query parameters:
 * - startTime: ISO timestamp (optional, default: last 24 hours)
 * - endTime: ISO timestamp (optional, default: now)
 * - tenantId: Filter by tenant ID (optional)
 * 
 * Returns:
 * - overview: High-level statistics
 * - performance: Performance metrics
 * - decisions: Decision outcome statistics
 * - providers: Per-provider statistics
 * - auditTrail: Audit trail statistics
 * 
 * @example
 * ```typescript
 * // Get dashboard statistics
 * const response = await fetch('/api/decision/stats');
 * const { overview, performance, decisions } = await response.json();
 * 
 * console.log(`Total Decisions: ${overview.totalDecisions}`);
 * console.log(`P95 Latency: ${performance.p95Latency}ms`);
 * console.log(`Auto Approval Rate: ${decisions.autoApprovalRate * 100}%`);
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const startTime = searchParams.get('startTime')
      ? new Date(searchParams.get('startTime')!)
      : new Date(Date.now() - 86400000); // Default: last 24 hours

    const endTime = searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : new Date();

    const tenantId = searchParams.get('tenantId') || undefined;

    // Get metrics
    const metrics = metricsCollector.aggregate({
      startTime,
      endTime,
      tenantId,
    });

    // Get audit trail stats
    const auditStats = auditTrail.getStats();

    // Calculate additional statistics
    const timeRangeHours = (endTime.getTime() - startTime.getTime()) / 3600000;
    const decisionsPerHour = metrics.totalDecisions / timeRangeHours;

    return NextResponse.json({
      success: true,
      query: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        tenantId,
        timeRangeHours: timeRangeHours.toFixed(2),
      },
      overview: {
        totalDecisions: metrics.totalDecisions,
        decisionsPerHour: decisionsPerHour.toFixed(2),
        totalDecisionTypes: Object.keys(auditStats.decisionTypes).length,
        totalProviders: Object.keys(auditStats.providers).length,
        oldestDecision: auditStats.oldestRecord?.toISOString(),
        newestDecision: auditStats.newestRecord?.toISOString(),
      },
      performance: {
        averageExecutionTime: metrics.averageExecutionTime.toFixed(2),
        p50Latency: metrics.p50Latency.toFixed(2),
        p95Latency: metrics.p95Latency.toFixed(2),
        p99Latency: metrics.p99Latency.toFixed(2),
        cacheHitRate: (metrics.cacheHitRate * 100).toFixed(2) + '%',
        errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
        fallbackRate: (metrics.fallbackRate * 100).toFixed(2) + '%',
      },
      decisions: {
        autoApprovalRate: (metrics.autoApprovalRate * 100).toFixed(2) + '%',
        rejectionRate: (metrics.rejectionRate * 100).toFixed(2) + '%',
        manualReviewRate: (metrics.manualReviewRate * 100).toFixed(2) + '%',
        averageConfidence: (metrics.averageConfidence * 100).toFixed(2) + '%',
      },
      providers: Object.entries(metrics.providerMetrics).map(([name, stats]) => ({
        name,
        count: stats.count,
        percentage: ((stats.count / metrics.totalDecisions) * 100).toFixed(2) + '%',
        averageTime: stats.averageTime.toFixed(2) + 'ms',
        p95Time: stats.p95Time.toFixed(2) + 'ms',
      })),
      decisionTypes: Object.entries(auditStats.decisionTypes).map(([type, count]) => ({
        type,
        count,
        percentage: ((count / auditStats.totalRecords) * 100).toFixed(2) + '%',
      })),
      auditTrail: {
        totalRecords: auditStats.totalRecords,
        oldestRecord: auditStats.oldestRecord?.toISOString(),
        newestRecord: auditStats.newestRecord?.toISOString(),
      },
      meta: {
        metricsInMemory: metricsCollector.count(),
        auditRecordsInMemory: auditTrail.count(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Decision Stats API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
