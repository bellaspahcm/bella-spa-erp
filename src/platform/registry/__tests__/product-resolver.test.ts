/**
 * Unit tests for ProductResolver
 * 
 * @remarks
 * Tests use mocked tenant data (no database queries).
 * Runtime integration tested in Phase 5.6+.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { productRegistry, ProductDefinition } from '../product-registry';
import {
  productResolver,
  TenantIdentity,
  TenantNotClassifiedError,
  UnknownProductKeyError
} from '../product-resolver';

describe('ProductResolver', () => {
  // Test fixtures
  const createMockTenant = (
    id: string,
    product_key: string | null
  ): TenantIdentity => ({
    id,
    product_key
  });

  const createTestProduct = (productKey: string): ProductDefinition => ({
    productKey,
    displayName: `Test ${productKey}`,
    requiredModules: ['beauty_spa'],
    serviceProfile: 'test',
    defaultRoute: '/dashboard',
    navigationProfile: 'test'
  });

  beforeEach(() => {
    // Clear registries before each test
    productRegistry.clear();
  });

  describe('Successful Resolution', () => {
    it('should resolve tenant with valid product_key', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const tenant = createMockTenant(
        '743d7f1e-403f-4817-aaf2-3b5acf540154',
        'bella_haircut'
      );

      const resolved = productResolver.resolve(tenant);

      expect(resolved).toBeDefined();
      expect(resolved.tenant).toBe(tenant);
      expect(resolved.product).toBe(product);
      expect(resolved.product.productKey).toBe('bella_haircut');
      expect(resolved.product.displayName).toBe('Test bella_haircut');
    });

    it('should return correct product for multiple registered products', () => {
      const haircut = createTestProduct('bella_haircut');
      const nail = createTestProduct('bella_nail');
      productRegistry.register(haircut);
      productRegistry.register(nail);

      const tenant1 = createMockTenant('tenant-1', 'bella_haircut');
      const tenant2 = createMockTenant('tenant-2', 'bella_nail');

      const resolved1 = productResolver.resolve(tenant1);
      const resolved2 = productResolver.resolve(tenant2);

      expect(resolved1.product.productKey).toBe('bella_haircut');
      expect(resolved2.product.productKey).toBe('bella_nail');
    });

    it('should preserve tenant identity in resolved result', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const tenant = createMockTenant('test-tenant-id', 'bella_haircut');
      const resolved = productResolver.resolve(tenant);

      expect(resolved.tenant.id).toBe('test-tenant-id');
      expect(resolved.tenant.product_key).toBe('bella_haircut');
    });
  });

  describe('TenantNotClassifiedError', () => {
    it('should throw when product_key is null', () => {
      const tenant = createMockTenant('unclassified-tenant', null);

      expect(() => productResolver.resolve(tenant)).toThrow(TenantNotClassifiedError);
      expect(() => productResolver.resolve(tenant)).toThrow(
        'Tenant not classified: unclassified-tenant (product_key is NULL)'
      );
    });

    it('should throw when product_key is undefined', () => {
      const tenant: TenantIdentity = {
        id: 'unclassified-tenant',
        product_key: undefined as any
      };

      expect(() => productResolver.resolve(tenant)).toThrow(TenantNotClassifiedError);
    });

    it('should provide clear error message with tenant ID', () => {
      const tenant = createMockTenant('abc-123', null);

      try {
        productResolver.resolve(tenant);
        fail('Should have thrown TenantNotClassifiedError');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantNotClassifiedError);
        expect((error as Error).message).toContain('abc-123');
        expect((error as Error).name).toBe('TenantNotClassifiedError');
      }
    });
  });

  describe('UnknownProductKeyError', () => {
    it('should throw when product_key not registered', () => {
      const tenant = createMockTenant('tenant-id', 'nonexistent_product');

      expect(() => productResolver.resolve(tenant)).toThrow(UnknownProductKeyError);
      expect(() => productResolver.resolve(tenant)).toThrow(
        'Unknown product key: nonexistent_product for tenant tenant-id'
      );
    });

    it('should provide clear error message with tenant ID and product key', () => {
      const tenant = createMockTenant('tenant-xyz', 'invalid_key');

      try {
        productResolver.resolve(tenant);
        fail('Should have thrown UnknownProductKeyError');
      } catch (error) {
        expect(error).toBeInstanceOf(UnknownProductKeyError);
        expect((error as Error).message).toContain('tenant-xyz');
        expect((error as Error).message).toContain('invalid_key');
        expect((error as Error).name).toBe('UnknownProductKeyError');
      }
    });

    it('should throw even if product was previously registered but then cleared', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);
      productRegistry.clear();

      const tenant = createMockTenant('tenant-id', 'bella_haircut');

      expect(() => productResolver.resolve(tenant)).toThrow(UnknownProductKeyError);
    });
  });

  describe('hasValidProduct()', () => {
    it('should return true when product_key is valid and registered', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const tenant = createMockTenant('tenant-id', 'bella_haircut');

      expect(productResolver.hasValidProduct(tenant)).toBe(true);
    });

    it('should return false when product_key is null', () => {
      const tenant = createMockTenant('tenant-id', null);

      expect(productResolver.hasValidProduct(tenant)).toBe(false);
    });

    it('should return false when product_key is undefined', () => {
      const tenant: TenantIdentity = {
        id: 'tenant-id',
        product_key: undefined as any
      };

      expect(productResolver.hasValidProduct(tenant)).toBe(false);
    });

    it('should return false when product_key not registered', () => {
      const tenant = createMockTenant('tenant-id', 'nonexistent_product');

      expect(productResolver.hasValidProduct(tenant)).toBe(false);
    });

    it('should not throw exceptions', () => {
      const tenant1 = createMockTenant('tenant-1', null);
      const tenant2 = createMockTenant('tenant-2', 'nonexistent');

      expect(() => productResolver.hasValidProduct(tenant1)).not.toThrow();
      expect(() => productResolver.hasValidProduct(tenant2)).not.toThrow();
    });
  });

  describe('tryResolve()', () => {
    it('should return resolved product when valid', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const tenant = createMockTenant('tenant-id', 'bella_haircut');
      const resolved = productResolver.tryResolve(tenant);

      expect(resolved).toBeDefined();
      expect(resolved?.product.productKey).toBe('bella_haircut');
    });

    it('should return undefined when product_key is null', () => {
      const tenant = createMockTenant('tenant-id', null);
      const resolved = productResolver.tryResolve(tenant);

      expect(resolved).toBeUndefined();
    });

    it('should return undefined when product_key not registered', () => {
      const tenant = createMockTenant('tenant-id', 'nonexistent');
      const resolved = productResolver.tryResolve(tenant);

      expect(resolved).toBeUndefined();
    });

    it('should not throw exceptions', () => {
      const tenant1 = createMockTenant('tenant-1', null);
      const tenant2 = createMockTenant('tenant-2', 'nonexistent');

      expect(() => productResolver.tryResolve(tenant1)).not.toThrow();
      expect(() => productResolver.tryResolve(tenant2)).not.toThrow();
    });
  });

  describe('Error Handling Philosophy: UNKNOWN > WRONG', () => {
    it('should NOT return default product for null product_key', () => {
      // Register bella_spa as potential default
      const spa = createTestProduct('bella_spa');
      productRegistry.register(spa);

      const tenant = createMockTenant('tenant-id', null);

      // Must throw, not return bella_spa
      expect(() => productResolver.resolve(tenant)).toThrow(TenantNotClassifiedError);
    });

    it('should NOT infer product from enabled_modules', () => {
      // This test proves resolver does NOT look at enabled_modules
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      // Tenant has NO product_key (even if it might have enabled_modules in real DB)
      const tenant = createMockTenant('tenant-id', null);

      // Must throw, not infer from modules
      expect(() => productResolver.resolve(tenant)).toThrow(TenantNotClassifiedError);
    });

    it('should NOT silently fallback to any product', () => {
      // Register multiple products
      const spa = createTestProduct('bella_spa');
      const haircut = createTestProduct('bella_haircut');
      const nail = createTestProduct('bella_nail');
      productRegistry.register(spa);
      productRegistry.register(haircut);
      productRegistry.register(nail);

      const tenant = createMockTenant('tenant-id', 'nonexistent_product');

      // Must throw, not pick any registered product
      expect(() => productResolver.resolve(tenant)).toThrow(UnknownProductKeyError);
    });

    it('should fail explicitly rather than return undefined', () => {
      const tenant = createMockTenant('tenant-id', null);

      // resolve() must throw (strict)
      expect(() => productResolver.resolve(tenant)).toThrow();

      // tryResolve() returns undefined (graceful)
      expect(productResolver.tryResolve(tenant)).toBeUndefined();
    });
  });

  describe('Real-World Scenario: Haircut Shop (Census Evidence)', () => {
    it('should resolve Haircut Shop tenant correctly', () => {
      // Register bella_haircut product (from P5.3)
      const haircutProduct: ProductDefinition = {
        productKey: 'bella_haircut',
        displayName: 'Bella Haircut Shop',
        requiredModules: ['beauty_spa'],
        serviceProfile: 'haircut',
        defaultRoute: '/dashboard',
        navigationProfile: 'haircut'
      };
      productRegistry.register(haircutProduct);

      // Mock Haircut Shop tenant (after P5.6 migration)
      const haircutTenant: TenantIdentity = {
        id: '743d7f1e-403f-4817-aaf2-3b5acf540154',
        product_key: 'bella_haircut'
      };

      const resolved = productResolver.resolve(haircutTenant);

      expect(resolved.tenant.id).toBe('743d7f1e-403f-4817-aaf2-3b5acf540154');
      expect(resolved.product.productKey).toBe('bella_haircut');
      expect(resolved.product.displayName).toBe('Bella Haircut Shop');
      expect(resolved.product.requiredModules).toEqual(['beauty_spa']);
      expect(resolved.product.serviceProfile).toBe('haircut');
    });

    it('should fail for Haircut Shop before P5.6 migration (product_key NULL)', () => {
      // Before migration: product_key is NULL
      const haircutTenant: TenantIdentity = {
        id: '743d7f1e-403f-4817-aaf2-3b5acf540154',
        product_key: null
      };

      expect(() => productResolver.resolve(haircutTenant)).toThrow(TenantNotClassifiedError);
      expect(productResolver.hasValidProduct(haircutTenant)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string product_key', () => {
      const tenant = createMockTenant('tenant-id', '');

      // Empty string is truthy but invalid product key
      expect(() => productResolver.resolve(tenant)).toThrow(UnknownProductKeyError);
    });

    it('should be case-sensitive for product keys', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const tenant1 = createMockTenant('tenant-1', 'bella_haircut');
      const tenant2 = createMockTenant('tenant-2', 'BELLA_HAIRCUT');
      const tenant3 = createMockTenant('tenant-3', 'Bella_Haircut');

      expect(() => productResolver.resolve(tenant1)).not.toThrow();
      expect(() => productResolver.resolve(tenant2)).toThrow(UnknownProductKeyError);
      expect(() => productResolver.resolve(tenant3)).toThrow(UnknownProductKeyError);
    });

    it('should handle special characters in product_key', () => {
      const tenant = createMockTenant('tenant-id', 'bella-haircut@2024!');

      expect(() => productResolver.resolve(tenant)).toThrow(UnknownProductKeyError);
    });
  });

  describe('Integration Readiness (Phase 5.6+)', () => {
    it('should work with TenantIdentity shape matching database schema', () => {
      // Simulate database row shape
      const dbRow: TenantIdentity = {
        id: '743d7f1e-403f-4817-aaf2-3b5acf540154',
        product_key: 'bella_haircut'
      };

      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const resolved = productResolver.resolve(dbRow);

      expect(resolved.tenant.id).toBe(dbRow.id);
      expect(resolved.product.productKey).toBe(dbRow.product_key);
    });

    it('should provide all data needed for AppContext', () => {
      const product = createTestProduct('bella_haircut');
      productRegistry.register(product);

      const tenant = createMockTenant('tenant-id', 'bella_haircut');
      const resolved = productResolver.resolve(tenant);

      // AppContext will need:
      expect(resolved.product.displayName).toBeDefined(); // UI display
      expect(resolved.product.requiredModules).toBeDefined(); // module checks
      expect(resolved.product.defaultRoute).toBeDefined(); // routing
      expect(resolved.product.navigationProfile).toBeDefined(); // nav structure
      expect(resolved.tenant.id).toBeDefined(); // tenant context
    });
  });
});
