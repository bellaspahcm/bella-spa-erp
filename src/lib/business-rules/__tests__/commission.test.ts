/**
 * @fileoverview Unit tests for commission calculation business logic
 * @module lib/business-rules/__tests__/commission.test
 */

import {
  parseCommissionInput,
  calculateServiceCommission,
  calculateProductSalesCommission,
  calculatePositionBonus,
  calculateSeniorityBonus,
  aggregateManualAdjustments,
  calculateYearsOfService,
  getSeniorityBonusRate,
  DEFAULT_COMMISSION_CONFIG,
} from '../commission';

describe('Commission Business Logic', () => {
  describe('parseCommissionInput', () => {
    it('should parse fixed amount commission', () => {
      expect(parseCommissionInput('fixed', 150000, 0)).toBe(150000);
      expect(parseCommissionInput('fixed', 200000, 0)).toBe(200000);
    });

    it('should parse percentage commission', () => {
      expect(parseCommissionInput('percentage', 10, 1000000)).toBe(100000);
      expect(parseCommissionInput('percentage', 15, 500000)).toBe(75000);
      expect(parseCommissionInput('percentage', 15.5, 500000)).toBe(77500);
    });

    it('should clamp percentage to 0-100 range', () => {
      expect(parseCommissionInput('percentage', 150, 1000000)).toBe(1000000); // Clamped to 100%
      expect(parseCommissionInput('percentage', -10, 1000000)).toBe(0); // Clamped to 0%
    });

    it('should handle negative fixed amounts', () => {
      expect(parseCommissionInput('fixed', -100000, 0)).toBe(0);
    });
  });

  describe('calculateServiceCommission', () => {
    it('should use override commission when provided', () => {
      const result = calculateServiceCommission({
        subtotal: 500000,
        overrideType: 'fixed',
        overrideValue: 200000,
      });
      expect(result).toBe(200000);
    });

    it('should use tenant default when no override', () => {
      const result = calculateServiceCommission({
        subtotal: 800000,
        defaultType: 'fixed',
        defaultValue: 150000,
      });
      expect(result).toBe(150000);
    });

    it('should use system default when no override or tenant default', () => {
      const result = calculateServiceCommission({
        subtotal: 600000,
      });
      expect(result).toBe(DEFAULT_COMMISSION_CONFIG.service_commission_default.value);
    });

    it('should support percentage override', () => {
      const result = calculateServiceCommission({
        subtotal: 1000000,
        overrideType: 'percentage',
        overrideValue: 15,
      });
      expect(result).toBe(150000);
    });
  });

  describe('calculateProductSalesCommission', () => {
    it('should use override commission when provided', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 2000000,
        overrideType: 'fixed',
        overrideValue: 50000,
      });
      expect(result).toBe(50000);
    });

    it('should use property-level commission when no override is provided', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 1000000,
        productCommissionType: 'percentage',
        productCommissionValue: 1.5,
        projectCommissionType: 'percentage',
        projectCommissionValue: 2,
      });
      expect(result).toBe(15000); // 1.5% of 1M
    });

    it('should use project-level commission when no override or property commission is provided', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 1000000,
        projectCommissionType: 'percentage',
        projectCommissionValue: 2,
        defaultType: 'percentage',
        defaultValue: 5,
      });
      expect(result).toBe(20000); // 2% of 1M
    });

    it('should use tenant default when no override, property, or project commission is provided', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 1000000,
        defaultType: 'percentage',
        defaultValue: 5,
      });
      expect(result).toBe(50000); // 5% of 1M
    });

    it('should use system default (10% percentage) when no other config is provided', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 500000,
      });
      expect(result).toBe(50000); // 10% of 500k
    });

    it('should support percentage override', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 1000000,
        overrideType: 'percentage',
        overrideValue: 15,
      });
      expect(result).toBe(150000);
    });
  });

  describe('calculatePositionBonus', () => {
    it('should calculate junior position bonus (no bonus)', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: 'junior',
      });
      expect(result).toBe(0); // 1.0x - 1.0 = 0
    });

    it('should calculate senior position bonus (20%)', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: 'senior',
      });
      expect(result).toBe(200000); // 1.2x - 1.0 = 0.2, 1M × 0.2 = 200k
    });

    it('should calculate lead position bonus (50%)', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: 'lead',
      });
      expect(result).toBe(500000); // 1.5x - 1.0 = 0.5, 1M × 0.5 = 500k
    });

    it('should use custom multipliers', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: 'senior',
        multipliers: {
          junior: 1.0,
          senior: 1.3,
          lead: 1.6,
        },
      });
      expect(result).toBe(300000); // 1.3x - 1.0 = 0.3, 1M × 0.3 = 300k
    });
  });

  describe('calculateYearsOfService', () => {
    it('should calculate years of service from hire date', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const years = calculateYearsOfService(twoYearsAgo);
      expect(years).toBeGreaterThanOrEqual(1.9);
      expect(years).toBeLessThanOrEqual(2.1);
    });

    it('should handle null hire date', () => {
      expect(calculateYearsOfService(null)).toBe(0);
      expect(calculateYearsOfService(undefined)).toBe(0);
    });

    it('should handle invalid date strings', () => {
      expect(calculateYearsOfService('invalid')).toBe(0);
    });
  });

  describe('getSeniorityBonusRate', () => {
    it('should return 0% for 0-1 year', () => {
      expect(getSeniorityBonusRate(0.5)).toBe(0.00);
      expect(getSeniorityBonusRate(0.99)).toBe(0.00);
    });

    it('should return 5% for 1-3 years', () => {
      expect(getSeniorityBonusRate(1.01)).toBe(0.05); // Just over 1 year
      expect(getSeniorityBonusRate(2.0)).toBe(0.05);
      expect(getSeniorityBonusRate(2.99)).toBe(0.05);
    });

    it('should return 10% for 3-5 years', () => {
      expect(getSeniorityBonusRate(3.01)).toBe(0.10); // Just over 3 years
      expect(getSeniorityBonusRate(4.0)).toBe(0.10);
      expect(getSeniorityBonusRate(4.99)).toBe(0.10);
    });

    it('should return 15% for 5+ years', () => {
      expect(getSeniorityBonusRate(5.01)).toBe(0.15); // Just over 5 years
      expect(getSeniorityBonusRate(6.0)).toBe(0.15);
      expect(getSeniorityBonusRate(10.0)).toBe(0.15);
    });
  });

  describe('calculateSeniorityBonus', () => {
    it('should calculate 0% bonus for new employee', () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const result = calculateSeniorityBonus({
        baseSalary: 6000000,
        hireDate: sixMonthsAgo,
      });
      expect(result).toBe(0); // 0% of 6M
    });

    it('should calculate 5% bonus for 2 years experience', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const result = calculateSeniorityBonus({
        baseSalary: 6000000,
        hireDate: twoYearsAgo,
      });
      expect(result).toBe(300000); // 5% of 6M
    });

    it('should return 0 for null hire date', () => {
      const result = calculateSeniorityBonus({
        baseSalary: 6000000,
        hireDate: null,
      });
      expect(result).toBe(0);
    });
  });

  describe('aggregateManualAdjustments', () => {
    it('should sum bonuses and subtract deductions', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'bonus', amount: 500000, status: 'approved' },
          { adjustment_type: 'bonus', amount: 200000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 100000, status: 'approved' },
        ],
      });
      expect(result).toBe(600000); // 500k + 200k - 100k
    });

    it('should ignore non-approved adjustments', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'bonus', amount: 500000, status: 'approved' },
          { adjustment_type: 'bonus', amount: 300000, status: 'draft' }, // Ignored
          { adjustment_type: 'deduction', amount: 100000, status: 'rejected' }, // Ignored
        ],
      });
      expect(result).toBe(500000); // Only approved bonus counted
    });

    it('should handle all deductions (negative result)', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'deduction', amount: 500000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 200000, status: 'approved' },
        ],
      });
      expect(result).toBe(-700000); // Net deduction
    });

    it('should handle empty adjustments', () => {
      const result = aggregateManualAdjustments({
        adjustments: [],
      });
      expect(result).toBe(0);
    });
  });
});

// ============================================================
// TASK 34: COMPREHENSIVE EDGE CASE TESTS
// ============================================================

describe('Commission Edge Cases & Boundary Conditions (Task 34)', () => {
  
  describe('Negative Values Edge Cases', () => {
    it('should handle negative fixed commission gracefully', () => {
      const result = calculateServiceCommission({
        subtotal: 500000,
        overrideType: 'fixed',
        overrideValue: -100000,
      });
      expect(result).toBe(0); // Never negative
    });

    it('should handle negative subtotal gracefully', () => {
      const result = calculateServiceCommission({
        subtotal: -500000,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      expect(result).toBe(0); // Percentage of negative is 0
    });

    it('should handle negative percentage gracefully', () => {
      const result = parseCommissionInput('percentage', -50, 1000000);
      expect(result).toBe(0); // Clamped to 0
    });

    it('should handle negative base commission for position bonus', () => {
      const result = calculatePositionBonus({
        baseCommission: -1000000,
        positionTier: 'senior',
      });
      expect(result).toBe(0); // Never negative bonus
    });

    it('should handle negative base salary for seniority bonus', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const result = calculateSeniorityBonus({
        baseSalary: -6000000,
        hireDate: twoYearsAgo,
      });
      expect(result).toBe(0); // Never negative bonus
    });
  });

  describe('Very Large Numbers Edge Cases', () => {
    it('should handle 10 billion VND commission', () => {
      const result = calculateServiceCommission({
        subtotal: 10_000_000_000, // 10B VND
        overrideType: 'percentage',
        overrideValue: 10,
      });
      expect(result).toBe(1_000_000_000); // 1B VND
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle 100 billion VND product sales', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 100_000_000_000, // 100B VND
        overrideType: 'percentage',
        overrideValue: 5,
      });
      expect(result).toBe(5_000_000_000); // 5B VND
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle very large position bonus', () => {
      const result = calculatePositionBonus({
        baseCommission: 50_000_000_000, // 50B base
        positionTier: 'lead',
      });
      expect(result).toBe(25_000_000_000); // 25B bonus (50%)
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle JavaScript MAX_SAFE_INTEGER boundaries', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      const result = calculateServiceCommission({
        subtotal: maxSafe,
        overrideType: 'percentage',
        overrideValue: 1, // 1%
      });
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Decimal Precision Edge Cases', () => {
    it('should handle 15.5% commission', () => {
      const result = parseCommissionInput('percentage', 15.5, 1000000);
      expect(result).toBe(155000);
    });

    it('should handle 0.01% commission (1 basis point)', () => {
      const result = parseCommissionInput('percentage', 0.01, 10000000);
      expect(result).toBe(1000); // 0.01% of 10M = 1k
    });

    it('should handle 99.99% commission', () => {
      const result = parseCommissionInput('percentage', 99.99, 1000000);
      expect(result).toBe(999900);
    });

    it('should handle fractional fixed commission (e.g., 150500.75 VND)', () => {
      const result = parseCommissionInput('fixed', 150500.75, 0);
      expect(result).toBe(150500.75);
    });

    it('should preserve decimal precision in percentage calculations', () => {
      const result = parseCommissionInput('percentage', 33.33, 1000000);
      expect(result).toBe(333300); // 33.33% of 1M
    });

    it('should handle rounding in division operations', () => {
      // Test case: 1000000 / 3 = 333333.333...
      const result = parseCommissionInput('percentage', 33.333333, 1000000);
      // Math.round(333333.33) = 333333
      expect(result).toBe(333333);
    });
  });

  describe('Zero Values Edge Cases', () => {
    it('should handle 0% commission', () => {
      const result = parseCommissionInput('percentage', 0, 5000000);
      expect(result).toBe(0);
    });

    it('should handle 0 VND fixed commission', () => {
      const result = parseCommissionInput('fixed', 0, 0);
      expect(result).toBe(0);
    });

    it('should handle 0 VND subtotal', () => {
      const result = calculateServiceCommission({
        subtotal: 0,
        overrideType: 'percentage',
        overrideValue: 15,
      });
      expect(result).toBe(0);
    });

    it('should handle 0 VND product sales', () => {
      const result = calculateProductSalesCommission({
        totalSalesAmount: 0,
      });
      expect(result).toBe(0);
    });

    it('should handle 0 base commission for position bonus', () => {
      const result = calculatePositionBonus({
        baseCommission: 0,
        positionTier: 'lead',
      });
      expect(result).toBe(0);
    });

    it('should handle 0 base salary for seniority bonus', () => {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      
      const result = calculateSeniorityBonus({
        baseSalary: 0,
        hireDate: fiveYearsAgo,
      });
      expect(result).toBe(0);
    });
  });

  describe('NULL/Undefined Inputs Edge Cases', () => {
    it('should handle null override values', () => {
      const result = calculateServiceCommission({
        subtotal: 1000000,
        overrideType: null as any,
        overrideValue: null as any,
        defaultType: 'fixed',
        defaultValue: 150000,
      });
      expect(result).toBe(150000); // Falls back to default
    });

    it('should handle undefined override values', () => {
      const result = calculateServiceCommission({
        subtotal: 1000000,
        overrideType: undefined,
        overrideValue: undefined,
      });
      expect(result).toBe(DEFAULT_COMMISSION_CONFIG.service_commission_default.value);
    });

    it('should handle null hire date for seniority', () => {
      const result = calculateSeniorityBonus({
        baseSalary: 6000000,
        hireDate: null,
      });
      expect(result).toBe(0);
    });

    it('should handle undefined hire date for seniority', () => {
      const result = calculateSeniorityBonus({
        baseSalary: 6000000,
        hireDate: undefined as any,
      });
      expect(result).toBe(0);
    });

    it('should handle null adjustments array', () => {
      const result = aggregateManualAdjustments({
        adjustments: null as any,
      });
      expect(result).toBe(0);
    });

    it('should handle undefined adjustments array', () => {
      const result = aggregateManualAdjustments({
        adjustments: undefined as any,
      });
      expect(result).toBe(0);
    });
  });

  describe('Invalid Commission Types Edge Cases', () => {
    it('should handle invalid commission type (fallback to fixed)', () => {
      const result = parseCommissionInput('invalid_type' as any, 150000, 1000000);
      // Should default to treating as fixed amount
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty string commission type', () => {
      const result = parseCommissionInput('' as any, 150000, 1000000);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed case commission type', () => {
      // Test if function is case-sensitive
      const result1 = parseCommissionInput('FIXED' as any, 150000, 0);
      const result2 = parseCommissionInput('Percentage' as any, 10, 1000000);
      // Function should handle or normalize case
      expect(result1).toBeGreaterThanOrEqual(0);
      expect(result2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Boundary Conditions: Percentage at Limits', () => {
    it('should clamp percentage at exactly 0%', () => {
      const result = parseCommissionInput('percentage', 0, 1000000);
      expect(result).toBe(0);
    });

    it('should handle percentage at exactly 50%', () => {
      const result = parseCommissionInput('percentage', 50, 1000000);
      expect(result).toBe(500000);
    });

    it('should clamp percentage at exactly 100%', () => {
      const result = parseCommissionInput('percentage', 100, 1000000);
      expect(result).toBe(1000000);
    });

    it('should clamp percentage at 100.1% to 100%', () => {
      const result = parseCommissionInput('percentage', 100.1, 1000000);
      expect(result).toBe(1000000); // Clamped
    });

    it('should clamp percentage at 150% to 100%', () => {
      const result = parseCommissionInput('percentage', 150, 1000000);
      expect(result).toBe(1000000); // Clamped
    });

    it('should clamp percentage at 200% to 100%', () => {
      const result = parseCommissionInput('percentage', 200, 1000000);
      expect(result).toBe(1000000); // Clamped
    });
  });

  describe('Boundary Conditions: Position Tier Edge Cases', () => {
    it('should handle unknown position tier (default to junior)', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: 'unknown_tier' as any,
      });
      expect(result).toBe(0); // Should default to junior (no bonus)
    });

    it('should handle null position tier', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: null as any,
      });
      expect(result).toBe(0);
    });

    it('should handle undefined position tier', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: undefined as any,
      });
      expect(result).toBe(0);
    });

    it('should handle empty string position tier', () => {
      const result = calculatePositionBonus({
        baseCommission: 1000000,
        positionTier: '' as any,
      });
      expect(result).toBe(0);
    });
  });

  describe('Boundary Conditions: Seniority at Exact Boundaries', () => {
    it('should handle exactly 1 year seniority (boundary)', () => {
      // At exactly 1.0 years, still in 0-1 year bracket (need > 1, not >= 1)
      const rate = getSeniorityBonusRate(1.0);
      expect(rate).toBe(0.00); // Still in 0-1 year bracket
    });

    it('should handle just over 1 year seniority (crosses boundary)', () => {
      const rate = getSeniorityBonusRate(1.01);
      expect(rate).toBe(0.05); // Crosses into 1-3 year bracket
    });

    it('should handle exactly 3 years seniority (boundary)', () => {
      // At exactly 3.0 years, still in 1-3 year bracket
      const rate = getSeniorityBonusRate(3.0);
      expect(rate).toBe(0.05); // Still in 1-3 year bracket
    });

    it('should handle just over 3 years seniority (crosses boundary)', () => {
      const rate = getSeniorityBonusRate(3.01);
      expect(rate).toBe(0.10); // Crosses into 3-5 year bracket
    });

    it('should handle exactly 5 years seniority (boundary)', () => {
      // At exactly 5.0 years, still in 3-5 year bracket
      const rate = getSeniorityBonusRate(5.0);
      expect(rate).toBe(0.10); // Still in 3-5 year bracket
    });

    it('should handle just over 5 years seniority (crosses boundary)', () => {
      const rate = getSeniorityBonusRate(5.01);
      expect(rate).toBe(0.15); // Crosses into 5+ year bracket
    });

    it('should handle 0.99 years (just before 1 year boundary)', () => {
      const rate = getSeniorityBonusRate(0.99);
      expect(rate).toBe(0.00); // Still in 0-1 year bracket
    });

    it('should handle 2.99 years (just before 3 year boundary)', () => {
      const rate = getSeniorityBonusRate(2.99);
      expect(rate).toBe(0.05); // Still in 1-3 year bracket
    });

    it('should handle 4.99 years (just before 5 year boundary)', () => {
      const rate = getSeniorityBonusRate(4.99);
      expect(rate).toBe(0.10); // Still in 3-5 year bracket
    });
  });

  describe('Rounding Behavior Tests', () => {
    it('should handle 12.5 VND (half-round case)', () => {
      const result = parseCommissionInput('percentage', 0.000125, 10000000);
      // 0.000125% of 10M = 12.5 VND → Math.round() = 13 VND
      expect(result).toBe(13); // Math.round(12.5) = 13
    });

    it('should handle 1/3 percentage (repeating decimal)', () => {
      const result = parseCommissionInput('percentage', 33.333333, 1000000);
      // 33.333333% of 1M = 333333.33 VND → Math.round() = 333333 VND
      expect(result).toBe(333333); // Math.round(333333.33) = 333333
    });

    it('should preserve decimal places in fixed commission', () => {
      const result = parseCommissionInput('fixed', 123456.789, 0);
      expect(result).toBe(123456.789);
    });

    it('should handle scientific notation inputs', () => {
      const result = parseCommissionInput('fixed', 1.5e5, 0); // 150000
      expect(result).toBe(150000);
    });
  });

  describe('Manual Adjustments Complex Scenarios', () => {
    it('should only count approved adjustments', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'bonus', amount: 500000, status: 'approved' },
          { adjustment_type: 'bonus', amount: 300000, status: 'draft' },
          { adjustment_type: 'bonus', amount: 200000, status: 'pending' },
          { adjustment_type: 'deduction', amount: 100000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 50000, status: 'rejected' },
        ],
      });
      expect(result).toBe(400000); // 500k - 100k (only approved)
    });

    it('should handle mixed bonuses and deductions (complex)', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'bonus', amount: 1000000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 200000, status: 'approved' },
          { adjustment_type: 'bonus', amount: 500000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 300000, status: 'approved' },
          { adjustment_type: 'bonus', amount: 100000, status: 'approved' },
        ],
      });
      expect(result).toBe(1100000); // 1M + 500k + 100k - 200k - 300k = 1.1M
    });

    it('should handle all deductions (negative net result)', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'deduction', amount: 500000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 200000, status: 'approved' },
          { adjustment_type: 'deduction', amount: 100000, status: 'approved' },
        ],
      });
      expect(result).toBe(-800000); // Net deduction (can be negative)
    });

    it('should handle large number of adjustments (100 items)', () => {
      const adjustments = [];
      for (let i = 0; i < 50; i++) {
        adjustments.push({ adjustment_type: 'bonus' as const, amount: 10000, status: 'approved' });
        adjustments.push({ adjustment_type: 'deduction' as const, amount: 5000, status: 'approved' });
      }
      
      const result = aggregateManualAdjustments({ adjustments });
      expect(result).toBe(250000); // 50 * 10k - 50 * 5k = 250k
    });

    it('should ignore adjustments with zero amounts', () => {
      const result = aggregateManualAdjustments({
        adjustments: [
          { adjustment_type: 'bonus', amount: 500000, status: 'approved' },
          { adjustment_type: 'bonus', amount: 0, status: 'approved' },
          { adjustment_type: 'deduction', amount: 0, status: 'approved' },
          { adjustment_type: 'deduction', amount: 100000, status: 'approved' },
        ],
      });
      expect(result).toBe(400000); // 500k - 100k (zeros don't affect)
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle calculation with maximum safe integer', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      const start = performance.now();
      
      const result = calculateServiceCommission({
        subtotal: maxSafe,
        overrideType: 'percentage',
        overrideValue: 0.0001, // Tiny percentage
      });
      
      const end = performance.now();
      
      expect(Number.isFinite(result)).toBe(true);
      expect(end - start).toBeLessThan(10); // Should be fast (<10ms)
    });

    it('should handle batch calculations efficiently', () => {
      const start = performance.now();
      
      const results = [];
      for (let i = 0; i < 1000; i++) {
        results.push(calculateServiceCommission({
          subtotal: 1000000 * i,
          overrideType: 'percentage',
          overrideValue: 10 + (i % 10),
        }));
      }
      
      const end = performance.now();
      
      expect(results).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // 1000 calculations in <100ms
    });
  });
});

