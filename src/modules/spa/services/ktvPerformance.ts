/**
 * Spa KTV Performance Tracking Service
 * 
 * Facade/wrapper for spa-specific KTV performance, rating, and leaderboard logic.
 * This module provides a spa-domain interface while delegating to existing implementations.
 * 
 * @module spa/services/ktvPerformance
 * @see src/lib/ktv-rating - KTV rating algorithm
 * @see src/services/ktv-actions - KTV performance queries
 */

// Re-export KTV rating algorithm
export {
  calculateCompositeRating,
  calculateCustomerRating,
  calculateDisciplineScore,
  type RatingInputs,
  type RatingBreakdown,
  type AttendanceStatus,
} from '@/lib/ktv-rating';

// Import and re-export KTV performance query functions
import { getKTVLeaderboard, getKTVEarnings } from '@/services/ktv-actions';
export { getKTVLeaderboard, getKTVEarnings };

import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get KTV performance metrics for a specific month.
 * 
 * @param supabase - Supabase client
 * @param ktvId - KTV user ID
 * @param monthYear - Month in YYYY-MM-DD format
 * @param tenantId - Tenant ID
 * @returns Performance metrics including sessions, ratings, and earnings
 */
export async function getKtvPerformanceMetrics(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string
): Promise<{
  sessionsCompleted: number;
  averageRating: number | null;
  totalEarnings: number;
  kpiBonus: number | null;
  lateDays: number;
  absentDays: number;
}> {
  // Query leaderboard RPC for the month
  const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
    'get_ktv_leaderboard',
    {
      p_tenant_id: tenantId,
      p_month: monthYear,
    }
  );

  if (leaderboardError) {
    console.error('[getKtvPerformanceMetrics] RPC failed:', leaderboardError);
    throw new Error(`Failed to fetch KTV performance: ${leaderboardError.message}`);
  }

  const leaderboard = (leaderboardData || []) as Array<{
    ktv_id: string;
    full_name?: string | null;
    sessions?: number | null;
    average_rating?: number | null;
    late_days?: number | null;
    absent_days?: number | null;
    total_kpi_bonus?: number | null;
  }>;

  const ktvRow = leaderboard.find((row) => row.ktv_id === ktvId);

  if (!ktvRow) {
    // KTV has no activity this month
    return {
      sessionsCompleted: 0,
      averageRating: null,
      totalEarnings: 0,
      kpiBonus: null,
      lateDays: 0,
      absentDays: 0,
    };
  }

  return {
    sessionsCompleted: ktvRow.sessions || 0,
    averageRating: ktvRow.average_rating || null,
    totalEarnings: 0, // TODO: Calculate from salary_records or session commissions
    kpiBonus: ktvRow.total_kpi_bonus || null,
    lateDays: ktvRow.late_days || 0,
    absentDays: ktvRow.absent_days || 0,
  };
}

/**
 * Spa KTV performance service facade.
 * 
 * This facade establishes the module boundary for spa-specific KTV performance operations.
 * All spa components should import from this module for performance tracking.
 * 
 * @example
 * ```ts
 * import { SpaKtvPerformanceService } from '@/modules/spa/services/ktvPerformance';
 * 
 * // Get leaderboard for the current month
 * const leaderboard = await SpaKtvPerformanceService.getLeaderboard('2026-06');
 * 
 * // Get performance metrics for a specific KTV
 * const metrics = await SpaKtvPerformanceService.getPerformanceMetrics(
 *   supabase,
 *   ktvId,
 *   '2026-06-01',
 *   tenantId
 * );
 * ```
 */
export const SpaKtvPerformanceService = {
  getLeaderboard: getKTVLeaderboard,
  getEarnings: getKTVEarnings,
  getPerformanceMetrics: getKtvPerformanceMetrics,
} as const;
