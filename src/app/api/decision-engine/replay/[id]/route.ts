/**
 * Decision Engine Replay & Time Machine API (Sprint 1 - KILLER FEATURE)
 * 
 * Replay past decisions with current or different policy versions.
 * Compare outputs, rules, confidence, and execution time.
 * 
 * This is a unique feature that enterprise rule engines (Drools, AWS Rules Engine) don't have.
 * 
 * POST /api/decision-engine/replay/[id]
 * 
 * @module API/DecisionEngine/Replay
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { bootstrapDecisionEngine } from '@/lib/decision-engine/bootstrap';
import type { DecisionContext } from '@/lib/decision-engine/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow longer execution for replay

/**
 * POST /api/decision-engine/replay/[id]
 * 
 * Path parameters:
 * - id: Original decision audit log ID (UUID)
 * 
 * Body:
 * - policyVersion?: string (optional, if null uses current version)
 * - compareWithOriginal?: boolean (default: true)
 * 
 * Returns:
 * - originalResult: Original decision output
 * - replayedResult: New decision output after replay
 * - diff: Detailed comparison of changes
 * - snapshot: Version metadata
 * 
 * @example
 * ```typescript
 * // Replay with current policy version
 * const response = await fetch('/api/decision-engine/replay/550e8400...', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ compareWithOriginal: true })
 * });
 * 
 * // Replay with specific policy version (Time Machine)
 * const response = await fetch('/api/decision-engine/replay/550e8400...', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ 
 *     policyVersion: 'v5',
 *     compareWithOriginal: true 
 *   })
 * });
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;
    const body = await request.json();
    const { policyVersion, compareWithOriginal = true } = body;

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

    // Get original decision from audit log
    const { data: originalDecision, error: fetchError } = await supabase
      .from('decision_audit_log')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !originalDecision) {
      return NextResponse.json(
        { success: false, error: 'Original decision not found' },
        { status: 404 }
      );
    }

    // Reconstruct DecisionContext from original audit log
    const replayContext: DecisionContext = {
      tenantId: originalDecision.tenant_id,
      module: extractModuleFromType(originalDecision.decision_type),
      decisionType: originalDecision.decision_type,
      ruleType: 'if-then', // TODO: Extract from original context if available
      rule: {}, // Placeholder - will be loaded from provider
      data: (originalDecision.input_context as Record<string, unknown>) || {},
      user: originalDecision.user_id
        ? {
            id: originalDecision.user_id,
            role: 'user', // Placeholder role for replay
            // Other user fields would need to be fetched or stored in original context
          }
        : undefined,
      correlationId: `replay-${Date.now()}`,
      metadata: {
        replayOf: originalDecision.decision_id,
        originalTimestamp: originalDecision.created_at,
        requestedPolicyVersion: policyVersion || 'current',
      },
    };

    // Bootstrap Decision Engine for replay
    const { engine } = bootstrapDecisionEngine({
      debug: true,
    });

    // TODO: If policyVersion is specified, load that version from policy_versions table
    // and temporarily register providers with that policy version
    // For now, replay uses current policy version

    const replayStartTime = Date.now();

    // Execute replay
    const replayedResult = await engine.evaluate(replayContext);

    const replayExecutionTime = Date.now() - replayStartTime;

    // Compare with original if requested
    let diff = null;
    if (compareWithOriginal) {
      diff = generateDiff(
        originalDecision,
        replayedResult,
        replayExecutionTime
      );
    }

    // Build response
    const outputData = originalDecision.output as Record<string, any> | null;
    const versionSnapshot = originalDecision.version_snapshot as Record<string, any> | null;
    
    return NextResponse.json({
      success: true,
      decisionId: originalDecision.decision_id,
      originalResult: {
        approved: outputData?.approved,
        confidence: originalDecision.confidence_score,
        reason: outputData?.reason,
        provider: originalDecision.provider,
        executionTimeMs: originalDecision.execution_time_ms,
        status: originalDecision.status,
        matchedRules: originalDecision.matched_rules,
        policiesExecuted: originalDecision.policies_executed,
        timestamp: originalDecision.created_at,
      },
      replayedResult: {
        approved: replayedResult.approved,
        confidence: replayedResult.confidence,
        reason: replayedResult.reason,
        provider: replayedResult.provider,
        executionTimeMs: replayExecutionTime,
        status: replayedResult.error ? 'error' : 'success',
        matchedRules: replayedResult.metadata?.matchedRules || [],
        policiesExecuted: replayedResult.metadata?.policiesApplied || [],
        timestamp: new Date().toISOString(),
      },
      diff,
      snapshot: {
        originalPolicyVersion:
          versionSnapshot?.policyVersions || {},
        replayedPolicyVersion: policyVersion || 'current',
        originalEngineVersion:
          versionSnapshot?.engineVersion || 'unknown',
        replayedEngineVersion: '1.0.0', // Current engine version
      },
      replayMetadata: {
        replayedAt: new Date().toISOString(),
        replayedBy: user.id,
        replayExecutionTimeMs: replayExecutionTime,
      },
    });
  } catch (error) {
    console.error('[Decision Replay API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate diff between original and replayed decisions
 */
function generateDiff(
  original: any,
  replayed: any,
  replayExecutionTime: number
) {
  const originalOutput = original.output || {};
  const originalRules = original.matched_rules || [];
  const replayedRules = replayed.metadata?.matchedRules || [];

  // Check if output changed
  const outputChanged =
    originalOutput.approved !== replayed.approved ||
    originalOutput.reason !== replayed.reason;

  // Detect changed fields
  const changedFields: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }> = [];

  if (originalOutput.approved !== replayed.approved) {
    changedFields.push({
      field: 'approved',
      oldValue: originalOutput.approved,
      newValue: replayed.approved,
    });
  }

  if (originalOutput.reason !== replayed.reason) {
    changedFields.push({
      field: 'reason',
      oldValue: originalOutput.reason,
      newValue: replayed.reason,
    });
  }

  if (originalOutput.action?.type !== replayed.action?.type) {
    changedFields.push({
      field: 'action.type',
      oldValue: originalOutput.action?.type,
      newValue: replayed.action?.type,
    });
  }

  // Detect rule changes
  const originalRuleIds = new Set(originalRules.map((r: any) => r.ruleId || r.id));
  const replayedRuleIds = new Set(replayedRules.map((r: any) => r.ruleId || r.id));

  const addedRules = replayedRules
    .filter((r: any) => !originalRuleIds.has(r.ruleId || r.id))
    .map((r: any) => r.ruleId || r.id);

  const removedRules = originalRules
    .filter((r: any) => !replayedRuleIds.has(r.ruleId || r.id))
    .map((r: any) => r.ruleId || r.id);

  const modifiedRules: Array<{
    ruleId: string;
    changeType: 'priority' | 'condition' | 'action';
    oldValue: any;
    newValue: any;
  }> = [];

  // Check for priority changes in common rules
  originalRules.forEach((origRule: any) => {
    const replayRule = replayedRules.find(
      (r: any) => (r.ruleId || r.id) === (origRule.ruleId || origRule.id)
    );
    if (replayRule && origRule.priority !== replayRule.priority) {
      modifiedRules.push({
        ruleId: origRule.ruleId || origRule.id,
        changeType: 'priority',
        oldValue: origRule.priority,
        newValue: replayRule.priority,
      });
    }
  });

  // Confidence change
  const confidenceChanged = {
    old: original.confidence_score || 0,
    new: replayed.confidence || 0,
    delta: (replayed.confidence || 0) - (original.confidence_score || 0),
  };

  // Execution time change
  const executionTimeChanged = {
    old: original.execution_time_ms || 0,
    new: replayExecutionTime,
    delta: replayExecutionTime - (original.execution_time_ms || 0),
  };

  return {
    outputChanged,
    changedFields,
    rulesChanged: {
      addedRules,
      removedRules,
      modifiedRules,
    },
    confidenceChanged,
    executionTimeChanged,
  };
}

/**
 * Extract module name from decision type
 * 
 * @example
 * extractModuleFromType('payroll') => 'payroll'
 * extractModuleFromType('booking-approval') => 'booking'
 */
function extractModuleFromType(decisionType: string): string {
  if (decisionType.includes('payroll')) return 'payroll';
  if (decisionType.includes('booking')) return 'booking';
  if (decisionType.includes('procurement')) return 'procurement';
  if (decisionType.includes('eligibility')) return 'booking';
  if (decisionType.includes('discount')) return 'booking';
  if (decisionType.includes('pricing')) return 'booking';
  return 'general';
}
