/**
 * Product Identity Registry for Bella Platform
 * 
 * @remarks
 * ProductRegistry is the canonical owner of Product Identity definitions.
 * 
 * **Product Identity ≠ Module Capability**
 * - Product: What the tenant IS (bella_haircut, bella_nail, bella_spa)
 * - Module: What capabilities are enabled (beauty_spa, healthcare, logistics)
 * 
 * **Product Identity ≠ Service Category**
 * - Product: Business model identity (bella_haircut)
 * - Service Category: Domain classification (haircut, spa, nail)
 * 
 * **Architecture Principle**:
 * ```
 * Tenant.product_key       → ProductRegistry.get() → ProductDefinition
 * ProductDefinition.requiredModules → ModuleRegistry.has()
 * ```
 * 
 * **Phase 5.3 Scope**:
 * - Define product identity contracts
 * - Register evidence-backed products (bella_haircut pilot)
 * - NO runtime wiring (blocked until P5.2B migration execution)
 * 
 * @module ProductRegistry
 * @see docs/architecture/PHASE5_3_PRODUCT_REGISTRY_AUDIT.md
 * @see docs/architecture/PHASE4_PRODUCT_IDENTITY_ARCHITECTURE.md
 */

/**
 * Module identifier type (imported from core types).
 * Represents OS capability modules (beauty_spa, healthcare, logistics).
 */
export type ModuleId = string;

/**
 * Product definition interface.
 * 
 * @remarks
 * Defines canonical product identity and its requirements.
 * 
 * **Key Fields**:
 * - `productKey`: Matches `tenant.product_key` column (when P5.2B executes)
 * - `displayName`: Human-readable name for UI display
 * - `requiredModules`: OS capabilities this product depends on
 * - `serviceProfile`: Domain classification (haircut, spa, nail, etc.)
 * - `defaultRoute`: Entry route after login
 * - `navigationProfile`: Which navigation structure to use
 * 
 * **Example**:
 * ```typescript
 * {
 *   productKey: 'bella_haircut',
 *   displayName: 'Bella Haircut Shop',
 *   requiredModules: ['beauty_spa'],
 *   serviceProfile: 'haircut',
 *   defaultRoute: '/dashboard',
 *   navigationProfile: 'haircut'
 * }
 * ```
 */
export interface ProductDefinition {
  /**
   * Canonical product identifier.
   * Must match `tenant.product_key` column value.
   * 
   * @example 'bella_haircut', 'bella_nail', 'bella_spa'
   */
  readonly productKey: string;

  /**
   * Human-readable product name for UI display.
   * 
   * @example 'Bella Haircut Shop', 'Bella Nail Studio'
   */
  readonly displayName: string;

  /**
   * Required OS capability modules.
   * Product cannot function without these modules enabled.
   * 
   * @remarks
   * Must be valid ModuleId values registered in ModuleRegistry.
   * 
   * @example ['beauty_spa'], ['healthcare'], ['beauty_spa', 'retail']
   */
  readonly requiredModules: ModuleId[];

  /**
   * Domain classification / service specialization.
   * 
   * @remarks
   * This is NOT the product key, but the service domain.
   * Used for domain-specific business rules, not identity.
   * 
   * @example 'haircut', 'spa', 'nail', 'clinic'
   */
  readonly serviceProfile: string;

  /**
   * Default route after login.
   * 
   * @example '/dashboard', '/salon/overview', '/clinic/patients'
   */
  readonly defaultRoute: string;

  /**
   * Navigation profile identifier.
   * Determines which navigation structure to render.
   * 
   * @remarks
   * May differ from full vertical navigation (e.g., haircut vs full spa).
   * 
   * @example 'haircut', 'spa', 'clinic'
   */
  readonly navigationProfile: string;
}

/**
 * Error thrown when attempting to register duplicate product key.
 */
export class DuplicateProductError extends Error {
  constructor(productKey: string) {
    super(`Product already registered: ${productKey}`);
    this.name = 'DuplicateProductError';
  }
}

/**
 * Error thrown when product key not found.
 */
export class ProductNotFoundError extends Error {
  constructor(productKey: string) {
    super(`Product not found: ${productKey}`);
    this.name = 'ProductNotFoundError';
  }
}

/**
 * Product Identity Registry.
 * 
 * @remarks
 * Singleton registry managing all product definitions.
 * 
 * **Design Decisions**:
 * - In-memory Map for O(1) lookup
 * - Singleton pattern ensures single source of truth
 * - Validation prevents duplicate productKey registration
 * - Graceful `get()` vs. error-throwing `getRequired()`
 * 
 * **Usage Pattern**:
 * ```typescript
 * // Register products (during platform initialization)
 * productRegistry.register(bellaHaircutProduct);
 * 
 * // Resolve tenant product (P5.4 ProductResolver)
 * const product = productRegistry.get(tenant.product_key);
 * if (!product) {
 *   throw new Error('Unknown product');
 * }
 * 
 * // Validate module availability
 * const hasRequiredModules = product.requiredModules.every(
 *   moduleId => moduleRegistry.has(moduleId)
 * );
 * ```
 * 
 * **Phase 5.3 Boundary**:
 * - ✅ Define products
 * - ❌ Resolve current tenant's product (P5.4)
 * - ❌ Wire into AppContext/routing (P5.5+)
 */
class ProductRegistry {
  /**
   * Internal storage for product definitions.
   * Map provides O(1) lookup by productKey.
   */
  private products = new Map<string, ProductDefinition>();

  /**
   * Register a product definition.
   * 
   * @param product - Product definition to register
   * @throws {DuplicateProductError} If productKey already registered
   * 
   * @remarks
   * Should be called during platform initialization, NOT at runtime.
   * 
   * **Validation**:
   * - Prevents duplicate productKey registration
   * - Logs successful registration for debugging
   * 
   * @example
   * ```typescript
   * productRegistry.register({
   *   productKey: 'bella_haircut',
   *   displayName: 'Bella Haircut Shop',
   *   requiredModules: ['beauty_spa'],
   *   serviceProfile: 'haircut',
   *   defaultRoute: '/dashboard',
   *   navigationProfile: 'haircut'
   * });
   * ```
   */
  register(product: ProductDefinition): void {
    // Check for duplicate registration
    if (this.products.has(product.productKey)) {
      throw new DuplicateProductError(product.productKey);
    }

    // Register product
    this.products.set(product.productKey, product);

    // Log successful registration
    if (typeof console !== 'undefined') {
      console.log(`[ProductRegistry] Registered product: ${product.displayName} (${product.productKey})`);
    }
  }

  /**
   * Retrieve product definition by key (graceful, returns undefined if not found).
   * 
   * @param productKey - Product identifier
   * @returns Product definition if found, undefined otherwise
   * 
   * @remarks
   * Use this method when product is optional or when providing fallback.
   * 
   * @example
   * ```typescript
   * const product = productRegistry.get(tenant.product_key);
   * if (!product) {
   *   // Handle unknown product
   *   console.warn('Unknown product key:', tenant.product_key);
   *   return defaultProduct;
   * }
   * ```
   */
  get(productKey: string): ProductDefinition | undefined {
    return this.products.get(productKey);
  }

  /**
   * Retrieve product definition by key (strict, throws if not found).
   * 
   * @param productKey - Product identifier
   * @returns Product definition
   * @throws {ProductNotFoundError} If product not found
   * 
   * @remarks
   * Use when product MUST exist for operation to proceed.
   * 
   * @example
   * ```typescript
   * const product = productRegistry.getRequired(tenant.product_key);
   * const requiredModules = product.requiredModules;
   * ```
   */
  getRequired(productKey: string): ProductDefinition {
    const product = this.products.get(productKey);
    if (!product) {
      throw new ProductNotFoundError(productKey);
    }
    return product;
  }

  /**
   * Check if product is registered.
   * 
   * @param productKey - Product identifier
   * @returns True if product registered, false otherwise
   * 
   * @example
   * ```typescript
   * if (productRegistry.has('bella_haircut')) {
   *   // Product definition available
   * }
   * ```
   */
  has(productKey: string): boolean {
    return this.products.has(productKey);
  }

  /**
   * Get all registered product keys.
   * 
   * @returns Array of registered product keys
   * 
   * @remarks
   * Useful for:
   * - Admin UI product selection
   * - Migration scripts
   * - Debugging/logging
   * 
   * @example
   * ```typescript
   * const allProducts = productRegistry.getAllProductKeys();
   * console.log('Available products:', allProducts);
   * ```
   */
  getAllProductKeys(): string[] {
    return Array.from(this.products.keys());
  }

  /**
   * Get all registered product definitions.
   * 
   * @returns Array of product definitions
   * 
   * @example
   * ```typescript
   * const allProducts = productRegistry.getAll();
   * allProducts.forEach(p => {
   *   console.log(`${p.displayName}: requires ${p.requiredModules.join(', ')}`);
   * });
   * ```
   */
  getAll(): ProductDefinition[] {
    return Array.from(this.products.values());
  }

  /**
   * Clear all registered products.
   * 
   * @remarks
   * **⚠️ FOR TESTING ONLY**
   * 
   * Do not use in production code.
   * 
   * @internal
   */
  clear(): void {
    this.products.clear();
  }
}

/**
 * Singleton instance of ProductRegistry.
 * 
 * @remarks
 * Single source of truth for all product definitions.
 * Import and use this instance throughout the platform.
 * 
 * @example
 * ```typescript
 * import { productRegistry } from '@/platform/registry/product-registry';
 * 
 * // Register products
 * productRegistry.register(bellaHaircutProduct);
 * 
 * // Query products
 * const product = productRegistry.get('bella_haircut');
 * ```
 */
export const productRegistry = new ProductRegistry();

// ────────────────────────────────────────────────────────────────────────────
// PRODUCT DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Bella Haircut Shop Product Definition.
 * 
 * @remarks
 * **Evidence**: PROVEN_CANDIDATE (Census Classifier v2)
 * - Tenant ID: 743d7f1e-403f-4817-aaf2-3b5acf540154
 * - Evidence: orphan_keys_haircut_bella_haircut + name_pattern:bella_haircut
 * - Confidence: HIGH
 * - Evidence Level: MULTI_SOURCE
 * 
 * **Module Dependency**:
 * - Requires `beauty_spa` module for booking, services, staff management
 * 
 * **Service Specialization**:
 * - Focuses on haircut services (subset of full spa)
 * - May have simplified navigation compared to full bella_spa product
 * 
 * @see census-v2-classifier-2026-09-19T03-06-41.json
 */
const bellaHaircutProduct: ProductDefinition = {
  productKey: 'bella_haircut',
  displayName: 'Bella Haircut Shop',
  requiredModules: ['beauty_spa'],
  serviceProfile: 'haircut',
  defaultRoute: '/dashboard',
  navigationProfile: 'haircut'
};

// Register pilot product
productRegistry.register(bellaHaircutProduct);
