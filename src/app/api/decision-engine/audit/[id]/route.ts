import { createClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/decision-engine/audit/[id]
 *
 * Returns a single decision_engine_metrics row mapped to the DecisionDetail
 * shape expected by DecisionDetailDrawer component.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the metric row
    const { data: row, error: dbError } = await supabase
      .from('decision_engine_metrics')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError || !row) {
      console.error('[GET /api/decision-engine/audit/:id] Error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Decision record not found' },
        { status: 404 }
      );
    }

    // Verify tenant isolation
    const { data: userProfile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userProfile?.tenant_id && row.tenant_id !== userProfile.tenant_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Build the metadata object
    const rawMeta = (row.metadata ?? {}) as Record<string, unknown>;

    // Map to DecisionDetail shape
    const detail = {
      id:              row.id as string,
      decisionId:      row.id as string,
      decisionType:    row.provider_type as string,
      provider:        row.provider_type as string,
      executionTimeMs: row.execution_time_ms as number,
      status:          (row.success ? 'success' : 'error') as 'success' | 'error' | 'warning',
      tenantId:        row.tenant_id as string,
      userId:          (row.metadata as Record<string, unknown> | null)?.userId as string | undefined,
      confidenceScore: rawMeta.confidence_score as number | undefined,
      createdAt:       row.created_at as string,

      // Input context: booking_id, customer_id, ktv_id plus any metadata
      inputContext: {
        ...(row.booking_id  ? { booking_id: row.booking_id }   : {}),
        ...(row.customer_id ? { customer_id: row.customer_id } : {}),
        ...(row.ktv_id      ? { ktv_id: row.ktv_id }           : {}),
        ...rawMeta,
      },

      // Policies / Rules – not stored separately in metrics table
      policiesExecuted: (rawMeta.policies_executed as string[]) ?? [],
      matchedRules:     (rawMeta.matched_rules as Array<{
        ruleId: string;
        ruleName: string;
        priority: number;
        conditions?: string[];
      }>) ?? [],

      // Output
      output: {
        outcome:                 row.outcome ?? null,
        success:                 row.success,
        was_capacity_skipped:    row.was_capacity_skipped,
        was_conflict_skipped:    row.was_conflict_skipped,
        was_assignment_skipped:  row.was_assignment_skipped,
        ...(rawMeta.output ? rawMeta.output as Record<string, unknown> : {}),
      },

      // Audit log entries if stored in metadata
      auditLog: (rawMeta.audit_log as Array<{
        timestamp: string;
        level: 'info' | 'warn' | 'error';
        message: string;
      }>) ?? [],

      // Tracing fields
      correlationId:   rawMeta.correlation_id as string | undefined,
      traceId:         rawMeta.trace_id       as string | undefined,
      spanId:          rawMeta.span_id        as string | undefined,
      parentSpanId:    rawMeta.parent_span_id as string | undefined,
      versionSnapshot: rawMeta.version_snapshot as Record<string, unknown> | undefined,
      resourceMetrics: rawMeta.resource_metrics as Record<string, unknown> | undefined,
      businessOutcome: rawMeta.business_outcome as Record<string, unknown> | undefined,
      aiMetadata:      rawMeta.ai_metadata     as Record<string, unknown> | undefined,
    };

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error('[GET /api/decision-engine/audit/:id] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
