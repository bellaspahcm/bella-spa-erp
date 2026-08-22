/**
 * Logistics OS — Item Domain Types
 * 
 * Item (SKU) is the master data entity representing physical or virtual goods
 * across all Logistics Products (Warehouse, Fulfillment, 3PL, Transportation, Returns).
 * 
 * Design Principles:
 * - Warehouse-agnostic (no Receipt, Bin, Putaway concepts)
 * - Finance-agnostic (no accounting logic, only cost hints)
 * - Product-agnostic (serves Warehouse, Fulfillment, 3PL, etc.)
 * - Regulatory-ready (supports lot, serial, expiry tracking requirements)
 * 
 * @module logistics/domain/item
 */

/**
 * Item ID (unique identifier)
 */
export interface ItemId {
  value: string; // UUID
}

/**
 * SKU Code (stock keeping unit code)
 * 
 * Business identifier, unique per tenant
 */
export interface SkuCode {
  value: string; // e.g., "SKU-12345", "PROD-ABC", "UPC-123456789012"
}

/**
 * Item Type
 * 
 * Categorizes items by nature
 */
export type ItemType =
  | 'GOODS'        // Physical goods (default)
  | 'SERVICE'      // Service item (labor, consultation, etc.)
  | 'KIT'          // Kit/bundle (composed of multiple items)
  | 'BUNDLE'       // Bundle (sold as unit, but tracked separately)
  | 'VIRTUAL';     // Digital/virtual goods

/**
 * Item Status
 * 
 * Lifecycle state of item master record
 */
export type ItemStatus =
  | 'ACTIVE'         // Available for use
  | 'INACTIVE'       // Temporarily disabled
  | 'DISCONTINUED'   // No longer available
  | 'PENDING';       // Awaiting approval

/**
 * Unit of Measure (UOM)
 * 
 * Standard measurement units
 */
export type UnitOfMeasure =
  | 'EA'   // Each (default)
  | 'CS'   // Case
  | 'PLT'  // Pallet
  | 'KG'   // Kilogram
  | 'G'    // Gram
  | 'L'    // Liter
  | 'ML'   // Milliliter
  | 'M'    // Meter
  | 'CM'   // Centimeter
  | 'FT'   // Foot
  | 'IN';  // Inch

/**
 * Item Dimensions
 * 
 * Physical dimensions (optional)
 */
export interface ItemDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'CM' | 'IN' | 'M' | 'FT';
}

/**
 * Item Category
 * 
 * Business classification (optional, tenant-defined)
 */
export interface ItemCategory {
  category_code: string;
  category_name: string;
  parent_category_code?: string;
}

/**
 * Item (Core Entity)
 * 
 * Master data record for physical or virtual goods
 * 
 * Example:
 * ```typescript
 * const item: Item = {
 *   id: { value: '123e4567-e89b-12d3-a456-426614174000' },
 *   tenant_id: 'tenant-a',
 *   sku_code: { value: 'SKU-001' },
 *   name: 'Widget Pro 3000',
 *   description: 'Professional-grade widget',
 *   type: 'GOODS',
 *   base_uom: 'EA',
 *   weight_kg: 2.5,
 *   dimensions: { length: 30, width: 20, height: 10, unit: 'CM' },
 *   lot_tracked: true,
 *   serial_tracked: false,
 *   expiry_tracked: false,
 *   status: 'ACTIVE',
 *   created_at: new Date(),
 *   updated_at: new Date(),
 * };
 * ```
 */
export interface Item {
  // ========== Identity ==========
  /** Unique item identifier (UUID) */
  id: ItemId;
  
  /** Tenant ID (P0 Gate - tenant isolation) */
  tenant_id: string;
  
  /** Stock Keeping Unit code (unique per tenant) */
  sku_code: SkuCode;
  
  // ========== Description ==========
  /** Item name */
  name: string;
  
  /** Detailed description (optional) */
  description?: string;
  
  // ========== Classification ==========
  /** Item type (GOODS, SERVICE, KIT, etc.) */
  type: ItemType;
  
  /** Business category (optional, tenant-defined) */
  category?: string;
  
  // ========== Measurement ==========
  /** Base unit of measure */
  base_uom: UnitOfMeasure;
  
  /** Weight in kilograms (optional) */
  weight_kg?: number;
  
  /** Physical dimensions (optional) */
  dimensions?: ItemDimensions;
  
  // ========== Costing (Hints for Finance OS) ==========
  /** Standard cost (optional, for reference only) */
  standard_cost?: number;
  
  /** Currency (ISO 4217, default: tenant currency) */
  currency?: string;
  
  // ========== Traceability Requirements ==========
  /** Requires lot/batch tracking */
  lot_tracked: boolean;
  
  /** Requires serial number tracking */
  serial_tracked: boolean;
  
  /** Requires expiry date tracking */
  expiry_tracked: boolean;
  
  // ========== Status ==========
  /** Current lifecycle status */
  status: ItemStatus;
  
  // ========== Audit ==========
  /** Creation timestamp */
  created_at: Date;
  
  /** Last update timestamp */
  updated_at: Date;
  
  /** Created by user ID (optional) */
  created_by?: string;
  
  /** Last updated by user ID (optional) */
  updated_by?: string;
}

/**
 * Create Item Props
 * 
 * Input for creating a new item
 */
export interface CreateItemProps {
  tenant_id: string;
  sku_code: string;
  name: string;
  description?: string;
  type?: ItemType;
  category?: string;
  base_uom: UnitOfMeasure;
  weight_kg?: number;
  dimensions?: ItemDimensions;
  standard_cost?: number;
  currency?: string;
  lot_tracked?: boolean;
  serial_tracked?: boolean;
  expiry_tracked?: boolean;
  created_by?: string;
}

/**
 * Update Item Props
 * 
 * Input for updating an existing item
 */
export interface UpdateItemProps {
  name?: string;
  description?: string;
  type?: ItemType;
  category?: string;
  base_uom?: UnitOfMeasure;
  weight_kg?: number;
  dimensions?: ItemDimensions;
  standard_cost?: number;
  currency?: string;
  lot_tracked?: boolean;
  serial_tracked?: boolean;
  expiry_tracked?: boolean;
  status?: ItemStatus;
  updated_by?: string;
}

/**
 * Item Filters
 * 
 * Query filters for searching items
 */
export interface ItemFilters {
  /** Filter by status */
  status?: ItemStatus | ItemStatus[];
  
  /** Filter by type */
  type?: ItemType | ItemType[];
  
  /** Filter by category */
  category?: string;
  
  /** Filter by lot tracking requirement */
  lot_tracked?: boolean;
  
  /** Filter by serial tracking requirement */
  serial_tracked?: boolean;
  
  /** Filter by expiry tracking requirement */
  expiry_tracked?: boolean;
  
  /** Search by SKU code (partial match) */
  sku_code_like?: string;
  
  /** Search by name (partial match) */
  name_like?: string;
}

/**
 * Item Domain Error
 * 
 * Domain-specific errors for item operations
 */
export class ItemDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ItemDomainError';
  }
}

/**
 * Item Validation Errors
 */
export const ItemErrorCodes = {
  SKU_CODE_REQUIRED: 'SKU_CODE_REQUIRED',
  SKU_CODE_INVALID: 'SKU_CODE_INVALID',
  SKU_CODE_DUPLICATE: 'SKU_CODE_DUPLICATE',
  NAME_REQUIRED: 'NAME_REQUIRED',
  BASE_UOM_REQUIRED: 'BASE_UOM_REQUIRED',
  SERIAL_REQUIRES_LOT: 'SERIAL_REQUIRES_LOT',
  CANNOT_DEACTIVATE: 'CANNOT_DEACTIVATE',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
} as const;

