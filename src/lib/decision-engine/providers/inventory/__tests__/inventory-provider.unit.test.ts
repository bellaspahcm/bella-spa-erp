/**
 * @fileoverview InventoryProvider Unit Tests
 * 
 * Tests individual decision types with focused scenarios.
 * 
 * **Test Coverage:**
 * - Reorder decisions (6 tests)
 * - Allocation decisions (5 tests)
 * - Expiry decisions (4 tests)
 * - Edge cases (3 tests)
 * 
 * **Total:** 18 unit tests
 */

import { InventoryProvider } from '../inventory-provider';
import type {
  InventoryDecisionInput,
  ReorderDecision,
  AllocationDecision,
  ExpiryDecision,
} from '../types';

describe('InventoryProvider - Unit Tests', () => {
  let provider: InventoryProvider;

  beforeEach(() => {
    provider = new InventoryProvider({ debug: false });
  });

  // ============================================================================
  // REORDER DECISIONS (6 tests)
  // ============================================================================

  describe('Reorder Decisions', () => {
    test('should trigger CRITICAL reorder when stock < 10%', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-001',
          productName: 'Test Product',
          currentStock: 15, // 7.5% of 200
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        demandTrend: {
          productId: 'prod-001',
          avgDailyDemand: 5,
          trending: 'stable',
          trendPercentage: 0.0,
          seasonalityFactor: 1.0,
          forecastAccuracy: 0.85,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      expect(result.shouldReorder).toBe(true);
      expect(result.urgency).toBe('critical');
      expect(result.reorderQuantity).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.reason).toContain('critically low');
    });

    test('should trigger NORMAL reorder when stock 10-30%', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-002',
          productName: 'Test Product',
          currentStock: 50, // 25% of 200
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        demandTrend: {
          productId: 'prod-002',
          avgDailyDemand: 5,
          trending: 'stable',
          trendPercentage: 0.0,
          seasonalityFactor: 1.0,
          forecastAccuracy: 0.85,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      expect(result.shouldReorder).toBe(true);
      expect(result.urgency).toBe('normal');
      expect(result.reorderQuantity).toBeGreaterThan(0);
      expect(result.reason).toContain('reorder point');
    });

    test('should NOT reorder when stock > 30%', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-003',
          productName: 'Test Product',
          currentStock: 150, // 75% of 200
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        demandTrend: {
          productId: 'prod-003',
          avgDailyDemand: 5,
          trending: 'stable',
          trendPercentage: 0.0,
          seasonalityFactor: 1.0,
          forecastAccuracy: 0.85,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      expect(result.shouldReorder).toBe(false);
      expect(result.urgency).toBe('low');
      expect(result.reorderQuantity).toBe(0);
      expect(result.reason).toContain('sufficient');
    });

    test('should increase quantity for HIGH DEMAND trending up', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-004',
          productName: 'Test Product',
          currentStock: 50, // 25% - triggers standard reorder
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        demandTrend: {
          productId: 'prod-004',
          avgDailyDemand: 5,
          trending: 'up',
          trendPercentage: 0.25, // 25% increase (>20% threshold)
          seasonalityFactor: 1.0,
          forecastAccuracy: 0.90,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      expect(result.shouldReorder).toBe(true);
      expect(result.urgency).toBe('high'); // Upgraded from normal
      expect(result.reason).toContain('Demand trending up');
    });

    test('should build SEASONAL buffer for peak season', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-005',
          productName: 'Test Product',
          currentStock: 100, // 50% - normally no reorder
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        demandTrend: {
          productId: 'prod-005',
          avgDailyDemand: 8,
          trending: 'up',
          trendPercentage: 0.15,
          seasonalityFactor: 1.5, // Peak season (>1.3 threshold)
          forecastAccuracy: 0.95,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      expect(result.shouldReorder).toBe(true);
      expect(result.urgency).toBe('high');
      expect(result.reason).toContain('Peak season');
      // Should target 90% capacity (180 units)
      expect(result.reorderQuantity).toBeGreaterThanOrEqual(80);
    });

    test('should adjust timing for SUPPLIER LEAD TIME', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-006',
          productName: 'Test Product',
          currentStock: 30, // 15% - enough for 6 days
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
          supplierLeadTime: 10, // 10 days - longer than stock will last
        },
        demandTrend: {
          productId: 'prod-006',
          avgDailyDemand: 5,
          trending: 'stable',
          trendPercentage: 0.0,
          seasonalityFactor: 1.0,
          forecastAccuracy: 0.85,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      expect(result.shouldReorder).toBe(true);
      expect(result.urgency).toBe('high');
      expect(result.reason).toContain('lead time');
      expect(result.recommendedOrderDate).toBeDefined();
    });
  });

  // ============================================================================
  // ALLOCATION DECISIONS (5 tests)
  // ============================================================================

  describe('Allocation Decisions', () => {
    test('should allocate with HIGH priority for VIP customer', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'allocation',
        productStock: {
          productId: 'prod-101',
          productName: 'Test Product',
          currentStock: 100,
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: 90,
          unitCost: 150000,
        },
        allocationRequest: {
          bookingId: 'booking-vip-001',
          productId: 'prod-101',
          quantity: 5,
          customerTier: 'vip',
          scheduledDate: new Date(),
          isConfirmed: true,
        },
      };

      const result = (await provider.evaluate(input)) as AllocationDecision;

      expect(result.canAllocate).toBe(true);
      expect(result.allocatedQuantity).toBe(5);
      expect(result.priority).toBe('high');
      expect(result.shouldReserve).toBe(true);
      expect(result.reason).toContain('VIP');
      expect(result.reservationExpiry).toBeDefined();
    });

    test('should allocate with NORMAL priority for regular customer', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'allocation',
        productStock: {
          productId: 'prod-102',
          productName: 'Test Product',
          currentStock: 100,
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: 90,
          unitCost: 150000,
        },
        allocationRequest: {
          bookingId: 'booking-reg-001',
          productId: 'prod-102',
          quantity: 3,
          customerTier: 'regular',
          scheduledDate: new Date(),
          isConfirmed: true,
        },
      };

      const result = (await provider.evaluate(input)) as AllocationDecision;

      expect(result.canAllocate).toBe(true);
      expect(result.allocatedQuantity).toBe(3);
      expect(result.priority).toBe('normal');
      expect(result.shouldReserve).toBe(true); // Confirmed booking
      expect(result.reason).toContain('Standard allocation');
    });

    test('should do PARTIAL allocation when insufficient stock', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'allocation',
        productStock: {
          productId: 'prod-103',
          productName: 'Test Product',
          currentStock: 3, // Only 3 available
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: 60,
          unitCost: 150000,
        },
        allocationRequest: {
          bookingId: 'booking-reg-002',
          productId: 'prod-103',
          quantity: 10, // Request 10
          customerTier: 'regular',
          scheduledDate: new Date(),
          isConfirmed: true,
        },
      };

      const result = (await provider.evaluate(input)) as AllocationDecision;

      expect(result.canAllocate).toBe(true); // Partial
      expect(result.allocatedQuantity).toBe(3); // Only 3 available
      expect(result.priority).toBe('normal');
      expect(result.shouldReserve).toBe(true);
      expect(result.reason).toContain('Insufficient stock');
      expect(result.reason).toContain('3/10');
      expect(result.alternatives).toBeDefined();
    });

    test('should NOT allocate when no stock available', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'allocation',
        productStock: {
          productId: 'prod-104',
          productName: 'Test Product',
          currentStock: 0, // No stock
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: 60,
          unitCost: 150000,
        },
        allocationRequest: {
          bookingId: 'booking-reg-003',
          productId: 'prod-104',
          quantity: 5,
          customerTier: 'regular',
          scheduledDate: new Date(),
          isConfirmed: true,
        },
      };

      const result = (await provider.evaluate(input)) as AllocationDecision;

      expect(result.canAllocate).toBe(false);
      expect(result.allocatedQuantity).toBe(0);
      expect(result.shouldReserve).toBe(false);
      expect(result.reason).toContain('No stock');
    });

    test('should NOT reserve for unconfirmed regular booking', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'allocation',
        productStock: {
          productId: 'prod-105',
          productName: 'Test Product',
          currentStock: 50,
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: 90,
          unitCost: 150000,
        },
        allocationRequest: {
          bookingId: 'booking-reg-004',
          productId: 'prod-105',
          quantity: 2,
          customerTier: 'regular',
          scheduledDate: new Date(),
          isConfirmed: false, // NOT confirmed
        },
      };

      const result = (await provider.evaluate(input)) as AllocationDecision;

      expect(result.canAllocate).toBe(true);
      expect(result.allocatedQuantity).toBe(2);
      expect(result.priority).toBe('normal');
      expect(result.shouldReserve).toBe(false); // No reservation for unconfirmed
      expect(result.reservationExpiry).toBeUndefined();
    });
  });

  // ============================================================================
  // EXPIRY DECISIONS (4 tests)
  // ============================================================================

  describe('Expiry Decisions', () => {
    test('should use FEFO for products >30 days to expiry', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'expiry',
        productStock: {
          productId: 'prod-201',
          productName: 'Test Product',
          currentStock: 50,
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: 60, // >30 days
          unitCost: 200000,
        },
      };

      const result = (await provider.evaluate(input)) as ExpiryDecision;

      expect(result.action).toBe('use_first');
      expect(result.shouldAlert).toBe(false);
      expect(result.valueImpact).toBe(0);
      expect(result.reason).toContain('FEFO');
    });

    test('should apply 10% DISCOUNT for 15-30 days to expiry', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'expiry',
        productStock: {
          productId: 'prod-202',
          productName: 'Test Product',
          currentStock: 20,
          maxStock: 100,
          minStock: 20,
          unit: 'bottle',
          daysUntilExpiry: 20, // 15-30 days
          unitCost: 200000,
        },
      };

      const result = (await provider.evaluate(input)) as ExpiryDecision;

      expect(result.action).toBe('discount');
      expect(result.discountPercentage).toBe(10);
      expect(result.shouldAlert).toBe(true);
      expect(result.alertUrgency).toBe('medium');
      expect(result.valueImpact).toBeLessThan(0); // Negative impact
      expect(Math.abs(result.valueImpact)).toBe(400000); // 20 * 200000 * 0.10
    });

    test('should apply 20% DISCOUNT for 7-14 days to expiry', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'expiry',
        productStock: {
          productId: 'prod-203',
          productName: 'Test Product',
          currentStock: 15,
          maxStock: 100,
          minStock: 20,
          unit: 'bottle',
          daysUntilExpiry: 10, // 7-14 days
          unitCost: 300000,
        },
      };

      const result = (await provider.evaluate(input)) as ExpiryDecision;

      expect(result.action).toBe('discount');
      expect(result.discountPercentage).toBe(20);
      expect(result.shouldAlert).toBe(true);
      expect(result.alertUrgency).toBe('high');
      expect(Math.abs(result.valueImpact)).toBe(900000); // 15 * 300000 * 0.20
    });

    test('should WRITE OFF expired products', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'expiry',
        productStock: {
          productId: 'prod-204',
          productName: 'Test Product',
          currentStock: 8,
          maxStock: 100,
          minStock: 20,
          unit: 'bottle',
          daysUntilExpiry: -5, // Expired 5 days ago
          unitCost: 250000,
        },
      };

      const result = (await provider.evaluate(input)) as ExpiryDecision;

      expect(result.action).toBe('write_off');
      expect(result.shouldAlert).toBe(true);
      expect(result.alertUrgency).toBe('high');
      expect(result.daysUntilAction).toBe(0); // Immediate
      expect(result.valueImpact).toBe(-2000000); // Full loss: 8 * 250000
      expect(result.reason).toContain('expired');
    });
  });

  // ============================================================================
  // EDGE CASES (3 tests)
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle non-perishable products (no expiry)', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'expiry',
        productStock: {
          productId: 'prod-301',
          productName: 'Non-perishable Product',
          currentStock: 100,
          maxStock: 200,
          minStock: 40,
          unit: 'unit',
          daysUntilExpiry: null, // Non-perishable
          unitCost: 100000,
        },
      };

      const result = (await provider.evaluate(input)) as ExpiryDecision;

      expect(result.action).toBe('monitor');
      expect(result.shouldAlert).toBe(false);
      expect(result.valueImpact).toBe(0);
      expect(result.reason).toContain('Non-perishable');
      expect(result.daysUntilAction).toBe(Infinity);
    });

    test('should handle zero demand gracefully', async () => {
      const input: InventoryDecisionInput = {
        tenantId: 'test-tenant',
        decisionType: 'reorder',
        productStock: {
          productId: 'prod-302',
          productName: 'Test Product',
          currentStock: 50,
          maxStock: 200,
          minStock: 60,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        demandTrend: {
          productId: 'prod-302',
          avgDailyDemand: 0, // Zero demand
          trending: 'down',
          trendPercentage: -1.0,
          seasonalityFactor: 0.5,
          forecastAccuracy: 0.70,
        },
      };

      const result = (await provider.evaluate(input)) as ReorderDecision;

      // Should still evaluate based on stock level (25%)
      expect(result).toBeDefined();
      expect(result.shouldReorder).toBe(true); // <30%
      expect(result.daysOfCoverage).toBeGreaterThan(0);
    });

    test('should return safe default on error', async () => {
      const invalidInput = {
        tenantId: 'test-tenant',
        decisionType: 'allocation',
        productStock: {
          productId: 'prod-303',
          productName: 'Test Product',
          currentStock: 50,
          maxStock: 200,
          minStock: 40,
          unit: 'bottle',
          daysUntilExpiry: null,
          unitCost: 100000,
        },
        // Missing allocationRequest - will throw error
      } as InventoryDecisionInput;

      const result = (await provider.evaluate(invalidInput)) as AllocationDecision;

      // Should return safe default instead of throwing
      expect(result.canAllocate).toBe(false);
      expect(result.allocatedQuantity).toBe(0);
      expect(result.shouldReserve).toBe(false);
      expect(result.reason).toContain('Error');
    });
  });
});

