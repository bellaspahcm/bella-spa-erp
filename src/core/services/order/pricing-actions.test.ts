/**
 * Tests for order pricing calculations with module adapter integration.
 * 
 * @remarks
 * These tests verify:
 * - Adapter pricing integration works correctly
 * - Fallback to base price when adapter not found
 * - Subscription tier discounts are applied
 * - Error handling and graceful degradation
 * 
 * **Test Strategy**:
 * - Mock module registry for controlled adapter availability
 * - Test with and without adapter registered
 * - Test error scenarios (adapter throws exception)
 * - Verify subscription tier discount calculations
 * 
 * **Requirements**: REQ-3.3.4
 */

import { calculateOrderPrice, calculateOrderPriceBatch } from './pricing-actions';
import { moduleRegistry } from '@/core/adapters/registry';
import type { CoreServiceCatalogItem } from '@/core/types/service-catalog';
import type { TenantContext } from '@/core/types/tenant';
import type { ModuleAdapter } from '@/core/types';

// Mock console methods to reduce test output noise
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('calculateOrderPrice', () => {
  // Test fixtures
  const mockServiceItem: CoreServiceCatalogItem = {
    id: 'pkg-test-1',
    tenantId: 'tenant-1',
    moduleId: 'spa',
    name: 'Test Package',
    description: 'Test package for pricing',
    basePrice: 10000000,
    currency: 'VND',
    status: 'active',
    metadata: {
      total_sessions: 10,
      session_multiplier: 1.0,
      category: 'basic',
      duration_minutes: 60,
    },
  };

  const mockTenantContext: TenantContext = {
    tenantId: 'tenant-1',
    tenantName: 'Test Tenant',
    enabledModules: ['spa'],
    subscriptionPlan: 'professional',
    featureFlags: {},
    settings: {},
  };

  // Clean up after each test
  afterEach(() => {
    moduleRegistry.clear();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe('with adapter registered', () => {
    it('should invoke adapter calculatePricing when adapter is available', async () => {
      // Create mock adapter
      const mockAdapter: ModuleAdapter = {
        moduleId: 'spa',
        moduleName: 'Test Spa Adapter',
        transformServiceItem: jest.fn(),
        transformBookingOrder: jest.fn(),
        validateBookingRules: jest.fn(),
        calculatePricing: jest.fn().mockResolvedValue(8500000),
        onBookingCompleted: jest.fn(),
        getModuleWidgets: jest.fn(),
      };

      // Register adapter
      moduleRegistry.register(mockAdapter);

      // Calculate price
      const result = await calculateOrderPrice(mockServiceItem, mockTenantContext);

      // Verify adapter was called
      expect(mockAdapter.calculatePricing).toHaveBeenCalledWith(
        mockServiceItem,
        mockTenantContext
      );
      expect(result).toBe(8500000);
    });

    it('should apply subscription tier discounts via adapter', async () => {
      // Create adapter with realistic discount logic
      const mockAdapter: ModuleAdapter = {
        moduleId: 'spa',
        moduleName: 'Test Spa Adapter',
        transformServiceItem: jest.fn(),
        transformBookingOrder: jest.fn(),
        validateBookingRules: jest.fn(),
        calculatePricing: jest.fn(async (item, context) => {
          let price = item.basePrice;
          // Apply subscription discount
          if (context.subscriptionPlan === 'enterprise') {
            price *= 0.85; // 15% off
          } else if (context.subscriptionPlan === 'professional') {
            price *= 0.9; // 10% off
          } else if (context.subscriptionPlan === 'starter') {
            price *= 0.95; // 5% off
          }
          return Math.round(price);
        }),
        onBookingCompleted: jest.fn(),
        getModuleWidgets: jest.fn(),
      };

      moduleRegistry.register(mockAdapter);

      // Test professional tier (10% discount)
      const professionalContext = { ...mockTenantContext, subscriptionPlan: 'professional' as const };
      const professionalPrice = await calculateOrderPrice(mockServiceItem, professionalContext);
      expect(professionalPrice).toBe(9000000); // 10000000 * 0.9

      // Test enterprise tier (15% discount)
      const enterpriseContext = { ...mockTenantContext, subscriptionPlan: 'enterprise' as const };
      const enterprisePrice = await calculateOrderPrice(mockServiceItem, enterpriseContext);
      expect(enterprisePrice).toBe(8500000); // 10000000 * 0.85
    });

    it('should handle VIP package discounts', async () => {
      const vipItem: CoreServiceCatalogItem = {
        ...mockServiceItem,
        id: 'pkg-vip-1',
        name: 'VIP Package',
        basePrice: 15000000,
        metadata: {
          ...mockServiceItem.metadata,
          category: 'vip',
          session_multiplier: 2.0,
        },
      };

      const mockAdapter: ModuleAdapter = {
        moduleId: 'spa',
        moduleName: 'Test Spa Adapter',
        transformServiceItem: jest.fn(),
        transformBookingOrder: jest.fn(),
        validateBookingRules: jest.fn(),
        calculatePricing: jest.fn(async (item, context) => {
          let price = item.basePrice;
          // VIP package discount
          if (item.metadata.category === 'vip') {
            price *= 0.9; // 10% VIP discount
          }
          // Enterprise subscription discount
          if (context.subscriptionPlan === 'enterprise') {
            price *= 0.85; // 15% subscription discount
          }
          return Math.round(price);
        }),
        onBookingCompleted: jest.fn(),
        getModuleWidgets: jest.fn(),
      };

      moduleRegistry.register(mockAdapter);

      const enterpriseContext = { ...mockTenantContext, subscriptionPlan: 'enterprise' as const };
      const finalPrice = await calculateOrderPrice(vipItem, enterpriseContext);

      // 15000000 * 0.9 (VIP) * 0.85 (enterprise) = 11475000
      expect(finalPrice).toBe(11475000);
    });
  });

  describe('without adapter (fallback)', () => {
    it('should fall back to base price when adapter not found', async () => {
      // Don't register any adapter
      const result = await calculateOrderPrice(mockServiceItem, mockTenantContext);

      // Should return base price
      expect(result).toBe(10000000);

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No adapter found for module spa')
      );
    });

    it('should fall back to base price when adapter has no calculatePricing method', async () => {
      // Create adapter without calculatePricing
      const incompleteAdapter = {
        moduleId: 'spa',
        moduleName: 'Incomplete Adapter',
        transformServiceItem: jest.fn(),
        transformBookingOrder: jest.fn(),
        validateBookingRules: jest.fn(),
        onBookingCompleted: jest.fn(),
        getModuleWidgets: jest.fn(),
        // Missing calculatePricing
      } as ModuleAdapter;

      moduleRegistry.register(incompleteAdapter);

      const result = await calculateOrderPrice(mockServiceItem, mockTenantContext);

      // Should return base price
      expect(result).toBe(10000000);

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not implement calculatePricing')
      );
    });

    it('should use first enabled module if item has no moduleId', async () => {
      const itemWithoutModuleId = { ...mockServiceItem, moduleId: undefined as any };
      const result = await calculateOrderPrice(itemWithoutModuleId, mockTenantContext);

      // Should fall back to base price (no adapter registered)
      expect(result).toBe(10000000);
    });
  });

  describe('error handling', () => {
    it('should fall back to base price if adapter throws error', async () => {
      // Create adapter that throws
      const errorAdapter: ModuleAdapter = {
        moduleId: 'spa',
        moduleName: 'Error Adapter',
        transformServiceItem: jest.fn(),
        transformBookingOrder: jest.fn(),
        validateBookingRules: jest.fn(),
        calculatePricing: jest.fn().mockRejectedValue(new Error('Pricing calculation failed')),
        onBookingCompleted: jest.fn(),
        getModuleWidgets: jest.fn(),
      };

      moduleRegistry.register(errorAdapter);

      const result = await calculateOrderPrice(mockServiceItem, mockTenantContext);

      // Should fall back to base price
      expect(result).toBe(10000000);

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error calculating price'),
        expect.any(Error)
      );

      // Should log fallback warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to base price')
      );
    });
  });
});

describe('calculateOrderPriceBatch', () => {
  const mockItems: CoreServiceCatalogItem[] = [
    {
      id: 'pkg-1',
      tenantId: 'tenant-1',
      moduleId: 'spa',
      name: 'Package 1',
      basePrice: 5000000,
      currency: 'VND',
      status: 'active',
      metadata: { category: 'basic' },
    },
    {
      id: 'pkg-2',
      tenantId: 'tenant-1',
      moduleId: 'spa',
      name: 'Package 2',
      basePrice: 10000000,
      currency: 'VND',
      status: 'active',
      metadata: { category: 'premium' },
    },
    {
      id: 'pkg-3',
      tenantId: 'tenant-1',
      moduleId: 'spa',
      name: 'Package 3',
      basePrice: 15000000,
      currency: 'VND',
      status: 'active',
      metadata: { category: 'vip' },
    },
  ];

  const mockTenantContext: TenantContext = {
    tenantId: 'tenant-1',
    tenantName: 'Test Tenant',
    enabledModules: ['spa'],
    subscriptionPlan: 'professional',
    featureFlags: {},
    settings: {},
  };

  afterEach(() => {
    moduleRegistry.clear();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  it('should calculate prices for all items in batch', async () => {
    const mockAdapter: ModuleAdapter = {
      moduleId: 'spa',
      moduleName: 'Test Adapter',
      transformServiceItem: jest.fn(),
      transformBookingOrder: jest.fn(),
      validateBookingRules: jest.fn(),
      calculatePricing: jest.fn(async (item) => item.basePrice * 0.9), // 10% discount for all
      onBookingCompleted: jest.fn(),
      getModuleWidgets: jest.fn(),
    };

    moduleRegistry.register(mockAdapter);

    const results = await calculateOrderPriceBatch(mockItems, mockTenantContext);

    expect(results).toHaveLength(3);
    expect(results[0]).toBe(4500000); // 5000000 * 0.9
    expect(results[1]).toBe(9000000); // 10000000 * 0.9
    expect(results[2]).toBe(13500000); // 15000000 * 0.9
  });

  it('should handle errors per item without stopping batch', async () => {
    const errorAdapter: ModuleAdapter = {
      moduleId: 'spa',
      moduleName: 'Error Adapter',
      transformServiceItem: jest.fn(),
      transformBookingOrder: jest.fn(),
      validateBookingRules: jest.fn(),
      calculatePricing: jest.fn(async (item) => {
        // Throw error for second item
        if (item.id === 'pkg-2') {
          throw new Error('Pricing failed for pkg-2');
        }
        return item.basePrice * 0.9;
      }),
      onBookingCompleted: jest.fn(),
      getModuleWidgets: jest.fn(),
    };

    moduleRegistry.register(errorAdapter);

    const results = await calculateOrderPriceBatch(mockItems, mockTenantContext);

    // Should have results for all items
    expect(results).toHaveLength(3);
    expect(results[0]).toBe(4500000); // Calculated successfully
    expect(results[1]).toBe(10000000); // Error → fallback to base price
    expect(results[2]).toBe(13500000); // Calculated successfully
  });

  it('should maintain order of results matching input', async () => {
    const mockAdapter: ModuleAdapter = {
      moduleId: 'spa',
      moduleName: 'Test Adapter',
      transformServiceItem: jest.fn(),
      transformBookingOrder: jest.fn(),
      validateBookingRules: jest.fn(),
      calculatePricing: jest.fn(async (item) => {
        // Add small delay to test parallel execution
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item.basePrice * 0.8;
      }),
      onBookingCompleted: jest.fn(),
      getModuleWidgets: jest.fn(),
    };

    moduleRegistry.register(mockAdapter);

    const results = await calculateOrderPriceBatch(mockItems, mockTenantContext);

    // Results should be in same order as input
    expect(results[0]).toBe(4000000); // pkg-1
    expect(results[1]).toBe(8000000); // pkg-2
    expect(results[2]).toBe(12000000); // pkg-3
  });

  it('should handle empty array', async () => {
    const results = await calculateOrderPriceBatch([], mockTenantContext);
    expect(results).toEqual([]);
  });
});
