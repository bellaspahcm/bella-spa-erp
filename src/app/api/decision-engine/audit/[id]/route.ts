/**
 * Decision Engine Audit Detail API (Sprint 1)
 * 
 * Get full decision detail by ID for Decision Detail Drawer.
 * 
 * GET /api/decision-engine/audit/[id]
 * 
 * @module API/DecisionEngine/AuditDetail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision-engine/audit/[id]
 * 
 * Path parameters:
 * - id: Audit log entry ID (UUID)
 * 
 * Returns:
 * - Full decision audit log entry with all metadata
 * 
 * @example
 * ```typescript
 * fetch('/api/decision-engine/audit/550e8400-e29b-41d4-a716-446655440000')
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

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

    // Get decision detail
    const { data, error } = await supabase
      .from('decision_audit_log')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json(
          { success: false, error: 'Decision not found' },
          { status: 404 }
        );
      }

      console.error('[Decision Audit Detail API] Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Format response
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        decisionId: data.decision_id,
        decisionType: data.decision_type,
        provider: data.provider,
        executionTimeMs: data.execution_time_ms,
        status: data.status,
        inputContext: data.input_context,
        policiesExecuted: data.policies_executed,
        matchedRules: data.matched_rules,
        output: data.output,
        auditLog: data.audit_log,
        tenantId: data.tenant_id,
        userId: data.user_id,
        confidenceScore: data.confidence_score,
        // Sprint 1 additions
        correlationId: data.correlation_id,
        traceId: data.trace_id,
        spanId: data.span_id,
        parentSpanId: data.parent_span_id,
        versionSnapshot: data.version_snapshot,
        resourceMetrics: data.resource_metrics,
        businessOutcome: data.business_outcome,
        aiMetadata: data.ai_metadata,
        createdAt: data.created_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Decision Audit Detail API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
