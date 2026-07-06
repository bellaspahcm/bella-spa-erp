/**
 * Decision Engine Metrics API
 * 
 * Returns real-time metrics for Decision Engine performance.
 * Consumed by BI Dashboard and monitoring systems.
 * 
 * GET /api/decision/metrics?startTime=...&endTime=...&decisionType=...&tenantId=...
 * 
 * @module API/Decision/Metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector, type MetricsQuery } from '@/lib/decision-engine/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision/metrics
 * 
 * Query parameters:
 * - startTime: ISO timestamp (optional, default: last hour)
 * - endTime: ISO timestamp (optional, default: now)
 * - decisionType: Filter by decision type (optional)
 * - tenantId: Filter by tenant ID (optional)
 * - limit: Limit results (optional)
 * 
 * Returns:
 * - aggregated: Aggregated metrics for period
 * - raw: Raw metrics (if limit specified)
 * 
 * @example
 * ```typescript
 * // Get metrics for last hour
 * const response = await fetch('/api/decision/metrics');
 * const { aggregated } = await response.json();
 * console.log(`P95 Latency: ${aggregated.p95Latency}ms`);
 * 
 * // Get metrics for specific tenant
 * const response = await fetch('/api/decision/metrics?tenantId=tenant-123');
 * 
 * // Get raw metrics (last 100)
 * const response = await fetch('/api/decision/metrics?limit=100');
 * const { raw } = await response.json();
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const startTime = searchParams.get('startTime')
      ? new Date(searchParams.get('startTime')!)
      : new Date(Date.now() - 3600000); // Default: last hour
    
    const endTime = searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : new Date();

    const decisionType = searchParams.get('decisionType') || undefined;
    const tenantId = searchParams.get('tenantId') || undefined;
    const limit = searchParams.get('limit') 
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;

    const query: MetricsQuery = {
      startTime,
      endTime,
      decisionType,
      tenantId,
      limit,
    };

    // Get aggregated metrics
    const aggregated = metricsCollector.aggregate(query);

    // Get raw metrics if limit specified
    const raw = limit ? metricsCollector.query(query) : undefined;

    return NextResponse.json({
      success: true,
      query: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        decisionType,
        tenantId,
        limit,
      },
      aggregated,
      raw,
      meta: {
        totalRecordsInMemory: metricsCollector.count(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Decision Metrics API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
