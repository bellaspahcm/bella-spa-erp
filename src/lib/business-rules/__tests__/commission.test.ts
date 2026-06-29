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

    it('should use system default (10% percentage)', () => {
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
      expect(getSeniorityBonusRate(1.0)).toBe(0.05);
      expect(getSeniorityBonusRate(2.0)).toBe(0.05);
      expect(getSeniorityBonusRate(2.99)).toBe(0.05);
    });

    it('should return 10% for 3-5 years', () => {
      expect(getSeniorityBonusRate(3.0)).toBe(0.10);
      expect(getSeniorityBonusRate(4.0)).toBe(0.10);
      expect(getSeniorityBonusRate(4.99)).toBe(0.10);
    });

    it('should return 15% for 5+ years', () => {
      expect(getSeniorityBonusRate(5.0)).toBe(0.15);
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
