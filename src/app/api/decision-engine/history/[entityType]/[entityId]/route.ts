/**
 * Decision Engine History Timeline API (Sprint 1)
 * 
 * Get decision history for an entity (e.g., all decisions for booking_123).
 * Used for Decision History Timeline component.
 * 
 * GET /api/decision-engine/history/[entityType]/[entityId]
 * 
 * @module API/DecisionEngine/History
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision-engine/history/[entityType]/[entityId]
 * 
 * Path parameters:
 * - entityType: Entity type (e.g., 'booking', 'payroll', 'procurement')
 * - entityId: Entity ID (e.g., 'booking_123')
 * 
 * Query parameters:
 * - tenantId: Tenant ID (required)
 * 
 * Returns:
 * - timeline: Array of decisions chronologically ordered
 * 
 * @example
 * ```typescript
 * // Get all decisions for booking_123
 * fetch('/api/decision-engine/history/booking/booking_123?tenantId=xxx')
 * 
 * // Get all decisions for payroll_record_456
 * fetch('/api/decision-engine/history/payroll/payroll_456?tenantId=xxx')
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { entityType: string; entityId: string } }
) {
  try {
    const supabase = await createClient();
    const { entityType, entityId } = params;
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

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Call database function to get decision history
    const { data, error } = await supabase.rpc('get_decision_history_for_entity', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('[Decision History API] Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Format timeline
    const timeline = (data || []).map((record: any) => ({
      id: record.id,
      decisionId: record.decision_id,
      decisionType: record.decision_type,
      provider: record.provider,
      executionTimeMs: record.execution_time_ms,
      status: record.status,
      summary: generateSummary(record),
      outcomeType: determineOutcomeType(record),
      timestamp: record.created_at,
      output: record.output,
      confidenceScore: record.confidence_score,
    }));

    return NextResponse.json({
      success: true,
      entityType,
      entityId,
      tenantId,
      timeline,
      totalDecisions: timeline.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Decision History API] Unexpected error:', error);
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
    return `${record.decision_type} approved${output.reason ? ` - ${output.reason}` : ''}`;
  }

  return `${record.decision_type} ${output.action?.type || 'processed'}${output.reason ? ` - ${output.reason}` : ''}`;
}

/**
 * Determine outcome type for visual representation
 */
function determineOutcomeType(record: any): 'approved' | 'rejected' | 'modified' | 'info' {
  const output = record.output || {};

  if (record.status === 'error') {
    return 'rejected';
  }

  if (output.approved === true) {
    return 'approved';
  }

  if (output.approved === false) {
    return 'rejected';
  }

  if (output.action?.type === 'MANUAL_REVIEW' || output.action?.type === 'MODIFY') {
    return 'modified';
  }

  return 'info';
}
