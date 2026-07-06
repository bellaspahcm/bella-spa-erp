/**
 * PolicyStatisticsService - Decision Statistics Management
 * 
 * Uses atomic Postgres function to prevent race conditions
 */

import { createClient } from '@/lib/supabase/server';
import type { PolicyStatistics, DecisionOutcome } from './types';
import { PolicyNotFoundError } from './types';

export class PolicyStatisticsService {
  /**
   * Record a decision (atomic - no race condition)
   */
  static async recordDecision(
    policyId: string,
    version: string,
    outcome: DecisionOutcome,
    confidence?: number,
    latencyMs?: number
  ): Promise<void> {
    const supabase = await createClient();

    try {
      // Call atomic Postgres function
      const { error } = await supabase.rpc('increment_policy_statistics', {
        p_policy_id: policyId,
        p_version: version,
        p_outcome: outcome,
        p_confidence: confidence || null,
        p_latency_ms: latencyMs || null,
      });

      if (error) {
        // Don't throw - stats failure shouldn't block decisions
        console.error(
          `Failed to record decision for policy ${policyId} v${version}:`,
          error
        );
      }
    } catch (error) {
      // Silently log error - stats are non-critical
      console.error(
        `Exception recording decision for policy ${policyId} v${version}:`,
        error
      );
    }
  }

  /**
   * Get statistics for a specific policy version
   */
  static async getStatistics(
    policyId: string,
    version?: string
  ): Promise<PolicyStatistics | null> {
    const supabase = await createClient();

    try {
      // Call Postgres function that calculates derived fields
      const { data, error } = await supabase.rpc('get_policy_statistics', {
        p_policy_id: policyId,
        p_version: version || null,
      });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      return mapDbToStatistics(data[0]);
    } catch (error) {
      console.error(
        `Failed to get statistics for policy ${policyId} v${version}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get aggregated statistics across all versions
   */
  static async getAggregatedStatistics(policyId: string): Promise<PolicyStatistics | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_statistics')
      .select('*')
      .eq('policy_id', policyId);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Aggregate across all versions
    const aggregated = data.reduce(
      (acc, row) => ({
        policyId,
        version: 'all',
        totalDecisions: acc.totalDecisions + (row.total_decisions || 0),
        totalApprovals: acc.totalApprovals + (row.total_approvals || 0),
        totalRejections: acc.totalRejections + (row.total_rejections || 0),
        confidenceSum: acc.confidenceSum + (row.confidence_sum || 0),
        confidenceCount: acc.confidenceCount + (row.confidence_count || 0),
        lastDecisionAt:
          !acc.lastDecisionAt || (row.last_decision_at && row.last_decision_at > acc.lastDecisionAt)
            ? row.last_decision_at
            : acc.lastDecisionAt,
        createdAt: acc.createdAt || row.created_at,
        updatedAt: row.updated_at,
      }),
      {
        policyId,
        version: 'all',
        totalDecisions: 0,
        totalApprovals: 0,
        totalRejections: 0,
        confidenceSum: 0,
        confidenceCount: 0,
        lastDecisionAt: null,
        createdAt: null,
        updatedAt: null,
      } as any
    );

    // Calculate derived fields
    aggregated.approvalRate =
      aggregated.totalDecisions > 0
        ? Math.round((aggregated.totalApprovals / aggregated.totalDecisions) * 10000) / 100
        : 0;

    aggregated.rejectionRate =
      aggregated.totalDecisions > 0
        ? Math.round((aggregated.totalRejections / aggregated.totalDecisions) * 10000) / 100
        : 0;

    aggregated.avgConfidence =
      aggregated.confidenceCount > 0
        ? Math.round((aggregated.confidenceSum / aggregated.confidenceCount) * 100) / 100
        : undefined;

    delete aggregated.confidenceSum;
    delete aggregated.confidenceCount;

    return aggregated;
  }

  /**
   * Get top policies by decision count
   */
  static async getTopPolicies(limit: number = 10): Promise<PolicyStatistics[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_statistics')
      .select('*')
      .order('total_decisions', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapDbToStatisticsRaw);
  }

  /**
   * Get policies with low approval rate (potential issues)
   */
  static async getLowApprovalPolicies(
    thresholdPercent: number = 50,
    minDecisions: number = 10
  ): Promise<PolicyStatistics[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_statistics')
      .select('*')
      .gte('total_decisions', minDecisions);

    if (error) throw error;

    // Filter by approval rate (calculated)
    const filtered = (data || [])
      .map(mapDbToStatisticsRaw)
      .filter(stat => {
        const approvalRate = (stat.totalApprovals / stat.totalDecisions) * 100;
        return approvalRate < thresholdPercent;
      })
      .sort((a, b) => b.totalDecisions - a.totalDecisions);

    return filtered;
  }

  /**
   * Reset statistics for a policy version (admin only)
   */
  static async resetStatistics(policyId: string, version: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('policy_statistics')
      .update({
        total_decisions: 0,
        total_approvals: 0,
        total_rejections: 0,
        confidence_sum: 0,
        confidence_count: 0,
        last_decision_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('policy_id', policyId)
      .eq('version', version);

    if (error) throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapDbToStatistics(dbRow: any): PolicyStatistics {
  return {
    policyId: dbRow.policy_id,
    version: dbRow.version,
    totalDecisions: dbRow.total_decisions || 0,
    totalApprovals: dbRow.total_approvals || 0,
    totalRejections: dbRow.total_rejections || 0,
    approvalRate: dbRow.approval_rate,
    rejectionRate: dbRow.rejection_rate,
    avgConfidence: dbRow.avg_confidence,
    lastDecisionAt: dbRow.last_decision_at,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
  };
}

function mapDbToStatisticsRaw(dbRow: any): PolicyStatistics {
  const totalDecisions = dbRow.total_decisions || 0;
  const totalApprovals = dbRow.total_approvals || 0;
  const totalRejections = dbRow.total_rejections || 0;
  const confidenceSum = dbRow.confidence_sum || 0;
  const confidenceCount = dbRow.confidence_count || 0;

  return {
    policyId: dbRow.policy_id,
    version: dbRow.version,
    totalDecisions,
    totalApprovals,
    totalRejections,
    approvalRate:
      totalDecisions > 0
        ? Math.round((totalApprovals / totalDecisions) * 10000) / 100
        : 0,
    rejectionRate:
      totalDecisions > 0
        ? Math.round((totalRejections / totalDecisions) * 10000) / 100
        : 0,
    avgConfidence:
      confidenceCount > 0
        ? Math.round((confidenceSum / confidenceCount) * 100) / 100
        : undefined,
    lastDecisionAt: dbRow.last_decision_at,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
  };
}
