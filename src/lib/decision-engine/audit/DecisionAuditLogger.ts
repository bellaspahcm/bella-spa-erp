/**
 * Decision Audit Logger
 * Sprint 1: Core Evidence Console - Audit Persistence
 * 
 * Persists decision executions to decision_audit_log table for:
 * - Audit trail & compliance
 * - Decision replay & Time Machine
 * - Distributed tracing
 * - Resource cost tracking
 * - Business outcome analysis
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { DecisionContext, DecisionResult } from '../types';

/**
 * Correlation context for distributed tracing
 */
export interface CorrelationContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}

/**
 * Version snapshot for Time Machine replay
 */
export interface VersionSnapshot {
  engineVersion: string;
  policyVersions: Record<string, string>;
  ruleVersions: Record<string, string>;
  providerVersions: Record<string, string>;
}

/**
 * Resource metrics for cost tracking
 */
export interface ResourceMetrics {
  cpuTimeMs?: number;
  memoryUsedMB?: number;
  dbQueries?: {
    count: number;
    totalTimeMs: number;
    queries: Array<{ query: string; timeMs: number }>;
  };
  remoteApiCalls?: {
    count: number;
    totalTimeMs: number;
    calls: Array<{ endpoint: string; timeMs: number; statusCode: number }>;
  };
  cacheHits?: number;
  cacheMisses?: number;
}

/**
 * Business outcome tracking
 */
export interface BusinessOutcome {
  outcomeType: 'approved' | 'rejected' | 'modified' | 'info';
  revenueImpact?: number;
  costImpact?: number;
  timeImpact?: number;
}

/**
 * AI metadata for AI provider decisions
 */
export interface AIMetadata {
  provider: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  reasoning?: string;
  confidence?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  fallbackUsed?: boolean;
}

/**
 * Complete audit log entry
 */
export interface AuditLogEntry {
  decisionId: string;
  decisionType: string;
  provider: string;
  executionTimeMs: number;
  status: 'success' | 'error' | 'warning';
  inputContext: Record<string, any>;
  policiesExecuted: string[];
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    priority: number;
    conditions?: string[];
  }>;
  output: Record<string, any>;
  auditLog: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
  tenantId: string;
  userId?: string;
  confidenceScore?: number;
  correlation?: CorrelationContext;
  versionSnapshot?: VersionSnapshot;
  resourceMetrics?: ResourceMetrics;
  businessOutcome?: BusinessOutcome;
  aiMetadata?: AIMetadata;
}

/**
 * Decision Audit Logger
 * 
 * Responsibilities:
 * 1. Persist decision executions to database
 * 2. Capture version snapshots for replay
 * 3. Track correlation for distributed tracing
 * 4. Record resource metrics for cost analysis
 * 5. Store business outcomes for KPI tracking
 */
export class DecisionAuditLogger {
  private readonly supabase: SupabaseClient<Database>;
  private readonly engineVersion: string;

  constructor(
    supabase: SupabaseClient<Database>,
    engineVersion: string = '1.0.0'
  ) {
    this.supabase = supabase;
    this.engineVersion = engineVersion;
  }

  /**
   * Log decision execution to audit trail
   * 
   * @param context - Decision context
   * @param result - Decision result
   * @param options - Additional audit options
   */
  async logDecision(
    context: DecisionContext,
    result: DecisionResult,
    options?: {
      correlation?: CorrelationContext;
      versionSnapshot?: VersionSnapshot;
      resourceMetrics?: ResourceMetrics;
      businessOutcome?: BusinessOutcome;
      aiMetadata?: AIMetadata;
    }
  ): Promise<void> {
    try {
      // Generate decision ID if not present
      const decisionId = result.metadata?.decisionId || this.generateDecisionId();

      // Determine status
      const status = this.determineStatus(result);

      // Extract policies and rules from result
      const policiesExecuted = result.metadata?.policiesApplied || [];
      const matchedRules = result.metadata?.matchedRules || [];

      // Build audit log from result warnings/errors
      const auditLog = this.buildAuditLog(result);

      // Build version snapshot
      const versionSnapshot = options?.versionSnapshot || this.buildVersionSnapshot(result);

      // Insert into decision_audit_log table
      const insertData: any = {
        decision_id: decisionId,
        decision_type: context.decisionType,
        provider: result.provider,
        execution_time_ms: result.executionTime,
        status,
        input_context: context.data || {},
        policies_executed: policiesExecuted,
        matched_rules: matchedRules,
        output: this.sanitizeOutput(result),
        audit_log: auditLog,
        tenant_id: context.tenantId,
        user_id: context.user?.id || null,
        confidence_score: result.confidence,
        correlation_id: options?.correlation?.correlationId || context.correlationId || null,
        trace_id: options?.correlation?.traceId || null,
        span_id: options?.correlation?.spanId || null,
        parent_span_id: options?.correlation?.parentSpanId || null,
        version_snapshot: versionSnapshot,
        resource_metrics: options?.resourceMetrics || {},
        business_outcome: options?.businessOutcome || {},
        ai_metadata: options?.aiMetadata || {},
      };
      
      const { error } = await this.supabase
        .from('decision_audit_log')
        .insert(insertData);

      if (error) {
        // Log error but don't throw (audit logging failure shouldn't break decision flow)
        console.error('[DecisionAuditLogger] Failed to log decision:', error);
      }
    } catch (error) {
      // Graceful degradation - log to console but don't throw
      console.error('[DecisionAuditLogger] Exception during audit logging:', error);
    }
  }

  /**
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `decision-${timestamp}-${random}`;
  }

  /**
   * Determine status from result
   */
  private determineStatus(result: DecisionResult): 'success' | 'error' | 'warning' {
    if (result.error) {
      return 'error';
    }
    const warnings = result.metadata?.warnings as any[];
    if (warnings && Array.isArray(warnings) && warnings.length > 0) {
      return 'warning';
    }
    return 'success';
  }

  /**
   * Build audit log from result
   */
  private buildAuditLog(
    result: DecisionResult
  ): Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> {
    const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> =
      [];

    // Add success log
    logs.push({
      timestamp: result.timestamp.toISOString(),
      level: 'info',
      message: `Decision evaluated by provider ${result.provider}`,
    });

    // Add warnings
    if (result.metadata?.warnings) {
      const warnings = result.metadata.warnings as any[];
      if (Array.isArray(warnings)) {
        for (const warning of warnings) {
          logs.push({
            timestamp: result.timestamp.toISOString(),
            level: 'warn',
            message: warning,
          });
        }
      }
    }

    // Add error
    if (result.error) {
      logs.push({
        timestamp: result.timestamp.toISOString(),
        level: 'error',
        message: result.error.message || 'Decision evaluation failed',
      });
    }

    return logs;
  }

  /**
   * Build version snapshot (MANDATORY for Time Machine replay)
   * 
   * This ensures every decision can be replayed with the exact
   * policy/rule versions that produced the original result.
   */
  private buildVersionSnapshot(result: DecisionResult): VersionSnapshot {
    return {
      engineVersion: this.engineVersion,
      policyVersions: (result.metadata?.policyVersions as Record<string, string>) || {
        // Default to policy ID if not provided by provider
        'default': '1.0.0'
      },
      ruleVersions: (result.metadata?.ruleVersions as Record<string, string>) || {},
      providerVersions: {
        [result.provider]: ((result.metadata?.providerVersion as any) || '1.0.0') as string,
      },
    };
  }

  /**
   * Sanitize output (remove sensitive data)
   */
  private sanitizeOutput(result: DecisionResult): Record<string, any> {
    return {
      approved: result.approved,
      confidence: result.confidence,
      reason: result.reason,
      action: result.action,
      recommendations: result.recommendations,
      provider: result.provider,
      executionTime: result.executionTime,
      isFallback: result.isFallback,
      error: result.error
        ? {
            code: result.error.code,
            message: result.error.message,
          }
        : undefined,
    };
  }

  /**
   * Save policy version snapshot
   * 
   * Call this when policy is updated to save version history
   */
  async savePolicyVersion(
    policyId: string,
    version: string,
    definition: Record<string, any>,
    changelog?: string,
    createdBy?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('policy_versions').insert({
        policy_id: policyId,
        version,
        definition,
        changelog: changelog || null,
        created_by: createdBy || null,
      });

      if (error) {
        console.error('[DecisionAuditLogger] Failed to save policy version:', error);
      }
    } catch (error) {
      console.error('[DecisionAuditLogger] Exception saving policy version:', error);
    }
  }

  /**
   * Get policy version for replay
   */
  async getPolicyVersion(
    policyId: string,
    version: string
  ): Promise<Record<string, any> | null> {
    try {
      const { data, error } = await this.supabase
        .from('policy_versions')
        .select('definition')
        .eq('policy_id', policyId)
        .eq('version', version)
        .single();

      if (error) {
        console.error('[DecisionAuditLogger] Failed to get policy version:', error);
        return null;
      }

      return (data?.definition as Record<string, any>) || null;
    } catch (error) {
      console.error('[DecisionAuditLogger] Exception getting policy version:', error);
      return null;
    }
  }
}

/**
 * Helper: Generate trace ID (OpenTelemetry-style)
 */
export function generateTraceId(): string {
  // 16-byte hex string (32 characters)
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Helper: Generate span ID (OpenTelemetry-style)
 */
export function generateSpanId(): string {
  // 8-byte hex string (16 characters)
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}
