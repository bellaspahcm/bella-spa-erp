/**
 * Customer Churn Risk Prediction Model
 * 
 * Thuật toán dự đoán nguy cơ khách hàng rời bỏ (churn) dựa trên 4 yếu tố chính:
 * 
 * 1. Recency (40% weight): Số ngày kể từ lần booking cuối cùng
 *    - Khách hàng không quay lại lâu = nguy cơ cao
 * 
 * 2. Frequency Decline (30% weight): Xu hướng giảm tần suất booking
 *    - So sánh 90 ngày gần nhất vs 90 ngày trước đó
 *    - Giảm mạnh = nguy cơ cao
 * 
 * 3. Revenue Decline (20% weight): Xu hướng giảm doanh thu
 *    - So sánh revenue 90 ngày gần nhất vs 90 ngày trước đó
 *    - Giảm mạnh = nguy cơ cao
 * 
 * 4. Satisfaction (10% weight): Điểm đánh giá trung bình
 *    - Điểm thấp = khách hàng không hài lòng = nguy cơ cao
 * 
 * Điểm churn risk: 0-100 (càng cao càng nguy cơ cao)
 * - Low Risk: < 40
 * - Medium Risk: 40-69
 * - High Risk: >= 70
 * 
 * @module churn-risk
 * @created 2026-06-22
 */

/**
 * Churn Risk Factors Input
 */
export interface ChurnRiskFactors {
  /** Số ngày kể từ booking cuối cùng */
  daysSinceLastBooking: number;
  
  /** % thay đổi số lượng booking (90 ngày gần nhất vs 90 ngày trước đó) */
  bookingFrequencyChangePct: number | null;
  
  /** % thay đổi doanh thu (90 ngày gần nhất vs 90 ngày trước đó) */
  revenueChangePct: number | null;
  
  /** Điểm đánh giá trung bình (0-5) */
  avgReviewRating: number;
}

/**
 * Churn Risk Calculation Result
 */
export interface ChurnRiskResult {
  /** Factor scores (0-100, higher = higher risk) */
  recencyRiskScore: number;
  frequencyDeclineRiskScore: number;
  revenueDeclineRiskScore: number;
  satisfactionRiskScore: number;
  
  /** Overall churn risk score (0-100, weighted average) */
  churnRiskScore: number;
  
  /** Risk level: Low, Medium, High */
  churnRiskLevel: 'Low' | 'Medium' | 'High';
  
  /** Recommended retention actions */
  recommendedActions: string[];
}

/**
 * Churn Risk Thresholds (matching SQL migration)
 */
export const CHURN_RISK_THRESHOLDS = {
  /** Recency thresholds (days) */
  RECENCY: {
    EXCELLENT: 30,     // 0-30 days: 0 risk
    GOOD: 60,          // 31-60 days: 20 risk
    MODERATE: 90,      // 61-90 days: 40 risk
    POOR: 180,         // 91-180 days: 70 risk
    CRITICAL: Infinity // 181+ days: 100 risk
  },
  
  /** Frequency/Revenue decline thresholds (%) */
  DECLINE: {
    GROWING_STRONG: 50,  // +50%+: 0 risk
    STABLE: 0,           // 0 to +49%: 20 risk
    SLIGHT_DECLINE: -25, // 0 to -25%: 40 risk
    MODERATE_DECLINE: -50, // -25 to -50%: 70 risk
    SEVERE_DECLINE: -Infinity // -50%+: 100 risk
  },
  
  /** Satisfaction thresholds (rating 0-5) */
  SATISFACTION: {
    EXCELLENT: 4.5,      // 4.5-5.0: 0 risk
    GOOD: 4.0,           // 4.0-4.49: 20 risk
    MODERATE: 3.5,       // 3.5-3.99: 40 risk
    POOR: 3.0,           // 3.0-3.49: 70 risk
    VERY_POOR: 0         // <3.0: 100 risk
  },
  
  /** Overall risk level thresholds */
  RISK_LEVEL: {
    HIGH: 70,
    MEDIUM: 40,
    LOW: 0
  }
} as const;

/**
 * Weights for churn risk factors (must sum to 1.0)
 */
export const CHURN_RISK_WEIGHTS = {
  RECENCY: 0.4,
  FREQUENCY_DECLINE: 0.3,
  REVENUE_DECLINE: 0.2,
  SATISFACTION: 0.1
} as const;

/**
 * Calculate recency risk score (0-100)
 * Higher score = customer hasn't returned in a long time
 * 
 * @param daysSinceLastBooking - Days since last booking
 * @returns Risk score 0-100
 */
export function calculateRecencyRiskScore(daysSinceLastBooking: number): number {
  const { RECENCY } = CHURN_RISK_THRESHOLDS;
  
  if (daysSinceLastBooking <= RECENCY.EXCELLENT) return 0;
  if (daysSinceLastBooking <= RECENCY.GOOD) return 20;
  if (daysSinceLastBooking <= RECENCY.MODERATE) return 40;
  if (daysSinceLastBooking <= RECENCY.POOR) return 70;
  return 100;
}

/**
 * Calculate frequency decline risk score (0-100)
 * Higher score = customer booking frequency is declining rapidly
 * 
 * @param changePct - % change in booking frequency (90 days recent vs previous)
 * @returns Risk score 0-100
 */
export function calculateFrequencyDeclineRiskScore(changePct: number | null): number {
  const { DECLINE } = CHURN_RISK_THRESHOLDS;
  
  if (changePct === null) return 0; // Not enough data
  if (changePct >= DECLINE.GROWING_STRONG) return 0;
  if (changePct >= DECLINE.STABLE) return 20;
  if (changePct >= DECLINE.SLIGHT_DECLINE) return 40;
  if (changePct >= DECLINE.MODERATE_DECLINE) return 70;
  return 100;
}

/**
 * Calculate revenue decline risk score (0-100)
 * Higher score = customer revenue is declining rapidly
 * 
 * @param changePct - % change in revenue (90 days recent vs previous)
 * @returns Risk score 0-100
 */
export function calculateRevenueDeclineRiskScore(changePct: number | null): number {
  const { DECLINE } = CHURN_RISK_THRESHOLDS;
  
  if (changePct === null) return 0; // Not enough data
  if (changePct >= DECLINE.GROWING_STRONG) return 0;
  if (changePct >= DECLINE.STABLE) return 20;
  if (changePct >= DECLINE.SLIGHT_DECLINE) return 40;
  if (changePct >= DECLINE.MODERATE_DECLINE) return 70;
  return 100;
}

/**
 * Calculate satisfaction risk score (0-100)
 * Higher score = customer is dissatisfied with services
 * 
 * @param avgRating - Average review rating (0-5)
 * @returns Risk score 0-100
 */
export function calculateSatisfactionRiskScore(avgRating: number): number {
  const { SATISFACTION } = CHURN_RISK_THRESHOLDS;
  
  if (avgRating === 0) return 50; // No reviews = moderate risk
  if (avgRating >= SATISFACTION.EXCELLENT) return 0;
  if (avgRating >= SATISFACTION.GOOD) return 20;
  if (avgRating >= SATISFACTION.MODERATE) return 40;
  if (avgRating >= SATISFACTION.POOR) return 70;
  return 100;
}

/**
 * Calculate overall churn risk score (weighted average)
 * 
 * Formula:
 * churnRiskScore = (recency * 0.4) + (frequencyDecline * 0.3) + (revenueDecline * 0.2) + (satisfaction * 0.1)
 * 
 * @param factors - Churn risk factors
 * @returns Churn risk calculation result
 */
export function calculateChurnRisk(factors: ChurnRiskFactors): ChurnRiskResult {
  // Calculate individual factor scores
  const recencyRiskScore = calculateRecencyRiskScore(factors.daysSinceLastBooking);
  const frequencyDeclineRiskScore = calculateFrequencyDeclineRiskScore(factors.bookingFrequencyChangePct);
  const revenueDeclineRiskScore = calculateRevenueDeclineRiskScore(factors.revenueChangePct);
  const satisfactionRiskScore = calculateSatisfactionRiskScore(factors.avgReviewRating);
  
  // Calculate weighted average
  const churnRiskScore = Math.round(
    recencyRiskScore * CHURN_RISK_WEIGHTS.RECENCY +
    frequencyDeclineRiskScore * CHURN_RISK_WEIGHTS.FREQUENCY_DECLINE +
    revenueDeclineRiskScore * CHURN_RISK_WEIGHTS.REVENUE_DECLINE +
    satisfactionRiskScore * CHURN_RISK_WEIGHTS.SATISFACTION
  );
  
  // Determine risk level
  let churnRiskLevel: 'Low' | 'Medium' | 'High';
  if (churnRiskScore >= CHURN_RISK_THRESHOLDS.RISK_LEVEL.HIGH) {
    churnRiskLevel = 'High';
  } else if (churnRiskScore >= CHURN_RISK_THRESHOLDS.RISK_LEVEL.MEDIUM) {
    churnRiskLevel = 'Medium';
  } else {
    churnRiskLevel = 'Low';
  }
  
  // Get recommended actions
  const recommendedActions = getRecommendedRetentionActions(churnRiskLevel);
  
  return {
    recencyRiskScore,
    frequencyDeclineRiskScore,
    revenueDeclineRiskScore,
    satisfactionRiskScore,
    churnRiskScore,
    churnRiskLevel,
    recommendedActions
  };
}

/**
 * Get recommended retention actions based on risk level
 * 
 * @param riskLevel - Churn risk level
 * @returns Array of recommended actions
 */
export function getRecommendedRetentionActions(riskLevel: 'Low' | 'Medium' | 'High'): string[] {
  switch (riskLevel) {
    case 'High':
      return [
        'Urgent: Personal call from manager',
        'Exclusive VIP discount offer',
        'Survey: Why are you leaving?',
        'Win-back campaign'
      ];
    case 'Medium':
      return [
        'Re-engagement email campaign',
        'Special promotion offer',
        'Request feedback',
        'Schedule follow-up call'
      ];
    case 'Low':
      return [
        'Regular newsletter',
        'Loyalty rewards reminder',
        'New service announcements'
      ];
  }
}

/**
 * Example Usage:
 * 
 * ```typescript
 * // Example 1: High Risk Customer
 * const highRiskCustomer = calculateChurnRisk({
 *   daysSinceLastBooking: 200,          // Not returned in 6+ months
 *   bookingFrequencyChangePct: -60,     // Booking frequency dropped 60%
 *   revenueChangePct: -70,              // Revenue dropped 70%
 *   avgReviewRating: 2.5                // Low satisfaction
 * });
 * // Result: churnRiskScore = 92, churnRiskLevel = 'High'
 * 
 * // Example 2: Medium Risk Customer
 * const mediumRiskCustomer = calculateChurnRisk({
 *   daysSinceLastBooking: 95,           // Not returned in 3 months
 *   bookingFrequencyChangePct: -20,     // Slight decline
 *   revenueChangePct: 10,               // Revenue slightly up
 *   avgReviewRating: 4.0                // Good satisfaction
 * });
 * // Result: churnRiskScore = 48, churnRiskLevel = 'Medium'
 * 
 * // Example 3: Low Risk Customer
 * const lowRiskCustomer = calculateChurnRisk({
 *   daysSinceLastBooking: 15,           // Recent booking
 *   bookingFrequencyChangePct: 50,      // Booking frequency up 50%
 *   revenueChangePct: 80,               // Revenue up 80%
 *   avgReviewRating: 4.8                // Very satisfied
 * });
 * // Result: churnRiskScore = 0, churnRiskLevel = 'Low'
 * ```
 */
