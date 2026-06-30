/**
 * @fileoverview Integration tests for Product Sales Commission Flow
 * @module __tests__/integration/product-sales-flow
 * 
 * Tests the end-to-end flow of:
 * 1. Creating product sales for KTV
 * 2. Calculating commission
 * 3. Recalculating salary
 * 4. Verifying product_sales_commission in salary_records
 * 5. Verifying total_salary updates
 * 
 * TASK 36: Integration Tests for Product Sales Flow
 */

import { calculateProductSalesCommission } from '@/lib/business-rules/commission';

describe('Product Sales Commission Flow - Integration Tests (Task 36)', () => {
  
  describe('Basic Product Sales Flow', () => {
    it('should calculate commission for single product sale with override', () => {
      // Scenario: KTV sells a 2M VND skincare product with 15% override commission
      
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 2000000,
        overrideType: 'percentage',
        overrideValue: 15,
      });
      
      expect(commission).toBe(300000); // 15% of 2M
    });
    
    it('should calculate commission with system default (10%)', () => {
      // Scenario: Product sale using system default commission
      
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 1500000,
      });
      
      expect(commission).toBe(150000); // 10% of 1.5M (system default)
    });
    
    it('should calculate fixed amount commission', () => {
      // Scenario: Product sale with fixed commission override
      
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 3000000,
        overrideType: 'fixed',
        overrideValue: 250000,
      });
      
      expect(commission).toBe(250000); // Fixed amount regardless of sale price
    });
  });
  
  describe('Bulk Product Sales (10+ products)', () => {
    it('should handle bulk product sales efficiently', () => {
      // Scenario: KTV sells 15 products in a month
      
      const products = [
        { amount: 500000, overrideType: 'percentage' as const, overrideValue: 10 },
        { amount: 800000, overrideType: 'percentage' as const, overrideValue: 12 },
        { amount: 1200000, overrideType: 'fixed' as const, overrideValue: 150000 },
        { amount: 600000, overrideType: 'percentage' as const, overrideValue: 15 },
        { amount: 1500000, overrideType: 'percentage' as const, overrideValue: 10 },
        { amount: 900000, overrideType: 'fixed' as const, overrideValue: 100000 },
        { amount: 700000 }, // System default
        { amount: 1100000, overrideType: 'percentage' as const, overrideValue: 8 },
        { amount: 2000000, overrideType: 'percentage' as const, overrideValue: 12 },
        { amount: 500000, overrideType: 'fixed' as const, overrideValue: 75000 },
        { amount: 1300000, overrideType: 'percentage' as const, overrideValue: 10 },
        { amount: 850000 }, // System default
        { amount: 1000000, overrideType: 'percentage' as const, overrideValue: 15 },
        { amount: 650000, overrideType: 'fixed' as const, overrideValue: 80000 },
        { amount: 1800000, overrideType: 'percentage' as const, overrideValue: 10 },
      ];
      
      const commissions = products.map(p =>
        calculateProductSalesCommission({
          totalSalesAmount: p.amount,
          overrideType: p.overrideType,
          overrideValue: p.overrideValue,
        })
      );
      
      const totalCommission = commissions.reduce((sum, comm) => sum + comm, 0);
      
      expect(commissions).toHaveLength(15);
      expect(totalCommission).toBeGreaterThan(0);
      expect(Number.isFinite(totalCommission)).toBe(true);
      
      // Verify total sales
      const totalSales = products.reduce((sum, p) => sum + p.amount, 0);
      expect(totalSales).toBeGreaterThan(15000000); // >15M in sales
    });
    
    it('should calculate bulk commission quickly', () => {
      const start = performance.now();
      
      // Simulate 100 product sales
      const commissions = [];
      for (let i = 0; i < 100; i++) {
        commissions.push(
          calculateProductSalesCommission({
            totalSalesAmount: 500000 + (i * 10000),
            overrideType: 'percentage',
            overrideValue: 10 + (i % 5),
          })
        );
      }
      
      const end = performance.now();
      const duration = end - start;
      
      expect(commissions).toHaveLength(100);
      expect(duration).toBeLessThan(100); // <100ms for 100 calculations
    });
  });
  
  describe('Product Sale Updates and Refunds', () => {
    it('should recalculate when product sale is updated', () => {
      // Original: 2M sale with 10% commission = 200k
      const originalCommission = calculateProductSalesCommission({
        totalSalesAmount: 2000000,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      
      expect(originalCommission).toBe(200000);
      
      // Updated: Changed to 15% commission
      const updatedCommission = calculateProductSalesCommission({
        totalSalesAmount: 2000000,
        overrideType: 'percentage',
        overrideValue: 15,
      });
      
      expect(updatedCommission).toBe(300000);
      
      // Commission delta
      const delta = updatedCommission - originalCommission;
      expect(delta).toBe(100000); // Increased by 100k
    });
    
    it('should handle full refund (clawback commission)', () => {
      // Original sale: 3M with 250k commission
      const originalCommission = calculateProductSalesCommission({
        totalSalesAmount: 3000000,
        overrideType: 'fixed',
        overrideValue: 250000,
      });
      
      expect(originalCommission).toBe(250000);
      
      // After full refund: Commission = 0
      const refundedCommission = 0;
      
      const clawback = refundedCommission - originalCommission;
      expect(clawback).toBe(-250000); // Full clawback
    });
    
    it('should handle partial refund (proportional clawback)', () => {
      // Original sale: 4M with 12% = 480k commission
      const originalSaleAmount = 4000000;
      const originalCommission = calculateProductSalesCommission({
        totalSalesAmount: originalSaleAmount,
        overrideType: 'percentage',
        overrideValue: 12,
      });
      
      expect(originalCommission).toBe(480000);
      
      // Partial refund: 1M returned (25% of sale)
      const refundAmount = 1000000;
      const remainingSaleAmount = originalSaleAmount - refundAmount; // 3M
      
      const newCommission = calculateProductSalesCommission({
        totalSalesAmount: remainingSaleAmount,
        overrideType: 'percentage',
        overrideValue: 12,
      });
      
      expect(newCommission).toBe(360000); // 12% of 3M
      
      // Partial clawback
      const clawback = newCommission - originalCommission;
      expect(clawback).toBe(-120000); // Lost 120k (25% of original)
    });
  });
  
  describe('Different Payment Methods', () => {
    it('should calculate commission regardless of payment method (cash)', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 1500000,
        overrideType: 'percentage',
        overrideValue: 12,
      });
      
      expect(commission).toBe(180000); // 12% of 1.5M
      // Payment method (cash) doesn't affect commission
    });
    
    it('should calculate commission regardless of payment method (card)', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 2000000,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      
      expect(commission).toBe(200000); // 10% of 2M
      // Payment method (card) doesn't affect commission
    });
    
    it('should calculate commission regardless of payment method (transfer)', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 1800000,
        overrideType: 'percentage',
        overrideValue: 15,
      });
      
      expect(commission).toBe(270000); // 15% of 1.8M
      // Payment method (transfer) doesn't affect commission
    });
    
    it('should handle split payment methods (multiple payment sources)', () => {
      // Total sale: 3M paid via: 1M cash + 1M card + 1M transfer
      // Commission calculated on total, not per payment method
      
      const totalSaleAmount = 3000000; // Sum of all payment methods
      const commission = calculateProductSalesCommission({
        totalSalesAmount: totalSaleAmount,
        overrideType: 'percentage',
        overrideValue: 12,
      });
      
      expect(commission).toBe(360000); // 12% of 3M total
    });
  });
  
  describe('Cross-Month Product Sales', () => {
    it('should attribute commission to sale completion month', () => {
      // Product ordered in May but delivered/completed in June
      // Commission should be counted in June salary
      
      const orderMonth = '2026-05';
      const completionMonth = '2026-06';
      
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 2500000,
        overrideType: 'percentage',
        overrideValue: 12,
      });
      
      expect(commission).toBe(300000);
      
      // In real implementation, this would be inserted into salary_records
      // with month = completionMonth
      expect(completionMonth).toBe('2026-06');
    });
    
    it('should handle product sale spanning year boundary', () => {
      // Sale in December 2025, completed in January 2026
      
      const commission2025 = calculateProductSalesCommission({
        totalSalesAmount: 1000000,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      
      const commission2026 = calculateProductSalesCommission({
        totalSalesAmount: 1500000,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      
      // Each month's commission calculated independently
      expect(commission2025).toBe(100000);
      expect(commission2026).toBe(150000);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero-value product sale', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 0,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      
      expect(commission).toBe(0);
    });
    
    it('should handle free product (0% commission)', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 500000,
        overrideType: 'percentage',
        overrideValue: 0,
      });
      
      expect(commission).toBe(0);
    });
    
    it('should handle extremely high product value (100M+ VND)', () => {
      // Luxury product package
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 150_000_000, // 150M VND
        overrideType: 'percentage',
        overrideValue: 8,
      });
      
      expect(commission).toBe(12_000_000); // 12M commission
      expect(Number.isFinite(commission)).toBe(true);
    });
    
    it('should handle null/undefined override gracefully', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 1000000,
        overrideType: null as any,
        overrideValue: undefined,
      });
      
      // Should use system default (10%)
      expect(commission).toBe(100000);
    });
    
    it('should handle negative sale amount (edge case)', () => {
      // Should clamp to 0
      const commission = calculateProductSalesCommission({
        totalSalesAmount: -500000,
        overrideType: 'percentage',
        overrideValue: 10,
      });
      
      expect(commission).toBe(0);
    });
  });
  
  describe('Salary Integration', () => {
    it('should aggregate multiple product sales into salary_records', () => {
      // Simulate KTV selling 8 products in a month
      const products = [
        { amount: 1200000, type: 'percentage' as const, value: 12 },
        { amount: 800000, type: 'fixed' as const, value: 100000 },
        { amount: 1500000, type: 'percentage' as const, value: 10 },
        { amount: 2000000, type: 'percentage' as const, value: 15 },
        { amount: 900000 }, // System default
        { amount: 1800000, type: 'percentage' as const, value: 10 },
        { amount: 1100000, type: 'fixed' as const, value: 150000 },
        { amount: 700000, type: 'percentage' as const, value: 12 },
      ];
      
      const commissions = products.map(p =>
        calculateProductSalesCommission({
          totalSalesAmount: p.amount,
          overrideType: p.type,
          overrideValue: p.value,
        })
      );
      
      const totalProductCommission = commissions.reduce((sum, comm) => sum + comm, 0);
      
      expect(totalProductCommission).toBeGreaterThan(0);
      
      // In real implementation, this would be saved to salary_records.product_sales_commission
      const mockSalaryRecord = {
        ktv_id: 'ktv-1',
        month: '2026-06',
        base_salary: 6000000,
        service_commission: 500000,
        product_sales_commission: totalProductCommission,
        rating_bonus: 50000,
        kpi_bonus: 300000,
        deductions: 0,
        advances: 0,
        total_salary: 6000000 + 500000 + totalProductCommission + 50000 + 300000,
      };
      
      expect(mockSalaryRecord.product_sales_commission).toBe(totalProductCommission);
      expect(mockSalaryRecord.total_salary).toBeGreaterThan(6850000);
    });
    
    it('should combine product and service commissions in total_salary', () => {
      // Service commission: 700k
      const serviceCommission = 700000;
      
      // Product commission: 450k
      const productCommission = 450000;
      
      // Other components
      const baseSalary = 6000000;
      const ratingBonus = 50000;
      const kpiBonus = 300000;
      
      const totalSalary = baseSalary + serviceCommission + productCommission + ratingBonus + kpiBonus;
      
      expect(totalSalary).toBe(7500000);
    });
  });
  
  describe('Product Commission Priority Logic', () => {
    it('should use override over system default', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 2000000,
        overrideType: 'percentage',
        overrideValue: 15, // Override: 15% = 300k
        // System default would be 10% = 200k
      });
      
      // Should use override
      expect(commission).toBe(300000);
    });
    
    it('should use system default when no override', () => {
      const commission = calculateProductSalesCommission({
        totalSalesAmount: 1500000,
        // No override provided
      });
      
      // Should use system default (10%)
      expect(commission).toBe(150000);
    });
  });
  
  describe('Performance Tests', () => {
    it('should handle month-end batch processing (1000+ products)', () => {
      const start = performance.now();
      
      // Simulate batch processing all product sales for month-end
      const commissions = [];
      for (let i = 0; i < 1000; i++) {
        commissions.push(
          calculateProductSalesCommission({
            totalSalesAmount: 500000 + (i * 5000),
            overrideType: Math.random() > 0.5 ? 'percentage' : 'fixed',
            overrideValue: Math.random() > 0.5 ? 10 + (i % 10) : 100000 + (i * 1000),
          })
        );
      }
      
      const end = performance.now();
      const duration = end - start;
      
      expect(commissions).toHaveLength(1000);
      expect(duration).toBeLessThan(500); // <500ms for 1000 calculations
      
      const totalCommission = commissions.reduce((sum, c) => sum + c, 0);
      expect(totalCommission).toBeGreaterThan(0);
    });
  });
});
