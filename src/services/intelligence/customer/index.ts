/**
 * Customer Intelligence Module
 * 
 * Exports:
 * - CustomerIntelligenceService (main service class)
 * - All query functions
 * - Churn Risk Model (rule-based prediction algorithm)
 * - All type definitions
 * 
 * Usage:
 * ```typescript
 * // Service usage
 * import { getCustomerIntelligenceService } from '@/services/intelligence/customer';
 * const service = getCustomerIntelligenceService();
 * const result = await service.getCustomerSegmentation(tenantId);
 * 
 * // Churn risk calculation (client-side)
 * import { calculateChurnRisk } from '@/services/intelligence/customer';
 * const risk = calculateChurnRisk({
 *   daysSinceLastBooking: 100,
 *   bookingFrequencyChangePct: -30,
 *   revenueChangePct: -20,
 *   avgReviewRating: 3.5
 * });
 * console.log(risk.churnRiskLevel); // 'Medium'
 * ```
 */

// Service
export { CustomerIntelligenceService, getCustomerIntelligenceService } from './service';

// Query functions
export {
  getCustomerSegmentation,
  getCustomerLTV,
  getChurnRiskAnalysis,
  getRFMAnalysis,
  getSegmentDistribution,
  getCohortAnalysis,
} from './queries';

// Churn Risk Model
export {
  calculateChurnRisk,
  calculateRecencyRiskScore,
  calculateFrequencyDeclineRiskScore,
  calculateRevenueDeclineRiskScore,
  calculateSatisfactionRiskScore,
  getRecommendedRetentionActions,
  CHURN_RISK_THRESHOLDS,
  CHURN_RISK_WEIGHTS,
} from './churn-risk';

// Types
export type {
  CustomerSegment,
  CustomerLTV,
  CustomerActivitySummary,
  SegmentDistribution,
  CohortAnalysis,
} from './queries';

export type {
  ChurnRiskFactors,
  ChurnRiskResult,
} from './churn-risk';
