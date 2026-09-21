/**
 * Product Identity Resolver
 * 
 * @remarks
 * Resolves tenant's canonical product identity from `tenant.product_key`.
 * 
 * **Architecture Principle**: UNKNOWN > WRONG
 * - Unknown product key → throw error (explicit failure)
 * - Null product key → throw error (tenant not classified)
 * - NO silent fallbacks to 'bella_spa'
 * - NO module-based inference
 * 
 * **Phase 5.4 Scope**: Code-only implementation
 * - Unit tests with mocked tenant data
 * - NO database queries
 * - NO runtime wiring
 * 
 * **Phase 5.6+**: Runtime integration (blocked until P5.2B)
 * - Wire into TenantRuntime
 * - Wire into AppContext
 * - Query real tenant.product_key
 * 
 * @module ProductResolver
 * @see docs/architecture/PHASE4_PRODUCT_IDENTITY_ARCHITECTURE.md
 */

import { productRegistry, ProductDefinition } from './product-registry';

/**
 * Error thrown when tenant has no product_key assigned.
 */
export class TenantNotClassifiedError extends Error {
  constructor(tenantId: string) {
    super(`Tenant not classified: ${tenantId} (product_key is NULL)`);
    this.name = 'TenantNotClassifiedError';
  }
}

/**
 * Error thrown when tenant's product_key is not registered in ProductRegistry.
 */
export class UnknownProductKeyError extends Error {
  constructor(tenantId: string, productKey: string) {
    super(`Unknown product key: ${productKey} for tenant ${tenantId}`);
    this.name = 'UnknownProductKeyError';
  }
}

/**
 * Tenant identity data (minimal subset for product resolution).
 * 
 * @remarks
 * In Phase 5.6+, this will come from database query.
 * In Phase 5.4, this is mocked for unit tests.
 */
export interface TenantIdentity {
  readonly id: string;
  readonly product_key: string | null;
}

/**
 * Product resolution result.
 * 
 * @remarks
 * Contains both product definition and tenant context.
 * Used by AppContext to expose currentProduct.
 */
export interface ResolvedProduct {
  readonly tenant: TenantIdentity;
  readonly product: ProductDefinition;
}

/**
 * Product Identity Resolver.
 * 
 * @remarks
 * Maps tenant.product_key → ProductDefinition via ProductRegistry.
 * 
 * **Error Handling Philosophy**:
 * - Fail fast and explicit
 * - No silent fallbacks
 * - Unknown ≠ Default
 * 
 * **Resolution Algorithm**:
 * ```
 * 1. If product_key IS NULL → TenantNotClassifiedError
 * 2. Query ProductRegistry.get(product_key)
 * 3. If NOT FOUND → UnknownProductKeyError
 * 4. Return ResolvedProduct
 * ```
 * 
 * **Usage Pattern** (Phase 5.6+):
 * ```typescript
 * const tenant = await getTenantFromDB(tenantId);
 * const resolved = productResolver.resolve(tenant);
 * 
 * // Now have:
 * // - resolved.product.displayName
 * // - resolved.product.requiredModules
 * // - resolved.product.defaultRoute
 * ```
 */
export class ProductResolver {
  /**
   * Resolve tenant's product identity.
   * 
   * @param tenant - Tenant identity with product_key
   * @returns Resolved product definition
   * @throws {TenantNotClassifiedError} If product_key is null
   * @throws {UnknownProductKeyError} If product_key not registered
   * 
   * @remarks
   * **Principle**: UNKNOWN > WRONG
   * 
   * This method NEVER:
   * - Returns a default product
   * - Infers product from enabled_modules
   * - Silently falls back to 'bella_spa'
   * - Returns null/undefined
   * 
   * Instead, it throws explicit errors so caller can:
   * - Show "Tenant not classified" admin UI
   * - Trigger migration flow
   * - Log error for investigation
   * 
   * @example
   * ```typescript
   * try {
   *   const resolved = productResolver.resolve(tenant);
   *   console.log(`Product: ${resolved.product.displayName}`);
   * } catch (error) {
   *   if (error instanceof TenantNotClassifiedError) {
   *     // Show admin: "Please classify this tenant"
   *   } else if (error instanceof UnknownProductKeyError) {
   *     // Log error: "Invalid product_key in database"
   *   }
   * }
   * ```
   */
  resolve(tenant: TenantIdentity): ResolvedProduct {
    // Guard: product_key must be set
    if (tenant.product_key === null || tenant.product_key === undefined) {
      throw new TenantNotClassifiedError(tenant.id);
    }

    // Query ProductRegistry
    const product = productRegistry.get(tenant.product_key);

    // Guard: product_key must be registered
    if (!product) {
      throw new UnknownProductKeyError(tenant.id, tenant.product_key);
    }

    // Success: return resolved product
    return {
      tenant,
      product
    };
  }

  /**
   * Check if tenant has valid product classification.
   * 
   * @param tenant - Tenant identity
   * @returns True if product_key is set and registered
   * 
   * @remarks
   * Use for conditional logic without exception handling.
   * 
   * @example
   * ```typescript
   * if (productResolver.hasValidProduct(tenant)) {
   *   const resolved = productResolver.resolve(tenant);
   *   // Safe: will not throw
   * } else {
   *   // Handle unclassified tenant
   * }
   * ```
   */
  hasValidProduct(tenant: TenantIdentity): boolean {
    if (tenant.product_key === null || tenant.product_key === undefined) {
      return false;
    }
    return productRegistry.has(tenant.product_key);
  }

  /**
   * Resolve tenant's product identity (graceful, returns undefined on failure).
   * 
   * @param tenant - Tenant identity
   * @returns Resolved product or undefined
   * 
   * @remarks
   * Use when product is optional or for fallback logic.
   * Prefer `resolve()` for explicit error handling.
   * 
   * @example
   * ```typescript
   * const resolved = productResolver.tryResolve(tenant);
   * if (resolved) {
   *   console.log(`Product: ${resolved.product.displayName}`);
   * } else {
   *   console.log('Tenant not classified or unknown product');
   * }
   * ```
   */
  tryResolve(tenant: TenantIdentity): ResolvedProduct | undefined {
    try {
      return this.resolve(tenant);
    } catch {
      return undefined;
    }
  }
}

/**
 * Singleton instance of ProductResolver.
 * 
 * @remarks
 * Single resolver instance for consistent behavior.
 * Import and use throughout platform.
 * 
 * @example
 * ```typescript
 * import { productResolver } from '@/platform/registry/product-resolver';
 * 
 * const resolved = productResolver.resolve(tenant);
 * ```
 */
export const productResolver = new ProductResolver();
