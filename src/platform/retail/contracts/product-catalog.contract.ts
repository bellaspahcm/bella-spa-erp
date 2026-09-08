/**
 * RETAIL OS - PRODUCT CATALOG CONTRACT (R1)
 * 
 * Frozen public contract for Product Management capability.
 * Defines canonical retail product lifecycle operations.
 * 
 * Ownership: Retail OS (Industry Kernel)
 * Consumers: Retail Products (bella-retail-store, future retail products)
 * Status: FROZEN (extracted from Product #1 evidence)
 * 
 * @module platform/retail/contracts/product-catalog.contract
 */

/**
 * Product Status Lifecycle
 * ACTIVE → DISCONTINUED → (no reversal)
 * ACTIVE → OUT_OF_STOCK → ACTIVE (restocked)
 */
export type ProductStatus = 'ACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';

/**
 * Product Entity (Domain representation)
 */
export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  costPrice?: number;
  trackInventory: boolean;
  currentStock: number;
  reorderPoint?: number;
  status: ProductStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Product Request
 */
export interface CreateProductRequest {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  costPrice?: number;
  trackInventory?: boolean; // defaults to true
  currentStock?: number; // defaults to 0
  reorderPoint?: number;
  status?: ProductStatus; // defaults to 'ACTIVE'
  userId?: string; // for audit trail
}

/**
 * Update Product Price Request
 */
export interface UpdateProductPriceRequest {
  tenantId: string;
  productId: string;
  basePrice: number;
  userId?: string;
}

/**
 * Update Product Status Request
 */
export interface UpdateProductStatusRequest {
  tenantId: string;
  productId: string;
  status: ProductStatus;
  userId?: string;
}

/**
 * Product Catalog Contract (R1)
 * 
 * Defines Retail OS ownership of product lifecycle semantics:
 * - Product identity (SKU-based)
 * - Product CRUD operations
 * - Status lifecycle management
 * - Pricing attributes (base/cost)
 * 
 * OUT OF SCOPE (Product-specific):
 * - Product variants / SKU generation logic
 * - Category taxonomy rules
 * - Pricing strategies / discount rules
 * - UI/presentation logic
 */
export interface IProductCatalogContract {
  /**
   * Create a new product
   * 
   * Invariants:
   * - SKU must be unique per tenant
   * - basePrice must be positive
   * - If trackInventory=false, currentStock/reorderPoint ignored
   * 
   * @param request - Product creation data
   * @returns Created product
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_CREATE_FAILED if creation fails (e.g., duplicate SKU)
   */
  createProduct(request: CreateProductRequest): Promise<Product>;

  /**
   * Update product base price
   * 
   * Invariants:
   * - Product must exist and belong to tenant
   * - New price must be positive
   * 
   * @param request - Price update data
   * @returns Updated product
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_NOT_FOUND if product doesn't exist
   * @throws PRODUCT_PRICE_UPDATE_FAILED if update fails
   */
  updateProductPrice(request: UpdateProductPriceRequest): Promise<Product>;

  /**
   * Update product status
   * 
   * Invariants:
   * - Product must exist and belong to tenant
   * - Status transition: DISCONTINUED is final (no reversal)
   * - Status transition: ACTIVE ↔ OUT_OF_STOCK allowed (restock)
   * 
   * @param request - Status update data
   * @returns Updated product
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_NOT_FOUND if product doesn't exist
   * @throws PRODUCT_STATUS_UPDATE_FAILED if update fails
   */
  updateProductStatus(request: UpdateProductStatusRequest): Promise<Product>;

  /**
   * Get product by ID
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Product identifier
   * @returns Product if found, null otherwise
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getProductById(tenantId: string, productId: string): Promise<Product | null>;

  /**
   * Get product by SKU
   * 
   * @param tenantId - Tenant identifier
   * @param sku - Product SKU (unique per tenant)
   * @returns Product if found, null otherwise
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getProductBySku(tenantId: string, sku: string): Promise<Product | null>;
}

/**
 * Contract Result Wrapper
 * Standardizes success/error responses
 */
export interface ContractResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
