/**
 * Decision Engine Distributed Trace API (Sprint 1)
 * 
 * Get all decisions for a trace ID (OpenTelemetry-style distributed tracing).
 * Used for Distributed Trace Viewer component.
 * 
 * GET /api/decision-engine/trace/[traceId]
 * 
 * @module API/DecisionEngine/Trace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision-engine/trace/[traceId]
 * 
 * Path parameters:
 * - traceId: Trace ID (string, OpenTelemetry format)
 * 
 * Query parameters:
 * - tenantId: Tenant ID (optional, for filtering)
 * 
 * Returns:
 * - traceId: Trace identifier
 * - rootEntity: Root entity of trace (if determinable)
 * - timeline: Array of decisions in chronological order
 * - totalDuration: Sum of all decision execution times
 * - criticalPath: Array of spanIds on critical path (longest chain)
 * 
 * @example
 * ```typescript
 * // Get all decisions in a trace
 * fetch('/api/decision-engine/trace/a1b2c3d4e5f6...?tenantId=xxx')
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { traceId: string } }
) {
  try {
    const supabase = await createClient();
    const { traceId } = params;
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call database function to get decisions by trace
    const { data, error } = await supabase.rpc('get_decisions_by_trace', {
      p_trace_id: traceId,
      p_tenant_id: tenantId || undefined,
    });

    if (error) {
      console.error('[Decision Trace API] Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        traceId,
        timeline: [],
        totalDuration: 0,
        criticalPath: [],
        message: 'No decisions found for this trace ID',
      });
    }

    // Build timeline
    const timeline = data.map((record: any) => ({
      spanId: record.span_id,
      parentSpanId: record.parent_span_id,
      decisionId: record.decision_id,
      decisionType: record.decision_type,
      provider: record.provider,
      timestamp: record.created_at,
      duration: record.execution_time_ms,
      status: record.status,
      summary: generateSummary(record),
    }));

    // Calculate total duration
    const totalDuration = timeline.reduce(
      (sum: number, item: any) => sum + (item.duration || 0),
      0
    );

    // Build span tree to identify critical path
    const criticalPath = calculateCriticalPath(timeline);

    // Try to determine root entity
    const rootEntity = determineRootEntity(data);

    return NextResponse.json({
      success: true,
      traceId,
      rootEntity,
      timeline,
      totalDuration,
      criticalPath,
      stats: {
        totalDecisions: timeline.length,
        successCount: timeline.filter((t: any) => t.status === 'success').length,
        errorCount: timeline.filter((t: any) => t.status === 'error').length,
        warningCount: timeline.filter((t: any) => t.status === 'warning').length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Decision Trace API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate human-readable summary from decision output
 */
function generateSummary(record: any): string {
  const output = record.output || {};

  if (record.status === 'error') {
    return `Error: ${output.error?.message || 'Unknown error'}`;
  }

  if (output.approved) {
    return `${record.decision_type} approved`;
  }

  return `${record.decision_type} ${output.action?.type || 'processed'}`;
}

/**
 * Calculate critical path (longest chain of dependent spans)
 * 
 * Uses parent-child relationships to build dependency tree,
 * then finds the longest path from root to leaf.
 */
function calculateCriticalPath(timeline: any[]): string[] {
  // Build parent-child map
  const children: Record<string, string[]> = {};
  const durations: Record<string, number> = {};

  timeline.forEach((span) => {
    durations[span.spanId] = span.duration || 0;

    if (span.parentSpanId) {
      if (!children[span.parentSpanId]) {
        children[span.parentSpanId] = [];
      }
      children[span.parentSpanId].push(span.spanId);
    }
  });

  // Find root spans (no parent)
  const roots = timeline
    .filter((span) => !span.parentSpanId)
    .map((span) => span.spanId);

  if (roots.length === 0) {
    return [];
  }

  // DFS to find longest path
  function findLongestPath(spanId: string, currentPath: string[]): string[] {
    const newPath = [...currentPath, spanId];
    const childSpans = children[spanId] || [];

    if (childSpans.length === 0) {
      return newPath;
    }

    let longestPath = newPath;
    for (const childSpanId of childSpans) {
      const childPath = findLongestPath(childSpanId, newPath);
      if (childPath.length > longestPath.length) {
        longestPath = childPath;
      }
    }

    return longestPath;
  }

  // Find longest path from all roots
  let criticalPath: string[] = [];
  for (const root of roots) {
    const path = findLongestPath(root, []);
    if (path.length > criticalPath.length) {
      criticalPath = path;
    }
  }

  return criticalPath;
}

/**
 * Determine root entity from trace data
 * 
 * Looks at input_context to find entity type and ID
 */
function determineRootEntity(data: any[]): { type: string; id: string } | null {
  if (!data || data.length === 0) return null;

  // Look at first decision's input context
  const firstDecision = data[0];
  const inputContext = firstDecision.input_context || {};

  // Common entity patterns
  if (inputContext.bookingId) {
    return { type: 'booking', id: inputContext.bookingId };
  }

  if (inputContext.booking_id) {
    return { type: 'booking', id: inputContext.booking_id };
  }

  if (inputContext.payrollRecordId) {
    return { type: 'payroll', id: inputContext.payrollRecordId };
  }

  if (inputContext.procurementOrderId) {
    return { type: 'procurement', id: inputContext.procurementOrderId };
  }

  return null;
}
