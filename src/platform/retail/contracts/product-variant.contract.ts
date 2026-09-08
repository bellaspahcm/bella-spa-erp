/**
 * RETAIL OS - PRODUCT VARIANT CONTRACT (R3)
 * 
 * Extension contract for variant management (size, color, style, etc.)
 * Enables Fashion, Electronics, and other retail with product variations.
 * 
 * Ownership: Retail OS (Industry Kernel)
 * Consumers: bella-kids-clothing, future fashion/electronics products
 * Status: NEW (2026-09-06, evidence-based extension from customer demand)
 * 
 * @module platform/retail/contracts/product-variant.contract
 */

/**
 * Variant Status Lifecycle
 * ACTIVE → DISCONTINUED (no reversal)
 */
export type VariantStatus = 'ACTIVE' | 'DISCONTINUED';

/**
 * Product Variant Entity
 * 
 * Represents a specific variation of a parent product
 * Example: T-Shirt (parent) → T-Shirt Red 4T (variant)
 */
export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string; // Parent product
  variantSku: string; // Unique SKU for this variant
  variantAttributes: Record<string, string>; // {size: '4T', color: 'red'}
  currentStock: number;
  status: VariantStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Variant Request
 */
export interface CreateVariantRequest {
  tenantId: string;
  productId: string;
  variantSku?: string; // Optional (auto-generated if not provided)
  variantAttributes: Record<string, string>; // e.g., {size: '4T', color: 'red'}
  initialStock?: number; // defaults to 0
  status?: VariantStatus; // defaults to 'ACTIVE'
}

/**
 * Update Variant Stock Request
 */
export interface UpdateVariantStockRequest {
  tenantId: string;
  variantId: string;
  newStock: number;
}

/**
 * Product Variant Contract (R3)
 * 
 * Defines variant management for products with multiple variations
 * 
 * Scope:
 * - Variant creation with attributes
 * - Stock tracking per variant
 * - Variant queries and lifecycle
 * 
 * OUT OF SCOPE:
 * - Variant pricing strategies (use parent product base_price)
 * - Variant images/media
 * - Variant combinations validation (any attributes allowed)
 * - Multi-location variant stock
 */
export interface IProductVariantContract {
  /**
   * Create a product variant
   * 
   * Invariants:
   * - Parent product must exist
   * - variant_sku must be unique per tenant
   * - variant_attributes cannot be empty
   * 
   * @param request - Variant creation data
   * @returns Created variant
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_NOT_FOUND if parent product doesn't exist
   * @throws VARIANT_CREATE_FAILED if creation fails (e.g., duplicate SKU)
   */
  createVariant(request: CreateVariantRequest): Promise<ProductVariant>;

  /**
   * Get all variants for a product
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Parent product identifier
   * @param includeDiscontinued - Include DISCONTINUED variants (default: false)
   * @returns Array of variants (empty if none)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getVariantsByProduct(
    tenantId: string,
    productId: string,
    includeDiscontinued?: boolean
  ): Promise<ProductVariant[]>;

  /**
   * Get variant by SKU
   * 
   * @param tenantId - Tenant identifier
   * @param variantSku - Variant SKU
   * @returns Variant if found, null otherwise
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getVariantBySku(tenantId: string, variantSku: string): Promise<ProductVariant | null>;

  /**
   * Get variant by ID
   * 
   * @param tenantId - Tenant identifier
   * @param variantId - Variant identifier
   * @returns Variant if found, null otherwise
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getVariantById(tenantId: string, variantId: string): Promise<ProductVariant | null>;

  /**
   * Update variant stock
   * 
   * Invariants:
   * - Variant must exist
   * - newStock must be non-negative
   * 
   * @param request - Stock update data
   * @returns Updated variant
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws VARIANT_NOT_FOUND if variant doesn't exist
   * @throws NEGATIVE_STOCK_ERROR if newStock < 0
   */
  updateVariantStock(request: UpdateVariantStockRequest): Promise<ProductVariant>;

  /**
   * Get total stock across all variants of a product
   * 
   * Useful for parent product aggregate stock display
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Parent product identifier
   * @returns Total stock (sum of all variant stocks)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getTotalVariantStock(tenantId: string, productId: string): Promise<number>;
}

/**
 * Contract Result Wrapper
 */
export interface ContractResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
