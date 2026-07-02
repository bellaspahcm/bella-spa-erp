/**
 * Unit Tests for Churn Risk Prediction Algorithm
 * 
 * Tests the rule-based churn risk calculation logic with various scenarios.
 * Verifies weighted scores, risk level thresholds, and recommended actions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateChurnRisk,
  calculateRecencyRiskScore,
  calculateFrequencyDeclineRiskScore,
  calculateRevenueDeclineRiskScore,
  calculateSatisfactionRiskScore,
  getRecommendedRetentionActions,
  CHURN_RISK_THRESHOLDS,
  CHURN_RISK_WEIGHTS,
  type ChurnRiskFactors,
} from '../churn-risk';

// ─────────────────────────────────────────────────────────────────────────────
// Constants Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Churn Risk Constants', () => {
  it('weights should sum to 1.0', () => {
    const sum =
      CHURN_RISK_WEIGHTS.RECENCY +
      CHURN_RISK_WEIGHTS.FREQUENCY_DECLINE +
      CHURN_RISK_WEIGHTS.REVENUE_DECLINE +
      CHURN_RISK_WEIGHTS.SATISFACTION;

    expect(sum).toBe(1.0);
  });

  it('thresholds should be properly ordered', () => {
    const { RECENCY } = CHURN_RISK_THRESHOLDS;
    expect(RECENCY.EXCELLENT).toBeLessThan(RECENCY.GOOD);
    expect(RECENCY.GOOD).toBeLessThan(RECENCY.MODERATE);
    expect(RECENCY.MODERATE).toBeLessThan(RECENCY.POOR);

    const { DECLINE } = CHURN_RISK_THRESHOLDS;
    expect(DECLINE.GROWING_STRONG).toBeGreaterThan(DECLINE.STABLE);
    expect(DECLINE.STABLE).toBeGreaterThan(DECLINE.SLIGHT_DECLINE);
    expect(DECLINE.SLIGHT_DECLINE).toBeGreaterThan(DECLINE.MODERATE_DECLINE);

    const { SATISFACTION } = CHURN_RISK_THRESHOLDS;
    expect(SATISFACTION.EXCELLENT).toBeGreaterThan(SATISFACTION.GOOD);
    expect(SATISFACTION.GOOD).toBeGreaterThan(SATISFACTION.MODERATE);
    expect(SATISFACTION.MODERATE).toBeGreaterThan(SATISFACTION.POOR);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recency Risk Score Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateRecencyRiskScore', () => {
  it('should return 0 for recent customers (0-30 days)', () => {
    expect(calculateRecencyRiskScore(0)).toBe(0);
    expect(calculateRecencyRiskScore(15)).toBe(0);
    expect(calculateRecencyRiskScore(30)).toBe(0);
  });

  it('should return 20 for 31-60 days', () => {
    expect(calculateRecencyRiskScore(31)).toBe(20);
    expect(calculateRecencyRiskScore(45)).toBe(20);
    expect(calculateRecencyRiskScore(60)).toBe(20);
  });

  it('should return 40 for 61-90 days', () => {
    expect(calculateRecencyRiskScore(61)).toBe(40);
    expect(calculateRecencyRiskScore(75)).toBe(40);
    expect(calculateRecencyRiskScore(90)).toBe(40);
  });

  it('should return 70 for 91-180 days', () => {
    expect(calculateRecencyRiskScore(91)).toBe(70);
    expect(calculateRecencyRiskScore(120)).toBe(70);
    expect(calculateRecencyRiskScore(180)).toBe(70);
  });

  it('should return 100 for 181+ days', () => {
    expect(calculateRecencyRiskScore(181)).toBe(100);
    expect(calculateRecencyRiskScore(365)).toBe(100);
    expect(calculateRecencyRiskScore(1000)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Frequency Decline Risk Score Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateFrequencyDeclineRiskScore', () => {
  it('should return 0 when no data available', () => {
    expect(calculateFrequencyDeclineRiskScore(null)).toBe(0);
  });

  it('should return 0 for strong growth (50%+)', () => {
    expect(calculateFrequencyDeclineRiskScore(50)).toBe(0);
    expect(calculateFrequencyDeclineRiskScore(100)).toBe(0);
    expect(calculateFrequencyDeclineRiskScore(200)).toBe(0);
  });

  it('should return 20 for stable or slight growth (0 to 49%)', () => {
    expect(calculateFrequencyDeclineRiskScore(0)).toBe(20);
    expect(calculateFrequencyDeclineRiskScore(25)).toBe(20);
    expect(calculateFrequencyDeclineRiskScore(49)).toBe(20);
  });

  it('should return 40 for slight decline (0 to -25%)', () => {
    expect(calculateFrequencyDeclineRiskScore(-1)).toBe(40);
    expect(calculateFrequencyDeclineRiskScore(-10)).toBe(40);
    expect(calculateFrequencyDeclineRiskScore(-25)).toBe(40);
  });

  it('should return 70 for moderate decline (-25 to -50%)', () => {
    expect(calculateFrequencyDeclineRiskScore(-26)).toBe(70);
    expect(calculateFrequencyDeclineRiskScore(-35)).toBe(70);
    expect(calculateFrequencyDeclineRiskScore(-50)).toBe(70);
  });

  it('should return 100 for severe decline (-50%+)', () => {
    expect(calculateFrequencyDeclineRiskScore(-51)).toBe(100);
    expect(calculateFrequencyDeclineRiskScore(-75)).toBe(100);
    expect(calculateFrequencyDeclineRiskScore(-100)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Decline Risk Score Tests (same logic as frequency)
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateRevenueDeclineRiskScore', () => {
  it('should return 0 when no data available', () => {
    expect(calculateRevenueDeclineRiskScore(null)).toBe(0);
  });

  it('should return 0 for strong growth (50%+)', () => {
    expect(calculateRevenueDeclineRiskScore(50)).toBe(0);
    expect(calculateRevenueDeclineRiskScore(100)).toBe(0);
  });

  it('should return 20 for stable (0 to 49%)', () => {
    expect(calculateRevenueDeclineRiskScore(0)).toBe(20);
    expect(calculateRevenueDeclineRiskScore(25)).toBe(20);
  });

  it('should return 40 for slight decline (0 to -25%)', () => {
    expect(calculateRevenueDeclineRiskScore(-10)).toBe(40);
    expect(calculateRevenueDeclineRiskScore(-25)).toBe(40);
  });

  it('should return 70 for moderate decline (-25 to -50%)', () => {
    expect(calculateRevenueDeclineRiskScore(-30)).toBe(70);
    expect(calculateRevenueDeclineRiskScore(-50)).toBe(70);
  });

  it('should return 100 for severe decline (-50%+)', () => {
    expect(calculateRevenueDeclineRiskScore(-60)).toBe(100);
    expect(calculateRevenueDeclineRiskScore(-100)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Satisfaction Risk Score Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateSatisfactionRiskScore', () => {
  it('should return 50 for no reviews', () => {
    expect(calculateSatisfactionRiskScore(0)).toBe(50);
  });

  it('should return 0 for excellent satisfaction (4.5-5.0)', () => {
    expect(calculateSatisfactionRiskScore(4.5)).toBe(0);
    expect(calculateSatisfactionRiskScore(4.7)).toBe(0);
    expect(calculateSatisfactionRiskScore(5.0)).toBe(0);
  });

  it('should return 20 for good satisfaction (4.0-4.49)', () => {
    expect(calculateSatisfactionRiskScore(4.0)).toBe(20);
    expect(calculateSatisfactionRiskScore(4.2)).toBe(20);
    expect(calculateSatisfactionRiskScore(4.49)).toBe(20);
  });

  it('should return 40 for moderate satisfaction (3.5-3.99)', () => {
    expect(calculateSatisfactionRiskScore(3.5)).toBe(40);
    expect(calculateSatisfactionRiskScore(3.7)).toBe(40);
    expect(calculateSatisfactionRiskScore(3.99)).toBe(40);
  });

  it('should return 70 for poor satisfaction (3.0-3.49)', () => {
    expect(calculateSatisfactionRiskScore(3.0)).toBe(70);
    expect(calculateSatisfactionRiskScore(3.2)).toBe(70);
    expect(calculateSatisfactionRiskScore(3.49)).toBe(70);
  });

  it('should return 100 for very poor satisfaction (<3.0)', () => {
    expect(calculateSatisfactionRiskScore(2.9)).toBe(100);
    expect(calculateSatisfactionRiskScore(2.0)).toBe(100);
    expect(calculateSatisfactionRiskScore(1.0)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Overall Churn Risk Calculation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateChurnRisk', () => {
  it('should calculate Low Risk for perfect customer', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 15,
      bookingFrequencyChangePct: 50,
      revenueChangePct: 80,
      avgReviewRating: 4.8,
    };

    const result = calculateChurnRisk(factors);

    expect(result.recencyRiskScore).toBe(0);
    expect(result.frequencyDeclineRiskScore).toBe(0);
    expect(result.revenueDeclineRiskScore).toBe(0);
    expect(result.satisfactionRiskScore).toBe(0);
    expect(result.churnRiskScore).toBe(0);
    expect(result.churnRiskLevel).toBe('Low');
    expect(result.recommendedActions).toContain('Regular newsletter');
  });

  it('should calculate High Risk for declining customer', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 200,
      bookingFrequencyChangePct: -60,
      revenueChangePct: -70,
      avgReviewRating: 2.5,
    };

    const result = calculateChurnRisk(factors);

    expect(result.recencyRiskScore).toBe(100);
    expect(result.frequencyDeclineRiskScore).toBe(100);
    expect(result.revenueDeclineRiskScore).toBe(100);
    expect(result.satisfactionRiskScore).toBe(100);
    
    // Weighted: (100*0.4) + (100*0.3) + (100*0.2) + (100*0.1) = 100
    expect(result.churnRiskScore).toBe(100);
    expect(result.churnRiskLevel).toBe('High');
    expect(result.recommendedActions).toContain('Urgent: Personal call from manager');
  });

  it('should calculate Medium Risk for moderate decline', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 95,
      bookingFrequencyChangePct: -20,
      revenueChangePct: 10,
      avgReviewRating: 4.0,
    };

    const result = calculateChurnRisk(factors);

    expect(result.recencyRiskScore).toBe(70);
    expect(result.frequencyDeclineRiskScore).toBe(40);
    expect(result.revenueDeclineRiskScore).toBe(20);
    expect(result.satisfactionRiskScore).toBe(20);
    
    // Weighted: (70*0.4) + (40*0.3) + (20*0.2) + (20*0.1) = 28 + 12 + 4 + 2 = 46
    expect(result.churnRiskScore).toBe(46);
    expect(result.churnRiskLevel).toBe('Medium');
    expect(result.recommendedActions).toContain('Re-engagement email campaign');
  });

  it('should handle missing data gracefully', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 30,
      bookingFrequencyChangePct: null,
      revenueChangePct: null,
      avgReviewRating: 0,
    };

    const result = calculateChurnRisk(factors);

    expect(result.recencyRiskScore).toBe(0);
    expect(result.frequencyDeclineRiskScore).toBe(0); // null = 0
    expect(result.revenueDeclineRiskScore).toBe(0); // null = 0
    expect(result.satisfactionRiskScore).toBe(50); // 0 rating = 50
    
    // Weighted: (0*0.4) + (0*0.3) + (0*0.2) + (50*0.1) = 5
    expect(result.churnRiskScore).toBe(5);
    expect(result.churnRiskLevel).toBe('Low');
  });

  it('should handle boundary case at High Risk threshold', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 100, // 70 risk
      bookingFrequencyChangePct: 0, // 20 risk
      revenueChangePct: 0, // 20 risk
      avgReviewRating: 5.0, // 0 risk
    };

    const result = calculateChurnRisk(factors);

    // Weighted: (70*0.4) + (20*0.3) + (20*0.2) + (0*0.1) = 28 + 6 + 4 + 0 = 38
    expect(result.churnRiskScore).toBe(38);
    expect(result.churnRiskLevel).toBe('Low'); // Just below 40 threshold
  });

  it('should handle boundary case at Medium Risk threshold', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 100, // 70 risk
      bookingFrequencyChangePct: -30, // 70 risk
      revenueChangePct: -30, // 70 risk
      avgReviewRating: 4.0, // 20 risk
    };

    const result = calculateChurnRisk(factors);

    // Weighted: (70*0.4) + (70*0.3) + (70*0.2) + (20*0.1) = 28 + 21 + 14 + 2 = 65
    expect(result.churnRiskScore).toBe(65);
    expect(result.churnRiskLevel).toBe('Medium');
  });

  it('should round churn risk score correctly', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 45, // 20 risk
      bookingFrequencyChangePct: 10, // 20 risk
      revenueChangePct: 5, // 20 risk
      avgReviewRating: 4.3, // 20 risk
    };

    const result = calculateChurnRisk(factors);

    // Weighted: (20*0.4) + (20*0.3) + (20*0.2) + (20*0.1) = 8 + 6 + 4 + 2 = 20
    expect(result.churnRiskScore).toBe(20);
    expect(Number.isInteger(result.churnRiskScore)).toBe(true);
  });

  it('should calculate weighted average correctly for mixed scores', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 250, // 100 risk (40% weight)
      bookingFrequencyChangePct: 0, // 20 risk (30% weight)
      revenueChangePct: 50, // 0 risk (20% weight)
      avgReviewRating: 3.0, // 70 risk (10% weight)
    };

    const result = calculateChurnRisk(factors);

    // Weighted: (100*0.4) + (20*0.3) + (0*0.2) + (70*0.1) = 40 + 6 + 0 + 7 = 53
    expect(result.churnRiskScore).toBe(53);
    expect(result.churnRiskLevel).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recommended Actions Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getRecommendedRetentionActions', () => {
  it('should return urgent actions for High risk', () => {
    const actions = getRecommendedRetentionActions('High');
    
    expect(actions).toContain('Urgent: Personal call from manager');
    expect(actions).toContain('Exclusive VIP discount offer');
    expect(actions).toContain('Survey: Why are you leaving?');
    expect(actions).toContain('Win-back campaign');
    expect(actions.length).toBe(4);
  });

  it('should return re-engagement actions for Medium risk', () => {
    const actions = getRecommendedRetentionActions('Medium');
    
    expect(actions).toContain('Re-engagement email campaign');
    expect(actions).toContain('Special promotion offer');
    expect(actions).toContain('Request feedback');
    expect(actions).toContain('Schedule follow-up call');
    expect(actions.length).toBe(4);
  });

  it('should return routine actions for Low risk', () => {
    const actions = getRecommendedRetentionActions('Low');
    
    expect(actions).toContain('Regular newsletter');
    expect(actions).toContain('Loyalty rewards reminder');
    expect(actions).toContain('New service announcements');
    expect(actions.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real-World Scenario Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Real-World Scenarios', () => {
  it('VIP customer with recent activity should be Low Risk', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 10,
      bookingFrequencyChangePct: 20,
      revenueChangePct: 30,
      avgReviewRating: 4.9,
    };

    const result = calculateChurnRisk(factors);
    
    expect(result.churnRiskLevel).toBe('Low');
    expect(result.churnRiskScore).toBeLessThan(20);
  });

  it('Previously loyal customer now inactive should be High Risk', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 220,
      bookingFrequencyChangePct: -80,
      revenueChangePct: -90,
      avgReviewRating: 3.2,
    };

    const result = calculateChurnRisk(factors);
    
    expect(result.churnRiskLevel).toBe('High');
    expect(result.churnRiskScore).toBeGreaterThan(80);
  });

  it('New customer with no history should have moderate risk', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 5,
      bookingFrequencyChangePct: null,
      revenueChangePct: null,
      avgReviewRating: 0,
    };

    const result = calculateChurnRisk(factors);
    
    expect(result.churnRiskLevel).toBe('Low');
    // Recency is good but no reviews = 50 risk * 0.1 = 5
    expect(result.churnRiskScore).toBe(5);
  });

  it('Satisfied but inactive customer should be Medium Risk', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 120,
      bookingFrequencyChangePct: -10,
      revenueChangePct: -5,
      avgReviewRating: 4.5,
    };

    const result = calculateChurnRisk(factors);
    
    // Recency: 70, Frequency: 40, Revenue: 40, Satisfaction: 0
    // Weighted: (70*0.4) + (40*0.3) + (40*0.2) + (0*0.1) = 28 + 12 + 8 + 0 = 48
    expect(result.churnRiskScore).toBe(48);
    expect(result.churnRiskLevel).toBe('Medium');
  });

  it('Active but dissatisfied customer should be Medium/High Risk', () => {
    const factors: ChurnRiskFactors = {
      daysSinceLastBooking: 20,
      bookingFrequencyChangePct: 0,
      revenueChangePct: 0,
      avgReviewRating: 2.8,
    };

    const result = calculateChurnRisk(factors);
    
    // Recency: 0, Frequency: 20, Revenue: 20, Satisfaction: 100
    // Weighted: (0*0.4) + (20*0.3) + (20*0.2) + (100*0.1) = 0 + 6 + 4 + 10 = 20
    expect(result.churnRiskScore).toBe(20);
    expect(result.churnRiskLevel).toBe('Low'); // Satisfaction is only 10% weight
  });
});
